import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';

import hexbinGeoJsonUrl from '../geojson/middle.json?url';
let _hexbinGeoJson = null;

export async function renderHexbinMapChart(container, data, margins) {
    if (!_hexbinGeoJson) {
        try {
            const res = await fetch(hexbinGeoJsonUrl);
            if (!res.ok) throw new Error(`Failed to fetch geojson: ${res.status} ${res.statusText}`);
            _hexbinGeoJson = await res.json();
        } catch (err) {
            console.error("Error loading geojson:", err);
            _hexbinGeoJson = { type: "FeatureCollection", features: [] };
        }
    }
    const hexbinGeoJson = _hexbinGeoJson;

    const { width, height } = getContainerDimensions(container);

    // Clear previous content
    container.innerHTML = "";

    // Create SVG
    const svg = createResponsiveSvg(width, height);

    // Layout calculations
    const innerWidth = Math.max(100, width - margins.left - margins.right);
    const innerHeight = Math.max(100, height - margins.top - margins.bottom);

    // Projection centered on the West Bank
    const projection = d3.geoMercator()
        .center([45, 30]) // long, lat
        .scale(700)
        .translate([margins.left + innerWidth / 2, margins.top + innerHeight / 2]);

    const path = d3.geoPath().projection(projection);

    // Filter data for 2023
    const data2023 = data.filter(d => d.YEAR === 2023);

    // Create a spatial index of events by location
    const eventsByLocation = new Map();
    data2023.forEach(d => {
        const key = `${d.CENTROID_LONGITUDE.toFixed(3)},${d.CENTROID_LATITUDE.toFixed(3)}`;
        eventsByLocation.set(key, (eventsByLocation.get(key) || 0) + d.EVENTS);
    });

    // Hexagon generation function
    const SQRT3 = Math.sqrt(3);
    function generateHexagon(hexRadius) {
        const hexagonPoly = [
            [0, -1],
            [SQRT3 / 2, -0.5],
            [SQRT3 / 2, 0.5],
            [0, 1],
            [-SQRT3 / 2, 0.5],
            [-SQRT3 / 2, -0.5]
        ];
        return "M" + hexagonPoly.map(p =>
            [p[0] * hexRadius, p[1] * hexRadius].join(',')
        ).join('L') + "Z";
    }

    // Generate hexagon grid
    const hexRadius = 8;
    const hexWidth = SQRT3 * hexRadius;
    const hexHeight = 2 * hexRadius;

    // Calculate bounds for all features
    const bounds = d3.geoBounds({ type: "FeatureCollection", features: hexbinGeoJson.features });
    const topLeft = projection([bounds[0][0], bounds[1][1]]);
    const bottomRight = projection([bounds[1][0], bounds[0][1]]);

    const gridStartX = topLeft[0] - hexWidth;
    const gridStartY = topLeft[1] - hexHeight;
    const gridEndX = bottomRight[0] + hexWidth;
    const gridEndY = bottomRight[1] + hexHeight;

    // Generate hexagon centers
    const hexagons = [];
    for (let row = 0; row * hexHeight * 0.75 + gridStartY < gridEndY; row++) {
        for (let col = 0; col * hexWidth + gridStartX < gridEndX; col++) {
            const x = col * hexWidth + (row % 2) * hexWidth / 2 + gridStartX;
            const y = row * hexHeight * 0.75 + gridStartY;

            // Convert back to lat/lng to check if inside a feature
            const coords = projection.invert([x, y]);

            // Check if this hexagon center is within any feature
            const isInside = hexbinGeoJson.features.some(feature => {
                return d3.geoContains(feature, coords);
            });

            if (isInside) {
                // Find nearest data point to determine event count
                let minDist = Infinity;
                let nearestEvents = 0;

                data2023.forEach(d => {
                    const projected = projection([d.CENTROID_LONGITUDE, d.CENTROID_LATITUDE]);
                    const dist = Math.sqrt(
                        Math.pow(projected[0] - x, 2) +
                        Math.pow(projected[1] - y, 2)
                    );
                    if (dist < minDist) {
                        minDist = dist;
                        nearestEvents = d.EVENTS;
                    }
                });

                hexagons.push({ x, y, events: nearestEvents, distance: minDist });
            }
        }
    }

    // Color scale based on events
    const maxEvents = d3.max(data2023, d => d.EVENTS) || 1;
    const colorScale = d3.scaleSequential()
        .domain([0, Math.log1p(maxEvents)])
        .interpolator(d3.interpolateYlOrRd);

    // Draw country boundaries first (as background)
    const countryGroup = svg.append("g");
    countryGroup.selectAll("path")
        .data(hexbinGeoJson.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", "#333")
        .attr("stroke-width", 1);

    // Draw hexagons
    svg.append("g")
        .attr("class", "hexagons")
        .selectAll("path")
        .data(hexagons)
        .enter()
        .append("path")
        .attr("d", generateHexagon(hexRadius))
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .attr("fill", d => d.events > 0 ? colorScale(Math.log1p(d.events)) : "#f0f0f0")
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5)
        .attr("opacity", 0.8);

    // Add svg to container
    container.appendChild(svg.node());
}