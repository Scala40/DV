import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';

export function renderBarChart(container, data, margins) {
    const { width, height } = getContainerDimensions(container);

    // clear previous content
    container.innerHTML = "";

    // create responsive svg that fills its parent
    const svg = createResponsiveSvg(width, height);

    // horizontal layout: x = value, y = category
    const x = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.fatalities) || 0])
        .nice()
        .range([margins.left, width - margins.right]);

    const y = d3.scaleBand()
        .domain(data.map(d => d.country))
        .range([margins.top, height - margins.bottom])
        .padding(0.12);

    // grid
    svg.append("g")
        .attr("stroke", "lightgray")
        .attr("stroke-opacity", 0.8)
        .selectAll("line")
        //.data(x.ticks(10))
        .join("line")
        .attr("x1", d => x(d))
        .attr("x2", d => x(d))
        .attr("y1", margins.top)
        .attr("y2", height - margins.bottom);
    
    // tick formatter used for axis
    const formatK = d3.format(".2s"); // produces 10k, 1M, etc.

    // bars (horizontal)
    svg.append("g")
        .attr("fill", "steelblue")
        .selectAll("rect")
        .data(data)
        .join("rect")
        .attr("y", d => y(d.country))
        .attr("x", _ => x(0))
        .attr("height", y.bandwidth())
        .attr("width", d => Math.max(0, x(d.fatalities) - x(0)));

    // labels on/near bars (value labels)
    svg.append("g")
        .attr("font-size", 12)
        .selectAll("text")
        .data(data)
        .join("text")
        .attr("y", d => (y(d.country) ?? 0) + y.bandwidth() / 2)
        .attr("x", d => {
            const barStart = x(0);
            const barEnd = x(d.fatalities);
            const barWidth = Math.max(0, barEnd - barStart);
            // place inside when there's enough room, otherwise outside
            return barWidth > 40 ? barEnd - 6 : barEnd + 6;
        })
        .attr("dy", "0.35em")
        .attr("text-anchor", d => {
            const barStart = x(0);
            const barEnd = x(d.fatalities);
            const barWidth = Math.max(0, barEnd - barStart);
            return barWidth > 40 ? "end" : "start";
        })
        .attr("fill", d => (x(d.fatalities) - x(0) > 40 ? "white" : "currentColor"))
        .text(d => d.fatalities);
    /*
    // x axis (values) with "k" formatting (e.g. 10k)
    svg.append("g")
        .attr("transform", `translate(0, ${height - margins.bottom})`)
        .call(d3.axisBottom(x)
            .ticks(10)
            .tickFormat(formatK)
            .tickSizeOuter(0))
        .call(g => g.select(".domain").remove());
    */
    // y axis (categories)
    svg.append("g")
        .attr("transform", `translate(${margins.left},0)`)
        .call(d3.axisLeft(y).tickSizeOuter(0))
        .call(g => g.select(".domain").remove());

    /*
    const title = "Fatalities in Middle Eastern countries (2020-today)";
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", margins.top / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", 14)
        .attr("font-weight", "bold")
        .text(title);
    */
    // append the svg to the container
    container.appendChild(svg.node());
}
