import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';

export function renderRidgePlotChart(container, data, margins) {
    const { width, height } = getContainerDimensions(container);
    const fullData = container.__ridgeFullData || data;
    container.__ridgeFullData = fullData;

    container.querySelector('svg')?.remove();

    const countries = Array.from(new Set(fullData.map(d => d.country))).sort();
    const { countrySelect, normalizeToggle } = createControls(container, countries);

    const render = () => renderChart(container, fullData, countrySelect.value, normalizeToggle.checked, width, height, margins);

    render();
    countrySelect.addEventListener('change', render);
    normalizeToggle.addEventListener('change', render);
}

function createControls(container, countries) {
    let controls = container.querySelector('.ridge-controls');
    if (!controls) {
        controls = document.createElement('div');
        controls.className = 'ridge-controls';
        controls.style.textAlign = 'center';
        controls.style.margin = '12px 0';
        container.prepend(controls);
    }

    const countrySelect = createCountrySelect(controls, countries);
    const normalizeToggle = createNormalizeToggle(controls);

    return { countrySelect, normalizeToggle };
}

function createCountrySelect(controls, countries) {
    let countrySelect = controls.querySelector('.ridge-country-select');
    if (!countrySelect) {
        const label = document.createElement('label');
        label.textContent = 'Country: ';
        label.style.marginRight = '8px';

        countrySelect = document.createElement('select');
        countrySelect.className = 'ridge-country-select';
        countrySelect.style.minWidth = '220px';

        countries.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.text = c;
            countrySelect.appendChild(opt);
        });

        const defaultCountry = countries.includes('Syrian Arab Republic') ? 'Syrian Arab Republic' : countries[0];
        countrySelect.value = defaultCountry;
        controls.appendChild(label);
        controls.appendChild(countrySelect);
    }
    return countrySelect;
}

function createNormalizeToggle(controls) {
    let normalizeToggle = controls.querySelector('.ridge-normalize-toggle');
    if (!normalizeToggle) {
        const chkLabel = document.createElement('label');
        chkLabel.style.marginLeft = '12px';
        chkLabel.style.marginRight = '6px';
        chkLabel.textContent = 'Normalize across years';

        normalizeToggle = document.createElement('input');
        normalizeToggle.type = 'checkbox';
        normalizeToggle.className = 'ridge-normalize-toggle';
        normalizeToggle.checked = true;

        controls.appendChild(chkLabel);
        controls.appendChild(normalizeToggle);
    }
    return normalizeToggle;
}

function renderChart(container, fullData, selectedCountry, normalizeAcrossYears, width, height, margins) {
    const oldSvg = container.querySelector("svg");
    if (oldSvg) oldSvg.remove();

    const svg = createResponsiveSvg(width, height);
    const years = [2020, 2021, 2022, 2023, 2024, 2025];

    const processed = computeDensities(fullData, selectedCountry, years, normalizeAcrossYears);
    drawRidgePlot(svg, processed, width, height, margins);

    container.appendChild(svg.node());
}

function computeDensities(fullData, selectedCountry, years, normalizeAcrossYears) {
    const processed = [];

    years.forEach(year => {
        const filtered = fullData.filter(d => d.country === selectedCountry && new Date(d.week).getFullYear() === year);
        const densityData = computeYearDensity(filtered);
        const maxDensity = d3.max(densityData, d => d.density) || 0;
        processed.push({ year, densityData, maxDensity });
    });

    normalizeData(processed, normalizeAcrossYears);
    return processed;
}

function computeYearDensity(filtered) {
    const eventsByDay = d3.rollup(
        filtered,
        v => d3.sum(v, d => +d.events || 0),
        d => {
            const date = new Date(d.week);
            const start = new Date(date.getFullYear(), 0, 0);
            const diff = date - start;
            const oneDay = 1000 * 60 * 60 * 24;
            return Math.floor(diff / oneDay);
        }
    );

    const densityData = [];
    const bandwidth = 7;
    for (let day = 1; day <= 365; day++) {
        let density = 0;
        eventsByDay.forEach((weight, eventDay) => {
            density += weight * Math.exp(-0.5 * Math.pow((day - eventDay) / bandwidth, 2));
        });
        densityData.push({ day, density });
    }
    return densityData;
}

