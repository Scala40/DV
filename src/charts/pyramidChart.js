import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';

export async function renderPyramidChart(container, data, margins) {
    const { width, height } = getContainerDimensions(container);

    // Clear previous SVG but keep controls intact
    const existingSvg = container.querySelector('svg');
    if (existingSvg) existingSvg.remove();

    // Create the SVG container
    const svg = createResponsiveSvg(width, height);

    // Manage data state
    const fullData = initializeData(container, data);

    // Setup and manage controls
    const controls = setupControls(container, fullData, margins);
    const { countrySelect, yearSelect } = controls;

    // Get selected values and filter data
    const selectedCountry = countrySelect.value;
    const selectedYear = +yearSelect.value; // coerce to number
    const filteredData = fullData.filter(d => +d.Year === selectedYear && d.Country === selectedCountry);

    // Process and render chart
    const { maleData, femaleData } = processChartData(filteredData);
    const scales = createScales(filteredData, width, height, margins);

    renderChart(svg, maleData, femaleData, scales, width, margins);

    container.appendChild(svg.node());
}

function initializeData(container, data) {
    const rawData = container.__pyramidRawData || data;
    let datasetKey = container.__pyramidDatasetKey || 'population';

    const keys = Object.keys(rawData);
    if (!rawData[datasetKey]) {
        datasetKey = keys[0];
    }

    const fullData = rawData[datasetKey];
    container.__pyramidRawData = rawData;
    container.__pyramidDatasetKey = datasetKey;

    return fullData;
}

function setupControls(container, fullData, margins) {
    const countries = Array.from(new Set(fullData.map(d => d.Country))).sort();
    const years = Array.from(new Set(fullData.map(d => d.Year))).sort((a, b) => b - a);

    const controls = getOrCreateControlsContainer(container);
    const rowTop = getOrCreateControlRow(controls, 'top');
    const rowBottom = getOrCreateControlRow(controls, 'bottom');

    // Dataset selector (if applicable)
    if (container.__pyramidRawData) {
        setupDatasetSelector(container, rowTop, margins);
    }

    // Country selector
    const countrySelect = setupCountrySelector(container, rowTop, countries, fullData, margins);

    // Year slider and play button
    const { yearSelect, yearDisplay } = setupYearControls(
        rowBottom,
        years,
        container,
        fullData,
        margins
    );

    return { countrySelect, yearSelect, yearDisplay };
}

function getOrCreateControlsContainer(container) {
    let controls = container.querySelector('.pyramid-controls');
    if (!controls) {
        controls = document.createElement('div');
        controls.className = 'pyramid-controls';
        controls.style.display = 'flex';
        controls.style.flexDirection = 'column';
        controls.style.alignItems = 'center';
        controls.style.gap = '8px';
        container.appendChild(controls);
    }
    return controls;
}

function getOrCreateControlRow(controls, position) {
    const className = `pyramid-controls-row-${position}`;
    let row = controls.querySelector(`.${className}`);
    if (!row) {
        row = document.createElement('div');
        row.className = className;
        row.style.display = 'flex';
        row.style.justifyContent = 'center';
        row.style.alignItems = 'center';
        row.style.gap = '10px';
        controls.appendChild(row);
    }
    return row;
}

function setupDatasetSelector(container, rowTop, margins) {
    let datasetSelect = rowTop.querySelector('.pyramid-dataset-select');
    if (!datasetSelect) {
        const dsLabel = document.createElement('label');
        dsLabel.textContent = 'Dataset: ';
        datasetSelect = document.createElement('select');
        datasetSelect.className = 'pyramid-dataset-select';

        Object.keys(container.__pyramidRawData).forEach(k => {
            const opt = document.createElement('option');
            opt.value = k;
            opt.text = k.charAt(0).toUpperCase() + k.slice(1);
            datasetSelect.appendChild(opt);
        });

        datasetSelect.value = container.__pyramidDatasetKey || Object.keys(container.__pyramidRawData)[0];

        datasetSelect.addEventListener('change', () => {
            container.__pyramidDatasetKey = datasetSelect.value;
            renderPyramidChart(container, container.__pyramidRawData, margins);
        });

        rowTop.appendChild(dsLabel);
        rowTop.appendChild(datasetSelect);
    }
}

function setupCountrySelector(container, rowTop, countries, fullData, margins) {
    let countrySelect = rowTop.querySelector('.pyramid-country-select');
    if (!countrySelect) {
        const label = document.createElement('label');
        label.textContent = 'Country: ';

        countrySelect = document.createElement('select');
        countrySelect.className = 'pyramid-country-select';

        countries.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.text = c;
            countrySelect.appendChild(opt);
        });

        countrySelect.value = countries[0];

        countrySelect.addEventListener('change', () => {
            renderPyramidChart(container, fullData, margins);
        });

        rowTop.appendChild(label);
        rowTop.appendChild(countrySelect);
    }
    return countrySelect;
}

