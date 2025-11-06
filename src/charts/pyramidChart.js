import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';

export function renderPyramidChart(container, data, margins) {
    const { width, height } = getContainerDimensions(container);

    // clear previous SVG but keep any controls (like the country selector) intact
    const existingSvg = container.querySelector('svg');
    if (existingSvg) existingSvg.remove();

    // Create the SVG container.
    const svg = createResponsiveSvg(width, height);

    console.log(data);

    // Keep a reference to the original full dataset on the container so re-renders
    // (triggered by changing the selector) always use the complete data.
    let fullData = container.__pyramidFullData || data;
    container.__pyramidFullData = fullData;

    // --- Controls UI (country + year selectors) ---
    const countries = Array.from(new Set(fullData.map(d => d.Country))).sort();
    const years = Array.from(new Set(fullData.map(d => d.Year))).sort((a, b) => b - a);

    // try to find an existing controls wrapper inside container
    let controls = container.querySelector('.pyramid-controls');
    if (!controls) {
        controls = document.createElement('div');
        controls.className = 'pyramid-controls';
        controls.style.marginBottom = '8px';
        container.appendChild(controls);
    }

    // COUNTRY select
    let countrySelect = controls.querySelector('.pyramid-country-select');
    if (!countrySelect) {
        const label = document.createElement('label');
        label.textContent = 'Country: ';
        label.style.marginRight = '6px';

        countrySelect = document.createElement('select');
        countrySelect.className = 'pyramid-country-select';
        countrySelect.style.minWidth = '220px';

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
    }

    // YEAR select
    let yearSelect = controls.querySelector('.pyramid-year-select');
    if (!yearSelect) {
        const yLabel = document.createElement('label');
        yLabel.textContent = 'Year: ';
        yLabel.style.margin = '0 6px 0 12px';

        yearSelect = document.createElement('select');
        yearSelect.className = 'pyramid-year-select';
        yearSelect.style.minWidth = '100px';

        years.forEach(y => {
            const opt = document.createElement('option');
            opt.value = y;
            opt.text = y;
            yearSelect.appendChild(opt);
        });

        const defaultYear = years.includes(2022) ? 2022 : years[0];
        yearSelect.value = defaultYear;

        controls.appendChild(yLabel);
        controls.appendChild(yearSelect);
    }

    // when either selection changes, re-render the chart using the original full data
    countrySelect.addEventListener('change', () => renderPyramidChart(container, fullData, margins));
    yearSelect.addEventListener('change', () => renderPyramidChart(container, fullData, margins));

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

    console.log(y.domain());

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

    // axis scales map 0..max -> pixel positions so we can draw independent axis ticks for each side
    const axisLeftScale = d3.scaleLinear()
        .domain([0, maxPop])
        .range([centerX - centerGap / 2, centerX - (xLeft(maxPop))]);

    const axisRightScale = d3.scaleLinear()
        .domain([0, maxPop])
        .range([centerX + centerGap / 2, centerX + (xRight(maxPop))]);

    const xAxisLeft = d3.axisBottom(axisLeftScale)
        .ticks(5)
        .tickFormat(d => Math.abs(d) + "k");

    const xAxisRight = d3.axisBottom(axisRightScale)
        .ticks(5)
        .tickFormat(d => Math.abs(d) + "k");
    // Draw axes

    // x axes for left and right (each side has its own independent scale)
    /*
    svg.append("g")
        .attr("transform", `translate(0,${height - margins.bottom})`)
        .call(xAxisLeft);

    svg.append("g")
        .attr("transform", `translate(0,${height - margins.bottom})`)
        .call(xAxisRight);
    */
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
        .attr("height", y.bandwidth())
        .attr("fill", "#1f77b4");

    svg.append("g")
        .attr("font-size", 12)
        .selectAll("text")
        .data(maleData)
        .join("text")
        .attr("y", d => (y(d.Age_Group_5yr) ?? 0)+ y.bandwidth() / 2)
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
        .attr("height", y.bandwidth())
        .attr("fill", "#ff7f0e");

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
        .attr("x", (width + centerGap/2) / 2)
        .attr("y", margins.top/2)
        .attr("text-anchor", "middle")
        .attr("font-size", 15)
        .text("Age");

    container.appendChild(svg.node());

        // --- Add legend to top right ---
        const legendData = [
            { label: "Male", color: "#1f77b4" },
            { label: "Female", color: "#ff7f0e" }
        ];

        const legendWidth = 120;
        const legendHeight = 50;
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
            .attr("fill", d => d.color);

        legend.selectAll("text")
            .data(legendData)
            .join("text")
            .attr("x", 26)
            .attr("y", (d, i) => i * 22 + 13)
            .attr("font-size", 14)
            .text(d => d.label);
}
