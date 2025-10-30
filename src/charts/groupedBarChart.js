import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';

export function renderGroupedBarChart(container, data, margins) {
    const { width, height } = getContainerDimensions(container);

    // clear previous content
    container.innerHTML = "";

    // Build list of event types and countries sorted by total fatalities (desc).
    const eventTypes = Array.from(new Set(data.map(d => d.eventType)));

    // Sum fatalities per country and sort countries by total (largest first).
    const countryTotals = d3.rollup(data, v => d3.sum(v, d => d.events), d => d.country);
    const countries = Array.from(countryTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([country]) => country);

    // x0 positions each country's group horizontally.
    const x0 = d3.scaleBand()
        .domain(countries)
        .range([margins.left, width - margins.right])
        .paddingInner(0.12);

    // x1 positions event types inside each country's band.
    const x1 = d3.scaleBand()
        .domain(eventTypes)
        .range([0, x0.bandwidth()])
        .padding(0.05);

    // y is the linear scale for fatalities (vertical height of bars).
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.events) || 0])
        .nice()
        .range([height - margins.bottom, margins.top]);

    // color per event type; safe fallback palette if needed.
    const spectral = d3.schemeSpectral[eventTypes.length];
    const fallback = d3.schemeTableau10;
    const color = d3.scaleOrdinal()
        .domain(eventTypes)
        .range(spectral && spectral.length === eventTypes.length ? spectral : eventTypes.map((_, i) => fallback[i % fallback.length]))
        .unknown("#ccc");

    // Create the SVG container.
    const svg = createResponsiveSvg(width, height);

    // Create one group per country and translate it into place horizontally.
    const countryGroups = svg.append("g")
        .selectAll("g")
        .data(countries)
        .join("g")
        .attr("transform", d => `translate(${x0(d)},0)`);

    // For each country, draw rects only for event types present in the data.
    countryGroups.selectAll("rect")
        .data(country => data.filter(d => d.country === country))
        .join("rect")
        .attr("x", d => x1(d.eventType))
        .attr("y", d => y(d.events))
        .attr("width", x1.bandwidth())
        .attr("height", d => Math.max(0, y(0) - y(d.events)))
        .attr("fill", d => color(d.eventType));

    // Append the x axis (countries) at the bottom and rotate labels 45°.
    svg.append("g")
        .attr("transform", `translate(0,${height - margins.bottom})`)
        .call(d3.axisBottom(x0).tickSizeOuter(0))
        .call(g => g.selectAll(".domain").remove())
        .call(g => g.selectAll("text")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end")
            .attr("dx", "-0.6em")
            .attr("dy", "0.25em")
        );

    // Append the y axis (events) on the left.
    const formatK = d3.format(".2s");
    svg.append("g")
        .attr("transform", `translate(${margins.left},0)`)
        .call(d3.axisLeft(y).ticks(null, "s").tickFormat(formatK))
        .call(g => g.selectAll(".domain").remove());

    // Legend: event types with color swatches.
    const legendX = width - margins.right - 160;
    const legendY = margins.top;
    const legend = svg.append("g")
        .attr("transform", `translate(${legendX},${legendY})`);

    const legendItem = legend.selectAll("g")
        .data(eventTypes)
        .join("g")
        .attr("transform", (d, i) => `translate(0, ${i * 20})`);

    legendItem.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", d => color(d));

    legendItem.append("text")
        .attr("x", 18)
        .attr("y", 10)
        .attr("font-size", 12)
        .attr("fill", "#111")
        .text(d => d);

    const title = "Events types in Middle Eastern countries (2020-today)";
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", margins.top / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", 14)
        .attr("font-weight", "bold")
        .text(title);

    // Append the SVG to the container.
    container.appendChild(svg.node());
}
