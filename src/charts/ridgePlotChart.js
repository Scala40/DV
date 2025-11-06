import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';

function processAndVisualize(data) {
    // Parse dates and extract day of year
    data.forEach(d => {
        d.date = new Date(d.week);
        const start = new Date(d.date.getFullYear(), 0, 0);
        const diff = d.date - start;
        const oneDay = 1000 * 60 * 60 * 24;
        d.dayOfYear = Math.floor(diff / oneDay);
        d.events = +d.events || 0;
    });

    // Group by country and aggregate events by day of year
    const countryData = d3.group(data, d => d.country);
    const processedData = [];

    countryData.forEach((values, country) => {
        const eventsByDay = d3.rollup(
            values,
            v => d3.sum(v, d => d.events),
            d => d.dayOfYear
        );

        // Create smooth density curve using weighted Gaussian
        const densityData = [];
        const bandwidth = 7;

        for (let day = 1; day <= 365; day++) {
            let density = 0;
            eventsByDay.forEach((weight, eventDay) => {
                density += weight * Math.exp(-0.5 * Math.pow((day - eventDay) / bandwidth, 2));
            });
            densityData.push({ day, density });
        }

        // Normalize
        const maxDensity = d3.max(densityData, d => d.density);
        if (maxDensity > 0) {
            densityData.forEach(d => d.density /= maxDensity);
        }

        processedData.push({
            country,
            densityData
        });
    });

    return processedData;
}

export function renderRidgePlotChart(container, data, margins) {

    const { width, height } = getContainerDimensions(container);

    // preserve the original full dataset on the container so re-renders work
    const fullData = container.__ridgeFullData || data;
    container.__ridgeFullData = fullData;

    container.querySelector('svg')?.remove();

    // --- Country selector (switch which country to plot across all years) ---
    const countries = Array.from(new Set(fullData.map(d => d.country))).sort();
    let controls = container.querySelector('.ridge-controls');
    if (!controls) {
        controls = document.createElement('div');
        controls.className = 'ridge-controls';
        controls.style.textAlign = 'center';
        controls.style.margin = '12px 0';
        container.prepend(controls);
    }

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

    // Normalization toggle: global vs per-year
    let normalizeToggle = controls.querySelector('.ridge-normalize-toggle');
    if (!normalizeToggle) {
        const chkLabel = document.createElement('label');
        chkLabel.style.marginLeft = '12px';
        chkLabel.style.marginRight = '6px';
        chkLabel.textContent = 'Normalize across years';

        normalizeToggle = document.createElement('input');
        normalizeToggle.type = 'checkbox';
        normalizeToggle.className = 'ridge-normalize-toggle';
        normalizeToggle.checked = true; // default: global normalization
        // use --unige-color for the checkbox when checked
        normalizeToggle.style.accentColor = 'var(--color-unige-blue)';

        controls.appendChild(chkLabel);
        controls.appendChild(normalizeToggle);
    }

    // when selection changes, re-render the chart using the original full data
    countrySelect.addEventListener('change', () => render(countrySelect.value));
    // re-render when normalization toggle changes
    normalizeToggle.addEventListener('change', () => render(countrySelect.value));

    // years to plot as ridgelines
    const years = [2020, 2021, 2022, 2023, 2024, 2025];

    function render(selectedCountry) {
        // Remove previous chart if exists
        const oldSvg = container.querySelector("svg");
        if (oldSvg) oldSvg.remove();

        // Create the SVG container.
        const svg = createResponsiveSvg(width, height);

    // For each year, compute density for the selected country
    const processed = [];
    // read normalization mode from the checkbox (true => global normalization)
    const normalizeAcrossYears = !!controls.querySelector('.ridge-normalize-toggle').checked;
    years.forEach(year => {
            const filtered = fullData.filter(d => d.country === selectedCountry && new Date(d.week).getFullYear() === year);

            // aggregate events by dayOfYear
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

            // build density array
            const densityData = [];
            const bandwidth = 7;
            for (let day = 1; day <= 365; day++) {
                let density = 0;
                eventsByDay.forEach((weight, eventDay) => {
                    density += weight * Math.exp(-0.5 * Math.pow((day - eventDay) / bandwidth, 2));
                });
                densityData.push({ day, density });
            }

            // record per-year max but do NOT normalize yet if using global normalization
            const maxDensity = d3.max(densityData, d => d.density) || 0;
            processed.push({ year, densityData, maxDensity });
        });

    // If requested, normalize all years by the single global maximum so amplitudes
        // are directly comparable across years. Otherwise fall back to per-year normalization.
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

        // Month labels
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthStarts = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

        // Inner drawing dimensions (respect margins)
        const innerWidth = Math.max(0, width - margins.left - margins.right);
        const innerHeight = Math.max(0, height - margins.top - margins.bottom);

        

        // Scales
        const xScale = d3.scaleLinear()
            .domain([1, 365])
            .range([0, innerWidth]);

        const ridgeHeight = innerHeight / Math.max(1, processed.length);
        const yScale = d3.scaleLinear()
            .domain([0, 1.2])
            .range([ridgeHeight * 0.8, 0]);

        const colorScale = d3.scaleSequential(d3.interpolateViridis)
            .domain([0, processed.length - 1]);

        // Create area generator
        const area = d3.area()
            .x(d => xScale(d.day))
            .y0(ridgeHeight * 0.8)
            .y1(d => yScale(d.density))
            .curve(d3.curveBasis);

        const line = d3.line()
            .x(d => xScale(d.day))
            .y(d => yScale(d.density))
            .curve(d3.curveBasis);

        // Main group translated by margins
        const gMain = svg.append("g")
            .attr("transform", `translate(${margins.left},${margins.top})`);

        // Description of normalization behaviors (placed above the plotting area)
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

        // Draw ridges
        processed.forEach((countryData, i) => {
            const g = gMain.append("g")
                .attr("transform", `translate(0,${i * ridgeHeight})`);

            // Fill
            g.append("path")
                .datum(countryData.densityData)
                .attr("class", "ridge-path")
                .attr("d", area)
                .attr("fill", colorScale(i))
                .attr("opacity", 0.7);

            // Stroke
            g.append("path")
                .datum(countryData.densityData)
                .attr("class", "ridge-path")
                .attr("d", line)
                .attr("fill", "none")
                .attr("stroke", colorScale(i))
                .attr("stroke-width", 2);

            // Year label (placed just left of the plotting area)
            g.append("text")
                .attr("class", "year-label")
                .attr("x", -10)
                .attr("y", ridgeHeight / 2)
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .text(countryData.year);
        });

        // X-axis
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

        // X-axis label
        gMain.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", height - margins.bottom + 10)
            .attr("text-anchor", "middle")
            .style("font-weight", "bold")
            .style("font-size", "14px")
            .text("Day of Year");

        // Append the SVG to the container
        container.appendChild(svg.node());
    }

    // Initial render (use currently selected country)
    render(countrySelect.value);
}
