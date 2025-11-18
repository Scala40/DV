import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';

import geoJson from "../geojson/custom.geo.json" assert { type: "json" };

export function renderGeoChart(container, data, margins) {
    const { width, height } = getContainerDimensions(container);

    // clear previous content
    container.innerHTML = "";

    // create responsive svg that fills its parent
    const svg = createResponsiveSvg(width, height);

    // layout calculations (respect margins on all sides)
    const innerWidth = Math.max(100, width - margins.left - margins.right);
    const innerHeight = Math.max(100, height - margins.top - margins.bottom);

    // Projection centered on the Middle East
    const projection = d3.geoMercator()
        .center([45, 30]) // long, lat
        .scale(700)
        .translate([margins.left + innerWidth / 2, margins.top + innerHeight / 2]);

    const path = d3.geoPath().projection(projection);

    // Draw boundaries
    svg.selectAll("path")
        .data(geoJson.features)
        .join("path")
        .attr("d", path)
        .attr("fill", "#e9ecef")
        .attr("stroke", "#999");

    // Color scale
    // make the start of the scale a bit higher to avoid very light colors

    const startT = 0.40; // increase to make the low end more saturated
    const colorScale = d3.scaleSequential(
        t => d3.interpolateYlOrRd(startT + (1 - startT) * t)
    ).domain([0, d3.max(data, d => d.events)]);
    // Draw points / heatmap
    svg.selectAll("circle")
        .data(data)
        .join("circle")
        .attr("cx", d => projection([d.lon, d.lat])[0])
        .attr("cy", d => projection([d.lon, d.lat])[1])
        .attr("r", d => Math.log10(d.events + 1) * 3) // radius based on number of events
        .attr("fill", d => colorScale(d.events))
        .attr("fill-opacity", 0.6)
        .attr("stroke", "none");

    //add colorbar legend
    const legendWidth = innerWidth * 0.02;
    const legendHeight = innerHeight;
    const legendMargin = 50;
    const legendScale = d3.scaleLinear()
        .domain(colorScale.domain())
        .range([legendHeight, 0]);
    // Format ticks using SI-style short format (1k, 1M) and ensure max tick is shown
    const legendFormat = d3.format('.2s');
    const maxEvents = d3.max(data, d => d.events) || 0;
    let legendTicks = d3.ticks(0, maxEvents, 6);
    // Ensure the maximum value is present as the last tick
    if (legendTicks[legendTicks.length - 1] < maxEvents) {
        legendTicks.push(maxEvents);
    }
    const legendAxis = d3.axisRight(legendScale)
        .tickValues(legendTicks)
        .tickFormat(legendFormat)
        .tickSize(6);
    const legend = svg.append("g")
        .attr("transform", `translate(${width - margins.right - legendMargin}, ${margins.top})`);
    // create gradient
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
        .attr("id", "legend-gradient")
        .attr("x1", "0%")
        .attr("y1", "100%")
        .attr("x2", "0%")
        .attr("y2", "0%");
    const stops = d3.range(0, 1.01, 0.01);
    stops.forEach(t => {
        gradient.append("stop")
            .attr("offset", `${t * 100}%`)
            .attr("stop-color", colorScale(t * d3.max(data, d => d.events)));
    }
    );
    // draw legend rect
    legend.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#legend-gradient)")
        .attr("stroke", "#ccc");
    // draw legend axis (positioned at right edge of the gradient rect)
    legend.append("g")
        .attr("transform", `translate(${legendWidth}, 0)`)
        .call(legendAxis);

    // remove legend domain line
    legend.selectAll(".domain").remove();

    

    container.appendChild(svg.node());
}