function normalizeData(processed, normalizeAcrossYears) {
    if (normalizeAcrossYears) {
        const globalMax = d3.max(processed, p => p.maxDensity) || 1;
        processed.forEach(p => {
            p.densityData.forEach(d => { d.density = d.density / globalMax; });
        });
    } else {
        processed.forEach(p => {
            const m = p.maxDensity || 1;
            p.densityData.forEach(d => { d.density = m > 0 ? d.density / m : 0; });
        });
    }
}

function drawRidgePlot(svg, processed, width, height, margins) {
    const innerWidth = Math.max(0, width - margins.left - margins.right);
    const innerHeight = Math.max(0, height - margins.top - margins.bottom);
    const ridgeHeight = innerHeight / Math.max(1, processed.length);

    const scales = createScales(innerWidth, ridgeHeight, processed.length);
    const generators = createGenerators(scales, ridgeHeight);

    const gMain = svg.append("g")
        .attr("transform", `translate(${margins.left},${margins.top})`);

    drawNormalizationDescription(gMain, innerWidth);
    drawRidges(gMain, processed, generators, scales, ridgeHeight);
    // draw x axis at the bottom of the plotting area (use innerHeight)
    drawXAxis(gMain, innerHeight, scales.xScale);
}

function createScales(innerWidth, ridgeHeight, dataLength) {
    return {
        xScale: d3.scaleLinear().domain([1, 365]).range([0, innerWidth]),
        yScale: d3.scaleLinear().domain([0, 1.2]).range([ridgeHeight * 0.8, 0]),
        colorScale: d3.scaleSequential(d3.interpolateViridis).domain([0, dataLength - 1])
    };
}

function createGenerators(scales, ridgeHeight) {
    return {
        area: d3.area()
            .x(d => scales.xScale(d.day))
            .y0(ridgeHeight * 0.8)
            .y1(d => scales.yScale(d.density))
            .curve(d3.curveBasis),
        line: d3.line()
            .x(d => scales.xScale(d.day))
            .y(d => scales.yScale(d.density))
            .curve(d3.curveBasis)
    };
}

function drawNormalizationDescription(gMain, innerWidth) {
    const desc = gMain.append("text")
        .attr("class", "normalize-desc")
        .attr("x", innerWidth - 10)
        .attr("y", -8)
        .attr("text-anchor", "end")
        .attr("font-size", 11)
        .attr("fill", "#333");

    desc.append("tspan").text("Normalization modes:");
    desc.append("tspan")
        .attr("x", innerWidth - 10)
        .attr("dy", "1.15em")
        .text("Global: amplitudes comparable across years");
    desc.append("tspan")
        .attr("x", innerWidth - 10)
        .attr("dy", "1.15em")
        .text("Per-year: each year scaled to its own max");
}

function drawRidges(gMain, processed, generators, scales, ridgeHeight) {
    processed.forEach((countryData, i) => {
        const g = gMain.append("g")
            .attr("transform", `translate(0,${i * ridgeHeight})`);

        g.append("path")
            .datum(countryData.densityData)
            .attr("class", "ridge-path")
            .attr("d", generators.area)
            .attr("fill", scales.colorScale(i))
            .attr("opacity", 0.7);

        g.append("path")
            .datum(countryData.densityData)
            .attr("class", "ridge-path")
            .attr("d", generators.line)
            .attr("fill", "none")
            .attr("stroke", scales.colorScale(i))
            .attr("stroke-width", 2);

        g.append("text")
            .attr("class", "year-label")
            .attr("x", -10)
            .attr("y", ridgeHeight / 2)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .text(countryData.year);
    });
}

function drawXAxis(gMain, innerHeight, xScale) {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthStarts = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

    const xAxis = d3.axisBottom(xScale)
        .tickValues(monthStarts)
        .tickFormat(d => {
            const idx = monthStarts.indexOf(d);
            return idx >= 0 ? monthNames[idx] : "";
        });

    gMain.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(xAxis)
        .style("font-size", "12px");
}