function setupYearControls(rowBottom, years, container, fullData, margins) {
    let yearSelect = rowBottom.querySelector('.pyramid-year-select');

    if (!yearSelect) {
        const yLabel = document.createElement('label');
        yLabel.textContent = 'Year: ';

        yearSelect = document.createElement('input');
        yearSelect.type = 'range';
        yearSelect.className = 'pyramid-year-select';
        yearSelect.min = Math.min(...years);
        yearSelect.max = Math.max(...years);
        yearSelect.step = 1;

        const yearDisplay = document.createElement('span');
        yearDisplay.className = 'pyramid-year-display';

        const defaultYear = years.includes(2023) ? 2023 : years[0];
        yearSelect.value = defaultYear;
        yearDisplay.textContent = defaultYear;

        function updateYearSliderFill() {
            const min = +yearSelect.min;
            const max = +yearSelect.max;
            const val = +yearSelect.value;
            const pct = (val - min) / (max - min) * 100;
            yearSelect.style.setProperty('--pct', `${pct}%`);
        }

        updateYearSliderFill();

        yearSelect.addEventListener('input', () => {
            yearDisplay.textContent = yearSelect.value;
            updateYearSliderFill();
            renderPyramidChart(container, fullData, margins);
            stopAnimation(container, rowBottom);
        });

        rowBottom.appendChild(yLabel);
        rowBottom.appendChild(yearSelect);
        rowBottom.appendChild(yearDisplay);

        setupPlayButton(rowBottom, yearSelect, container, fullData, margins, updateYearSliderFill);
    } else {
        const yearDisplay = rowBottom.querySelector('.pyramid-year-display');
        const updateYearSliderFill = () => {
            const min = +yearSelect.min;
            const max = +yearSelect.max;
            const val = +yearSelect.value;
            const pct = (val - min) / (max - min) * 100;
            yearSelect.style.setProperty('--pct', `${pct}%`);
        };
        return { yearSelect, yearDisplay, updateYearSliderFill };
    }

    const yearDisplay = rowBottom.querySelector('.pyramid-year-display');

    return { yearSelect, yearDisplay };
}

function setupPlayButton(rowBottom, yearSelect, container, fullData, margins, updateYearSliderFill) {
    let playBtn = rowBottom.querySelector('.pyramid-play-btn');
    if (!playBtn) {
        playBtn = document.createElement('button');
        playBtn.className = 'pyramid-play-btn';
        playBtn.textContent = 'Play';
        rowBottom.appendChild(playBtn);

        playBtn.addEventListener('click', () => {
            if (container.__pyramidAnimationId) {
                stopAnimation(container, rowBottom);
                return;
            }

            playBtn.textContent = 'Stop';
            const minY = +yearSelect.min;
            const maxY = +yearSelect.max;
            let current = +yearSelect.value || minY;
            if (current >= maxY) current = minY - 1;

            const stepMs = 400;
            container.__pyramidAnimationId = setInterval(() => {
                current += 1;
                if (current > maxY) {
                    stopAnimation(container, rowBottom);
                    return;
                }
                yearSelect.value = current;
                const disp = rowBottom.querySelector('.pyramid-year-display');
                if (disp) disp.textContent = current;
                updateYearSliderFill();
                renderPyramidChart(container, fullData, margins);
            }, stepMs);
        });
    }
}

function stopAnimation(container, controlsRow) {
    if (container.__pyramidAnimationId) {
        clearInterval(container.__pyramidAnimationId);
        container.__pyramidAnimationId = null;
        const playBtn = controlsRow.querySelector('.pyramid-play-btn');
        if (playBtn) playBtn.textContent = 'Play';
    }
}

function processChartData(data) {
    const maleData = data.filter(d => d.Sex === "Male");
    const femaleData = data.filter(d => d.Sex === "Female");

    return { maleData, femaleData };
}

function createScales(data, width, height, margins) {
    const ageGroups = Array.from(new Set(data.map(d => d.Age_Group_5yr)));
    const maxPop = d3.max(data, d => d.Population) || 0;
    const centerGap = 40;

    const x = d3.scaleLinear()
        .domain([-maxPop, maxPop])
        .range([margins.left, width - margins.right]);

    const y = d3.scaleBand()
        .domain(ageGroups)
        .range([height - margins.bottom, margins.top])
        .padding(0.1);

    const centerX = x(0);
    const availableLeft = centerX - margins.left;
    const availableRight = (width - margins.right) - centerX;

    const xLeft = d3.scaleLinear()
        .domain([0, maxPop])
        .range([0, Math.max(0, availableLeft - centerGap / 2)]);

    const xRight = d3.scaleLinear()
        .domain([0, maxPop])
        .range([0, Math.max(0, availableRight - centerGap / 2)]);

    return { x, y, xLeft, xRight, centerX, centerGap };
}

