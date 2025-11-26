import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';

export async function renderBarChart(container, data, margins) {
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

    // Small label to indicate these are fatalities
    svg.append("text")
        .attr("x", x(0))
        .attr("y", Math.max(12, margins.top - 6))
        .attr("font-size", 12)
        .attr("fill", "currentColor")
        .text("Fatalities ￫");

    // bars (horizontal) - use CSS class so color comes from stylesheet (UniGe blue)
    svg.append("g")
        .selectAll("rect")
        .data(data)
        .join("rect")
        .attr("class", "bar-unige")
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

    // y axis (categories)
    svg.append("g")
        .attr("transform", `translate(${margins.left},0)`)
        .call(d3.axisLeft(y).tickSizeOuter(0))
        .call(g => g.select(".domain").remove())

    // append the svg to the container
    container.appendChild(svg.node());
}
