import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';

export function renderPyramidChart(container, data, margins) {
    const { width, height } = getContainerDimensions(container);


    // clear previous SVG but keep any controls (like the country selector) intact
    const existingSvg = container.querySelector('svg');
    if (existingSvg) existingSvg.remove();

    // Create the SVG container.
    const svg = createResponsiveSvg(width, height);

    // Keep a reference to the original raw data on the container so re-renders
    // (triggered by changing the selector) always use the complete data.
    // Accept either a flat array (legacy) or an object of named datasets
    // e.g. { population: [...], Deaths: [...] }
    const rawData = container.__pyramidRawData || data;
    // selected dataset key persists on the container between renders
    let datasetKey = container.__pyramidDatasetKey || 'population';
    let fullData;

    if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
        // rawData is an object with named datasets
        const keys = Object.keys(rawData);
        if (!rawData[datasetKey]) {
            // default to first available key if requested one isn't present
            datasetKey = keys[0];
        }
        fullData = rawData[datasetKey];
        container.__pyramidRawData = rawData;
        container.__pyramidDatasetKey = datasetKey;
        container.__pyramidFullData = fullData;
    } else {
        // rawData is already an array
        fullData = container.__pyramidFullData || rawData;
        container.__pyramidFullData = fullData;
        container.__pyramidRawData = null;
        container.__pyramidDatasetKey = null;
    }

    // NOTE: do NOT clear any running animation here - the animation should
    // continue across re-renders triggered by the play loop. The animation
    // is stopped explicitly when the user moves the slider manually or
    // when the play button is clicked again.

    // --- Controls UI (country + year selectors) ---
    const countries = Array.from(new Set(fullData.map(d => d.Country))).sort();
    const years = Array.from(new Set(fullData.map(d => d.Year))).sort((a, b) => b - a);

    // try to find an existing controls wrapper inside container
    let controls = container.querySelector('.pyramid-controls');
    if (!controls) {
        controls = document.createElement('div');
        controls.className = 'pyramid-controls';
        // layout: two centered rows
        controls.style.display = 'flex';
        controls.style.flexDirection = 'column';
        controls.style.alignItems = 'center';
        controls.style.gap = '8px';
        container.appendChild(controls);
    }

    // top row: dataset & country selectors
    let rowTop = controls.querySelector('.pyramid-controls-row-top');
    if (!rowTop) {
        rowTop = document.createElement('div');
        rowTop.className = 'pyramid-controls-row-top';
        rowTop.style.display = 'flex';
        rowTop.style.justifyContent = 'center';
        rowTop.style.alignItems = 'center';
        rowTop.style.gap = '10px';
        controls.appendChild(rowTop);
    }
    // bottom row: year slider + play
    let rowBottom = controls.querySelector('.pyramid-controls-row-bottom');
    if (!rowBottom) {
        rowBottom = document.createElement('div');
        rowBottom.className = 'pyramid-controls-row-bottom';
        rowBottom.style.display = 'flex';
        rowBottom.style.justifyContent = 'center';
        rowBottom.style.alignItems = 'center';
        rowBottom.style.gap = '10px';
        controls.appendChild(rowBottom);
    }

    // If the source provided multiple named datasets, expose a small selector
    // so the user can switch between e.g. population vs Deaths.
    if (container.__pyramidRawData) {
        let datasetSelect = controls.querySelector('.pyramid-dataset-select');
        if (!datasetSelect) {
            const dsLabel = document.createElement('label');
            dsLabel.textContent = 'Dataset: ';
            datasetSelect = document.createElement('select');
            datasetSelect.className = 'pyramid-dataset-select';

            Object.keys(container.__pyramidRawData).forEach(k => {
                const opt = document.createElement('option');
                opt.value = k;
                // make the label user-friendly
                opt.text = (k.toLowerCase() === 'population') ? 'Population' : k;
                datasetSelect.appendChild(opt);
            });

            // ensure current selection is set
            datasetSelect.value = container.__pyramidDatasetKey || Object.keys(container.__pyramidRawData)[0];

            // attach handler to switch dataset and re-render
            datasetSelect.addEventListener('change', () => {
                container.__pyramidDatasetKey = datasetSelect.value;
                // force re-render using the raw data object so internal logic selects the right key
                renderPyramidChart(container, container.__pyramidRawData, margins);
            });

            // insert selector into the top row
            rowTop.appendChild(dsLabel);
            rowTop.appendChild(datasetSelect);
        }
    }

    // COUNTRY select
    let countrySelect = controls.querySelector('.pyramid-country-select');
    if (!countrySelect) {
        const label = document.createElement('label');
        label.textContent = 'Country: ';

        countrySelect = document.createElement('select');
        countrySelect.className = 'pyramid-country-select';

        // populate options
        countries.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.text = c;
            countrySelect.appendChild(opt);
        });

        // default selection: keep Syrian Arab Republic if present, otherwise first
        const defaultCountry = countries[0];
        countrySelect.value = defaultCountry;

        rowTop.appendChild(label);
        rowTop.appendChild(countrySelect);
        // attach listener once when the control is created
        countrySelect.addEventListener('change', () => renderPyramidChart(container, fullData, margins));
    }

    // YEAR select
    // YEAR slider
    let yearSelect = controls.querySelector('.pyramid-year-select');
    if (!yearSelect) {
        const yLabel = document.createElement('label');
        yLabel.textContent = 'Year: ';

        // create a slider (range input) for years
        yearSelect = document.createElement('input');
        yearSelect.type = 'range';
        yearSelect.className = 'pyramid-year-select';
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        yearSelect.min = minYear;
        yearSelect.max = maxYear;
        yearSelect.step = 1;

        // display current value
        const yearDisplay = document.createElement('span');
        yearDisplay.className = 'pyramid-year-display';

        const defaultYear = years.includes(2023) ? 2023 : years[0];
        yearSelect.value = defaultYear;
        yearDisplay.textContent = defaultYear;

        // helper to update range fill (colored track up to thumb)
        function updateYearSliderFill() {
            const min = +yearSelect.min;
            const max = +yearSelect.max;
            const val = +yearSelect.value;
            const pct = (val - min) / (max - min) * 100;
            // set CSS variable used by the track pseudo-elements so the left side
            // of the track is painted with --color-unige-blue up to the thumb
            yearSelect.style.setProperty('--pct', `${pct}%`);
        }
        // initialize fill
        updateYearSliderFill();

        // update display when slider moves
        yearSelect.addEventListener('input', () => {
            yearDisplay.textContent = yearSelect.value;
            // update visual fill
            updateYearSliderFill();
            // live update the chart while sliding
            renderPyramidChart(container, fullData, margins);
            // if user moves the slider manually, stop any running animation
            if (container.__pyramidAnimationId) {
                clearInterval(container.__pyramidAnimationId);
                container.__pyramidAnimationId = null;
                const playBtn = controls.querySelector('.pyramid-play-btn');
                if (playBtn) playBtn.textContent = 'Play';
            }
        });

        // put year controls into the bottom row
        rowBottom.appendChild(yLabel);
        rowBottom.appendChild(yearSelect);
        rowBottom.appendChild(yearDisplay);

        // Play/Stop button to animate the slider through the years
        let playBtn = controls.querySelector('.pyramid-play-btn');
        if (!playBtn) {
            playBtn = document.createElement('button');
            playBtn.className = 'pyramid-play-btn';
            playBtn.textContent = 'Play';
            rowBottom.appendChild(playBtn);

            playBtn.addEventListener('click', () => {
                // toggle animation
                if (container.__pyramidAnimationId) {
                    clearInterval(container.__pyramidAnimationId);
                    container.__pyramidAnimationId = null;
                    playBtn.textContent = 'Play';
                    return;
                }

                playBtn.textContent = 'Stop';
                const minY = +yearSelect.min;
                const maxY = +yearSelect.max;
                let current = +yearSelect.value || minY;
                // if currently at max, start from min
                if (current >= maxY) current = minY - 1;
                const stepMs = 400; // milliseconds per year step
                container.__pyramidAnimationId = setInterval(() => {
                    current += 1;
                    if (current > maxY) {
                        clearInterval(container.__pyramidAnimationId);
                        container.__pyramidAnimationId = null;
                        playBtn.textContent = 'Play';
                        return;
                    }
                    yearSelect.value = current;
                    const disp = controls.querySelector('.pyramid-year-display');
                    if (disp) disp.textContent = current;
                    // update fill before rendering
                    updateYearSliderFill();
                    renderPyramidChart(container, fullData, margins);
                }, stepMs);
            });
        }
    }

    // listeners are attached when controls are created (to avoid duplicate handlers on re-render)

    // determine selected country and year and filter data (use fullData as the source)
    const selectedCountry = countrySelect.value || (countries[0]);
    const selectedYear = yearSelect.value || (years.includes(2022) ? 2022 : years[0]);
    data = fullData.filter(d => d.Year == selectedYear && d.Country === selectedCountry);

    // Process data
    const ageGroups = Array.from(new Set(data.map(d => d.Age_Group_5yr)));
    const maleData = data.filter(d => d.Sex === "Male");
    const femaleData = data.filter(d => d.Sex === "Female");

    // Scales
    const x = d3.scaleLinear()
        .domain([-d3.max(data, d => d.Population) || 0, d3.max(data, d => d.Population) || 0])
        .range([margins.left, width - margins.right]);

    const y = d3.scaleBand()
        .domain(ageGroups)
        .range([height - margins.bottom, margins.top])
        .padding(0.1);

    // Axes
    const xAxis = d3.axisBottom(x)
        .ticks(5)
        .tickFormat(d => Math.abs(d) + "k");

    const yAxis = d3.axisLeft(y);

    const centerGap = 40;
    const centerX = x(0);
    const availableLeft = centerX - margins.left;
    const availableRight = (width - margins.right) - centerX;
    const maxPop = d3.max(data, d => d.Population) || 0;

    // scales map population value -> pixel length from the center outward
    const xLeft = d3.scaleLinear()
        .domain([0, maxPop])
        .range([0, Math.max(0, availableLeft - centerGap / 2)]);

    const xRight = d3.scaleLinear()
        .domain([0, maxPop])
        .range([0, Math.max(0, availableRight - centerGap / 2)]);

    const yAxisG = svg.append("g")
        .attr("transform", `translate(${x(0)},0)`)
        .call(yAxis);

    // center the tick labels so they sit between the male and female bars
    yAxisG.selectAll("text")
        .attr("x", 0)
        .attr("text-anchor", "middle");

    // shorten/hide tick lines so they don't extend into bars
    yAxisG.selectAll("line").attr("x2", 0);

    yAxisG.selectAll("path").attr("stroke", "none");
    yAxisG.selectAll("line").attr("stroke", "none");

    // Draw bars for males (use inner band y1 and shift outward by half centerGap without changing width)
    svg.append("g")
        .selectAll(".bar.male")
        .data(maleData)
        .join("rect")
        .attr("class", "bar male")
        // position so the bar starts from the center and extends leftwards using xLeft
        .attr("x", d => centerX - centerGap / 2 - xLeft(d.Population))
        .attr("y", d => (y(d.Age_Group_5yr) || 0))
        // width proportional to male population using the left-side scale
        .attr("width", d => xLeft(d.Population))
        .attr("height", y.bandwidth());

    svg.append("g")
        .attr("font-size", 12)
        .selectAll("text")
        .data(maleData)
        .join("text")
        .attr("y", d => (y(d.Age_Group_5yr) ?? 0) + y.bandwidth() / 2)
        .attr("x", d => {
            const barStart = centerX - centerGap / 2 - xLeft(d.Population);
            const barEnd = centerX - centerGap / 2;
            const barWidth = Math.max(0, barEnd - barStart);
            // place inside when there's enough room, otherwise outside
            return barWidth > 40 ? barStart + 6 : barStart - 6;
        })
        .attr("dy", "0.35em")
        .attr("text-anchor", d => {
            const barStart = centerX - centerGap / 2 - xLeft(d.Population);
            const barEnd = centerX - centerGap / 2;
            const barWidth = Math.max(0, barEnd - barStart);
            return barWidth > 40 ? "start" : "end";
        })
        .attr("fill", d => {
            const barStart = centerX - centerGap / 2 - xLeft(d.Population);
            const barEnd = centerX - centerGap / 2;
            return (barEnd - barStart > 40) ? "white" : "currentColor";
        })
        .text(d => d3.format('.2f')(+d.Population) + "k");



    // Draw bars for females (use inner band y1 and start at center + gap, extend rightwards using xRight)
    svg.append("g")
        .selectAll(".bar.female")
        .data(femaleData)
        .join("rect")
        .attr("class", "bar female")
        .attr("x", d => centerX + centerGap / 2)
        .attr("y", d => (y(d.Age_Group_5yr) || 0))
        .attr("width", d => xRight(d.Population))
        .attr("height", y.bandwidth());

    svg.append("g")
        .attr("font-size", 12)
        .selectAll("text")
        .data(femaleData)
        .join("text")
        .attr("y", d => (y(d.Age_Group_5yr) ?? 0) + y.bandwidth() / 2)
        .attr("x", d => {
            const barStart = centerX + centerGap / 2;
            const barEnd = centerX + centerGap / 2 + xRight(d.Population);
            const barWidth = Math.max(0, barEnd - barStart);
            // place inside when there's enough room, otherwise outside
            return barWidth > 40 ? barEnd - 6 : barEnd + 6;
        })
        .attr("dy", "0.35em")
        .attr("text-anchor", d => {
            const barStart = centerX + centerGap / 2;
            const barEnd = centerX + centerGap / 2 + xRight(d.Population);
            const barWidth = Math.max(0, barEnd - barStart);
            return barWidth > 40 ? "end" : "start";
        })
        .attr("fill", d => {
            const barStart = centerX + centerGap / 2;
            const barEnd = centerX + centerGap / 2 + xRight(d.Population);
            return (barEnd - barStart > 40) ? "white" : "currentColor";
        })
        .text(d => d3.format('.2f')(+d.Population) + "k");


    // Y axis label centered along the shared y-axis
    svg.append("text")
        .attr("x", (width + centerGap / 2) / 2)
        .attr("y", margins.top / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", 15)
        .text("Age");

    container.appendChild(svg.node());

    // --- Add legend to top right ---
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
