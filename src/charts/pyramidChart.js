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

    // Draw axes
    svg.append("g")
        .attr("transform", `translate(0,${height - margins.bottom})`)
        .call(xAxis);

    svg.append("g")
        .attr("transform", `translate(${margins.left},0)`)
        .call(yAxis);

    // Draw bars for males
    svg.append("g")
        .selectAll(".bar.male")
        .data(maleData)
        .join("rect")
        .attr("class", "bar male")
        .attr("x", d => x(-d.Population))
        .attr("y", d => y(d.Age_Group_5yr) || 0)
        .attr("width", d => x(0) - x(-d.Population))
        .attr("height", y.bandwidth())
        .attr("fill", "#1f77b4");

    svg.append("g")
        .attr("fill", "white")
        .selectAll("text")
        .data(maleData)
        .join("text")
        .attr("text-anchor", "start")
        .attr("x", d => x(-d.Population) + 4)
        .attr("y", d => y(d.Age_Group_5yr) + y.bandwidth() / 2)
        .attr("dy", "0.35em")
        .text(d => parseInt(d.Population));

    // Draw bars for females
    svg.append("g")
        .selectAll(".bar.female")
        .data(femaleData)
        .join("rect")
        .attr("class", "bar female")
        .attr("x", x(0))
        .attr("y", d => y(d.Age_Group_5yr) || 0)
        .attr("width", d => x(d.Population) - x(0))
        .attr("height", y.bandwidth())
        .attr("fill", "#ff7f0e");

    svg.append("g")
        .attr("fill", "white")
        .selectAll("text")
        .data(femaleData)
        .join("text")
        .attr("text-anchor", "end")
        .attr("x", d => x(d.Population) - 4)
        .attr("y", d => y(d.Age_Group_5yr) + y.bandwidth() / 2)
        .attr("dy", "0.35em")
        .text(d => parseInt(d.Population));

    // Append the SVG to the container
    container.appendChild(svg.node());
}
