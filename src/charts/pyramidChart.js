import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';

export function renderPyramidChart(container, data, margins) {
    const { width, height } = getContainerDimensions(container);

    // clear previous SVG but keep any controls (like the country selector) intact
    const existingSvg = container.querySelector('svg');
    if (existingSvg) existingSvg.remove();

    // Create the SVG container.
    const svg = createResponsiveSvg(width, height);

    // Keep a reference to the original full dataset on the container so re-renders
    // (triggered by changing the selector) always use the complete data.
    let fullData = container.__pyramidFullData || data;
    container.__pyramidFullData = fullData;

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
        container.appendChild(controls);
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
        const defaultCountry = countries.includes('Syrian Arab Republic') ? 'Syrian Arab Republic' : countries[0];
        countrySelect.value = defaultCountry;

        controls.appendChild(label);
        controls.appendChild(countrySelect);
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

        controls.appendChild(yLabel);
        controls.appendChild(yearSelect);
        controls.appendChild(yearDisplay);

        // Play/Stop button to animate the slider through the years
        let playBtn = controls.querySelector('.pyramid-play-btn');
        if (!playBtn) {
            playBtn = document.createElement('button');
            playBtn.className = 'pyramid-play-btn';
            playBtn.textContent = 'Play';
            controls.appendChild(playBtn);

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
    const selectedCountry = countrySelect.value || (countries.includes('Syrian Arab Republic') ? 'Syrian Arab Republic' : countries[0]);
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
