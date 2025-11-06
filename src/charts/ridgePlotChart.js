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
    container.innerHTML = "";

    // --- Year Filter Buttons ---
    const years = [2020, 2021, 2022, 2023, 2024, 2025];
    const buttonContainer = document.createElement("div");
    buttonContainer.style.textAlign = "center";
    buttonContainer.style.margin = "16px 0";

    let selectedYear = years[0];

    years.forEach(year => {
        const btn = document.createElement("button");
        btn.textContent = year;
        btn.style.margin = "0 4px";
        btn.style.padding = "6px 16px";
        btn.style.borderRadius = "6px";
        btn.style.border = "1px solid #888";
        btn.style.background = year === selectedYear ? "#4f8cff" : "#f0f0f0";
        btn.style.color = year === selectedYear ? "#fff" : "#222";
        btn.style.cursor = "pointer";
        btn.onclick = () => {
            selectedYear = year;
            render(selectedYear);
        };
        buttonContainer.appendChild(btn);
    });
    container.appendChild(buttonContainer);

    function render(year) {
        // Update button styles
        Array.from(buttonContainer.children).forEach((btn, i) => {
            btn.style.background = years[i] === year ? "#4f8cff" : "#f0f0f0";
            btn.style.color = years[i] === year ? "#fff" : "#222";
        });

        // Remove previous chart if exists
        const oldSvg = container.querySelector("svg");
        if (oldSvg) oldSvg.remove();

        // Filter data by year
        const filteredData = data.filter(d => {
            const date = new Date(d.week);
            return date.getFullYear() === year;
        });

        // Create the SVG container.
        const svg = createResponsiveSvg(width, height);
        const processed = processAndVisualize(filteredData);

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

            // Country label (placed just left of the plotting area)
            g.append("text")
                .attr("class", "country-label")
                .attr("x", -10)
                .attr("y", ridgeHeight / 2)
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .text(countryData.country);
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
            .attr("y", innerHeight + Math.max(0, margins.bottom - 10))
            .attr("text-anchor", "middle")
            .style("font-weight", "bold")
            .style("font-size", "14px")
            .text("Day of Year");

        // Append the SVG to the container
        container.appendChild(svg.node());
    }

    // Initial render
    render(selectedYear);
}
