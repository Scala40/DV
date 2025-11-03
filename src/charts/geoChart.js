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
    const colorScale = d3.scaleSequential(d3.interpolateViridis)
        .domain([0, d3.max(data, d => d.events) || 1]);

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

    container.appendChild(svg.node());
}
