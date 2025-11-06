import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';

export function renderPyramidChart(container, data, margins) {
    const { width, height } = getContainerDimensions(container);

    // clear previous content
    container.innerHTML = "";

    // Create the SVG container.
    const svg = createResponsiveSvg(width, height);

    console.log(data);

    data = data.filter(d => d.Year == 2022);
    data = data.filter(d => d.Country === "Syrian Arab Republic");

    // Process data
    const ageGroups = Array.from(new Set(data.map(d => d.Age_Group_5yr)));
    const maleData = data.filter(d => d.Sex === "Male");
    const femaleData = data.filter(d => d.Sex === "Female");

    console.log(ageGroups);
    console.log(maleData);
    console.log(femaleData);

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
    // compute separate scales for left (male) and right (female) so each side can have its own x axis
    const maxMale = d3.max(maleData, d => d.Population) || 0;
    const maxFemale = d3.max(femaleData, d => d.Population) || 0;
    const centerX = x(0);
    const availableLeft = centerX - margins.left;
    const availableRight = (width - margins.right) - centerX;

    // scales map population value -> pixel length from the center outward
    const xLeft = d3.scaleLinear()
        .domain([0, maxMale])
        .range([0, Math.max(0, availableLeft - centerGap / 2)]);

    const xRight = d3.scaleLinear()
        .domain([0, maxFemale])
        .range([0, Math.max(0, availableRight - centerGap / 2)]);

    // axis scales map 0..max -> pixel positions so we can draw independent axis ticks for each side
    const axisLeftScale = d3.scaleLinear()
        .domain([0, maxMale])
        .range([centerX - centerGap / 2, centerX - (xLeft(maxMale))]);

    const axisRightScale = d3.scaleLinear()
        .domain([0, maxFemale])
        .range([centerX + centerGap / 2, centerX + (xRight(maxFemale))]);

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

    // Axis labels
    svg.append("text")
        .attr("x", (width + centerGap/2) / 3)
        .attr("y", margins.top/2)
        .attr("text-anchor", "middle")
        .attr("font-size", 15)
        .text("Male");

    svg.append("text")
        .attr("x", (width + centerGap/2) * 2 / 3)
        .attr("y", margins.top/2)
        .attr("text-anchor", "middle")
        .attr("font-size", 15)
        .text("Female");

    // Y axis label centered along the shared y-axis
    svg.append("text")
        .attr("x", (width + centerGap/2) / 2)
        .attr("y", margins.top/2)
        .attr("text-anchor", "middle")
        .attr("font-size", 15)
        .text("Age");

    container.appendChild(svg.node());
}
