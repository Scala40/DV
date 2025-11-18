import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';

import geoJson from "../geojson/custom.geo.json" assert { type: "json" };

export function renderGeoChart(container, data, margins) {
    const { width, height } = getContainerDimensions(container);

    // Clear previous content
    container.innerHTML = "";
    container.style.position = container.style.position || "relative";

    // Create responsive svg that fills its parent
    const svg = createResponsiveSvg(width, height);

    // Layout calculations (respect margins on all sides)
    const innerWidth = Math.max(100, width - margins.left - margins.right);
    const innerHeight = Math.max(100, height - margins.top - margins.bottom);

    // Projection centered on the Middle East
    const projection = d3.geoMercator()
        .center([45, 30]) // long, lat
        .scale(700)
        .translate([margins.left + innerWidth / 2, margins.top + innerHeight / 2]);

    const path = d3.geoPath().projection(projection);

    // Create a main group that will be transformed by zoom/pan
    const mainGroup = svg.append("g")
        .attr("class", "map-layer");

    // Draw boundaries
    mainGroup.selectAll("path")
        .data(geoJson.features)
        .join("path")
        .attr("d", path)
        .attr("fill", "#e9ecef")
        .attr("stroke", "#999")
        .attr("pointer-events", "all")
        .style("cursor", "default")
        .on("mouseover", function (_, d) {
            d3.select(this).attr("fill", "#d1d5db");

            // Resolve a sensible country name property from common naming fields
            const name = d.properties && (d.properties.name) || "Unknown";

            tooltip.style("display", "block")
                .html(`<strong>${name}</strong>`);
        })
        .on("mousemove", function (event) {
            // position tooltip relative to container
            const [mx, my] = d3.pointer(event, container);
            const tooltipWidth = 180;
            const left = Math.min(mx + 12, width - tooltipWidth - 10);
            tooltip.style("left", `${left}px`)
                .style("top", `${my + 12}px`);
        })
        .on("mouseout", function (event, d) {
            d3.select(this).attr("fill", "#e9ecef");
            tooltip.style("display", "none");
        });

    // Color scale
    // make the start of the scale a bit higher to avoid very light colors
    const startT = 0.40;
    const maxEvents = d3.max(data, d => d.events) || 0;
    const colorScale = d3.scaleSequential(
        t => d3.interpolateYlOrRd(startT + (1 - startT) * t)
    ).domain([0, maxEvents]);

    // Draw points / heatmap (inside mainGroup)
    const points = mainGroup.selectAll("circle")
        .data(data)
        .join("circle")
        .attr("cx", d => projection([d.lon, d.lat])[0])
        .attr("cy", d => projection([d.lon, d.lat])[1])
        .attr("r", d => Math.log10(d.events + 1) * 3) // radius based on number of events
        .attr("fill", d => colorScale(d.events))
        .attr("fill-opacity", 0.6)
        .attr("stroke", "none")
        .style("cursor", "pointer");

    // Tooltip (HTML overlay)
    const tooltip = d3.select(container)
        .append("div")
        .attr("class", "geo-tooltip")
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("background", "rgba(0,0,0,0.75)")
        .style("color", "#fff")
        .style("padding", "6px 8px")
        .style("border-radius", "4px")
        .style("font-size", "12px")
        .style("display", "none");

    // Mouse interactions on points
    points
        .on("mouseover", function (_, d) {
            d3.select(this)
                .raise()
                .transition().duration(120)
                .attr("r", Math.log10(d.events + 1) * 4)
                .attr("stroke", "#222")
                .attr("stroke-width", 0.8);

            tooltip.style("display", "block")
                .html(`<strong>Events:</strong> ${d.events}<br/>`);
        })
        .on("mousemove", function (event) {
            const [mx, my] = d3.pointer(event, container);
            const tooltipWidth = 160;
            const left = Math.min(mx + 12, width - tooltipWidth - 10);
            tooltip.style("left", `${left}px`)
                .style("top", `${my + 12}px`);
        })
        .on("mouseout", function (event, d) {
            d3.select(this)
                .transition().duration(120)
                .attr("r", Math.log10(d.events + 1) * 3)
                .attr("stroke", "none");

            tooltip.style("display", "none");
        });

    // Add zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.5, 5])
        .translateExtent([[-1000, -1000], [width + 1000, height + 1000]])
        .on("zoom", (event) => {
            mainGroup.attr("transform", event.transform);
        });

    svg.call(zoom);

    // Add simple zoom controls (HTML buttons overlay)
    const toolbar = document.createElement("div");
    toolbar.style.position = "absolute";
    toolbar.style.top = "10px";
    toolbar.style.right = "96%";
    toolbar.style.display = "flex";
    toolbar.style.flexDirection = "column";
    toolbar.style.gap = "6px";
    toolbar.style.zIndex = "10";

    const createBtn = (label, title) => {
        const b = document.createElement("button");
        b.textContent = label;
        b.title = title || label;
        b.style.width = "34px";
        b.style.height = "34px";
        b.style.border = "1px solid #ccc";
        b.style.background = "#fff";
        b.style.borderRadius = "4px";
        b.style.cursor = "pointer";
        b.style.boxShadow = "0 1px 2px rgba(0,0,0,0.1)";
        return b;
    };

    const zoomInBtn = createBtn("+", "Zoom in");
    const zoomOutBtn = createBtn("-", "Zoom out");
    const resetBtn = createBtn("⟳", "Reset zoom");

    toolbar.appendChild(zoomInBtn);
    toolbar.appendChild(zoomOutBtn);
    toolbar.appendChild(resetBtn);
    container.appendChild(toolbar);

    zoomInBtn.addEventListener("click", () => {
        svg.transition().duration(350).call(zoom.scaleBy, 1.5);
    });
    zoomOutBtn.addEventListener("click", () => {
        svg.transition().duration(350).call(zoom.scaleBy, 1 / 1.5);
    });
    resetBtn.addEventListener("click", () => {
        svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
    });

    // Legend (kept outside mainGroup so it does not transform)
    const legendWidth = innerWidth * 0.02;
    const legendHeight = innerHeight;
    const legendMargin = 50;
    const legendScale = d3.scaleLinear()
        .domain(colorScale.domain())
        .range([legendHeight, 0]);

    // Format ticks using SI-style short format (1k, 1M) and ensure max tick is shown
    const legendFormat = d3.format('.2s');
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

    // Gradient
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
            .attr("stop-color", colorScale(t * maxEvents));
    });

    // Legend rect
    legend.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#legend-gradient)")
        .attr("stroke", "#ccc");

    // Legend axis
    legend.append("g")
        .attr("transform", `translate(${legendWidth}, 0)`)
        .call(legendAxis);

    // Remove legend domain line
    legend.selectAll(".domain").remove();

    container.appendChild(svg.node());
}