function renderChart(svg, maleData, femaleData, scales, width, margins) {
    const { x, y, xLeft, xRight, centerX, centerGap } = scales;

    // Draw y-axis
    const yAxis = d3.axisLeft(y);
    const yAxisG = svg.append("g")
        .attr("transform", `translate(${x(0)},0)`)
        .call(yAxis);

    yAxisG.selectAll("text")
        .attr("x", 0)
        .attr("text-anchor", "middle");

    yAxisG.selectAll("line").attr("x2", 0).attr("stroke", "none");
    yAxisG.selectAll("path").attr("stroke", "none");

    // Draw male bars and labels
    drawBars(svg, maleData, 'male', scales, centerX, centerGap, 'left');
    drawLabels(svg, maleData, 'male', scales, centerX, centerGap, 'left');

    // Draw female bars and labels
    drawBars(svg, femaleData, 'female', scales, centerX, centerGap, 'right');
    drawLabels(svg, femaleData, 'female', scales, centerX, centerGap, 'right');

    // Draw axis label
    svg.append("text")
        .attr("x", (width + centerGap / 2) / 2)
        .attr("y", margins.top / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", 15)
        .text("Age");

    // Draw legend
    drawLegend(svg, width);
}

function drawBars(svg, data, gender, scales, centerX, centerGap, side) {
    const { y, xLeft, xRight } = scales;
    const scale = side === 'left' ? xLeft : xRight;

    svg.append("g")
        .selectAll(`.bar.${gender}`)
        .data(data)
        .join("rect")
        .attr("class", `bar ${gender}`)
        .attr("x", d => {
            if (side === 'left') {
                return centerX - centerGap / 2 - scale(d.Population);
            }
            return centerX + centerGap / 2;
        })
        .attr("y", d => y(d.Age_Group_5yr) || 0)
        .attr("width", d => scale(d.Population))
        .attr("height", y.bandwidth());
}

function drawLabels(svg, data, gender, scales, centerX, centerGap, side) {
    const { y, xLeft, xRight } = scales;
    const scale = side === 'left' ? xLeft : xRight;

    svg.append("g")
        .attr("font-size", 12)
        .selectAll("text")
        .data(data)
        .join("text")
        .attr("y", d => (y(d.Age_Group_5yr) ?? 0) + y.bandwidth() / 2)
        .attr("x", d => {
            const barStart = side === 'left'
                ? centerX - centerGap / 2 - scale(d.Population)
                : centerX + centerGap / 2;
            const barEnd = side === 'left'
                ? centerX - centerGap / 2
                : centerX + centerGap / 2 + scale(d.Population);
            const barWidth = Math.max(0, barEnd - barStart);

            if (side === 'left') {
                return barWidth > 40 ? barStart + 6 : barStart - 6;
            }
            return barWidth > 40 ? barEnd - 6 : barEnd + 6;
        })
        .attr("dy", "0.35em")
        .attr("text-anchor", d => {
            const barStart = side === 'left'
                ? centerX - centerGap / 2 - scale(d.Population)
                : centerX + centerGap / 2;
            const barEnd = side === 'left'
                ? centerX - centerGap / 2
                : centerX + centerGap / 2 + scale(d.Population);
            const barWidth = Math.max(0, barEnd - barStart);
            return barWidth > 40 ? (side === 'left' ? "start" : "end") : (side === 'left' ? "end" : "start");
        })
        .attr("fill", d => {
            const barStart = side === 'left'
                ? centerX - centerGap / 2 - scale(d.Population)
                : centerX + centerGap / 2;
            const barEnd = side === 'left'
                ? centerX - centerGap / 2
                : centerX + centerGap / 2 + scale(d.Population);
            return (barEnd - barStart > 40) ? "white" : "currentColor";
        })
        .text(d => d3.format('.2f')(+d.Population) + "k");
}

function drawLegend(svg, width) {
    const legendData = [
        { label: "Male", cls: 'male' },
        { label: "Female", cls: 'female' }
    ];

    const legendWidth = 120;
    const legendMargin = 10;
    const legend = svg.append("g")
        .attr("class", "pyramid-legend")
        .attr("transform", `translate(${width - legendWidth - legendMargin},${legendMargin})`);

    legend.selectAll("rect")
        .data(legendData)
        .join("rect")
        .attr("x", 0)
        .attr("y", (d, i) => i * 22)
        .attr("width", 18)
        .attr("height", 18)
        .attr("class", d => `legend-rect ${d.cls}`);

    legend.selectAll("text")
        .data(legendData)
        .join("text")
        .attr("x", 26)
        .attr("y", (d, i) => i * 22 + 13)
        .attr("font-size", 14)
        .text(d => d.label);
}
