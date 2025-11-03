import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';

export function renderCirclePackingChart(container, data, margins) {
    const { width, height } = getContainerDimensions(container);

    // clear previous content
    container.innerHTML = "";

    // create responsive svg that fills its parent
    const svg = createResponsiveSvg(width, height);

    // artificially increase small values to ensure visibility
    const customData = data.map(d => ({
        country: d.country,
        fatalities: d.fatalities,
        adjustedFatalities: d.fatalities < 50 ? d.fatalities + 40 : d.fatalities
    }));

    // prepare hierarchy for packing
    const root = d3.hierarchy({ children: customData })
        .sum(d => Math.max(0, +d.adjustedFatalities))
        .sort((a, b) => b.value - a.value);

    const innerWidth = Math.max(0, width - margins.left - margins.right);
    const innerHeight = Math.max(0, height - margins.top - margins.bottom);

    const pack = d3.pack()
        .size([innerWidth, innerHeight])
        .padding(6);

    pack(root);

    const g = svg.append("g")
        .attr("transform", `translate(${margins.left},${margins.top})`);

    // color scale for countries
    const color = d3.scaleOrdinal(d3.schemeTableau10)
        .domain(data.map(d => d.country));

    // node groups positioned at computed x/y. We'll add an inner group to scale around center.
    const nodes = g.selectAll("g.node")
        .data(root.leaves())
        .join("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .style("cursor", "pointer");

    const inner = nodes.append("g")
        .attr("class", "inner")
        .attr("transform", "scale(1)");

    // circles
    inner.append("circle")
        .attr("r", d => d.r)
        .attr("fill", d => color(d.data.country))
        .attr("stroke", "rgba(0,0,0,0.15)");

    // Country label (always created, but hidden for small circles)
    inner.append("text")
        .attr("class", "label-country")
        .attr("text-anchor", "middle")
        .attr("dy", d => d.r > 22 ? "-0.25em" : "0em")
        .attr("pointer-events", "none")
        .attr("font-size", d => Math.max(9, Math.min(14, d.r / 3)))
        .attr("fill", "black")
        .style("opacity", d => d.r > 16 ? 1 : 0) // hide small ones initially
        .text(d => d.data.country);

    // Fatalities label (always created, but hidden for small circles)
    inner.append("text")
        .attr("class", "label-fatalities")
        .attr("text-anchor", "middle")
        .attr("dy", "1.1em")
        .attr("pointer-events", "none")
        .attr("font-size", d => Math.max(9, Math.min(12, d.r / 4)))
        .attr("fill", "black")
        .style("opacity", d => d.r > 16 ? 1 : 0) // hide small ones initially
        .text(d => d.data.fatalities);

    // Hover interaction: zoom (scale) the inner group and reveal labels for the hovered node.
    nodes
        .on("mouseenter", function (_, d) {
            // bring to front
            d3.select(this).raise();

            const innerG = d3.select(this).select(".inner");
            // target radius we want the hovered circle to appear as (px)
            const targetRadius = 36;
            const scale = Math.min(4, Math.max(1.2, targetRadius / d.r));

            // enlarge smoothly
            innerG.transition()
                .duration(180)
                .attr("transform", `scale(${scale})`);

            // reveal labels for this hovered node
            d3.select(this).selectAll(".label-country")
                .transition().duration(120)
                .style("opacity", 1)
                .attr("font-size", Math.max(10, Math.min(18, (d.r * scale) / 3)));

            d3.select(this).selectAll(".label-fatalities")
                .transition().duration(120)
                .style("opacity", 1)
                .attr("font-size", Math.max(10, Math.min(16, (d.r * scale) / 4)));
        })
        .on("mouseleave", function (event, d) {
            const innerG = d3.select(this).select(".inner");

            // revert scale
            innerG.transition()
                .duration(160)
                .attr("transform", "scale(1)");

            // restore label visibility based on original radius thresholds
            d3.select(this).selectAll(".label-country")
                .transition().duration(120)
                .style("opacity", d => d.r > 15 ? 1 : 0)
                .attr("font-size", d => Math.max(9, Math.min(14, d.r / 3)));

            d3.select(this).selectAll(".label-fatalities")
                .transition().duration(120)
                .style("opacity", d => d.r > 20 ? 1 : 0)
                .attr("font-size", d => Math.max(9, Math.min(12, d.r / 4)));
        });

    // append the svg to the container
    container.appendChild(svg.node());
}
