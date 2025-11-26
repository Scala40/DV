import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';

import hexbinGeoJsonUrl from '../geojson/middle.json?url';

// Cache geojson data
let _hexbinGeoJson = null;
let _featureBounds = null;

// Constants
const SQRT3 = Math.sqrt(3);
const HEX_OFFSETS = [
    [0, -1],
    [SQRT3 / 2, -0.5],
    [SQRT3 / 2, 0.5],
    [0, 1],
    [-SQRT3 / 2, 0.5],
    [-SQRT3 / 2, -0.5]
];

// Hex coordinate utilities
const oddrToCube = (col, row) => {
    const x = col - Math.floor((row - (row & 1)) / 2);
    const z = row;
    return { x, y: -x - z, z };
};

const cubeDistance = (a, b) =>
    Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));

const manhattanDistance = (a, b) =>
    Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);

const generateHexagon = (hexRadius) =>
    "M" + HEX_OFFSETS.map(p => `${p[0] * hexRadius},${p[1] * hexRadius}`).join('L') + "Z";

// Load and cache geojson
async function loadGeoJson() {
    if (_hexbinGeoJson) return _hexbinGeoJson;

    try {
        const res = await fetch(hexbinGeoJsonUrl);
        if (!res.ok) throw new Error(`Failed to fetch geojson: ${res.status}`);
        _hexbinGeoJson = await res.json();
        _featureBounds = _hexbinGeoJson.features.map(f => d3.geoBounds(f));
    } catch (err) {
        console.error("Error loading geojson:", err);
        _hexbinGeoJson = { type: "FeatureCollection", features: [] };
        _featureBounds = [];
    }

    return _hexbinGeoJson;
}

// Aggregate events by location
function aggregateEvents(data) {
    const eventsByLocation = new Map();

    for (const d of data) {
        const lon = +d.CENTROID_LONGITUDE;
        const lat = +d.CENTROID_LATITUDE;
        const key = `${lon.toFixed(4)},${lat.toFixed(4)}`;
        const events = +d.EVENTS;

        const existing = eventsByLocation.get(key);
        if (existing) {
            existing.events += events;
        } else {
            eventsByLocation.set(key, { lon, lat, events });
        }
    }

    return eventsByLocation;
}

// Check if point is inside any feature (optimized with bbox check)
function isPointInFeatures(coords, features, featureBounds) {
    for (let i = 0; i < features.length; i++) {
        const bbox = featureBounds[i];

        // Fast bbox rejection
        if (coords[0] < bbox[0][0] || coords[0] > bbox[1][0] ||
            coords[1] < bbox[0][1] || coords[1] > bbox[1][1]) {
            continue;
        }

        // Precise check
        if (d3.geoContains(features[i], coords)) {
            return features[i].properties.name;
        }
    }

    return null;
}

// Generate hexagon grid
function generateHexGrid(projection, hexbinGeoJson, featureBounds, hexRadius) {
    const hexWidth = SQRT3 * hexRadius;
    const hexHeight = 2 * hexRadius;

    // Calculate grid bounds
    const bounds = d3.geoBounds({
        type: "FeatureCollection",
        features: hexbinGeoJson.features
    });
    const topLeft = projection([bounds[0][0], bounds[1][1]]);
    const bottomRight = projection([bounds[1][0], bounds[0][1]]);

    const gridStartX = topLeft[0] - hexWidth;
    const gridStartY = topLeft[1] - hexHeight;
    const gridEndX = bottomRight[0] + hexWidth;
    const gridEndY = bottomRight[1] + hexHeight;

    const hexagons = [];
    const hexGridMap = new Map();

    // Generate grid
    for (let row = 0; row * hexHeight * 0.75 + gridStartY < gridEndY; row++) {
        const rowOffset = (row & 1) ? hexWidth / 2 : 0;
        const y = row * hexHeight * 0.75 + gridStartY;

        for (let col = 0; col * hexWidth + gridStartX < gridEndX; col++) {
            const x = col * hexWidth + rowOffset + gridStartX;
            const coords = projection.invert([x, y]);

            if (isPointInFeatures(coords, hexbinGeoJson.features, featureBounds)) {
                const cube = oddrToCube(col, row);
                const hex = { x, y, row, col, events: 0, cube };
                hexagons.push(hex);
                hexGridMap.set(`${col},${row}`, hex);
            }
        }
    }

    return { hexagons, hexGridMap, gridStartX, gridStartY, hexWidth, hexHeight };
}

// Map data points to hex grid
function mapDataToHexGrid(eventsByLocation, projection, hexbinGeoJson, gridStartX, gridStartY, hexWidth, hexHeight) {
    const pointsCube = [];

    for (const d of eventsByLocation.values()) {
        const proj = projection([d.lon, d.lat]);
        const px = proj[0];
        const py = proj[1];

        // Approximate hex coordinates
        const approxRow = Math.round((py - gridStartY) / (hexHeight * 0.75));
        const rowOffset = (approxRow & 1) ? hexWidth / 2 : 0;
        const approxCol = Math.round((px - gridStartX - rowOffset) / hexWidth);

        // Find country
        const country = isPointInFeatures(
            [d.lon, d.lat],
            hexbinGeoJson.features,
            _featureBounds
        );

        pointsCube.push({
            cube: oddrToCube(approxCol, approxRow),
            events: d.events,
            projX: px,
            projY: py,
            country
        });
    }

    return pointsCube;
}

// Assign events to hexagons
function assignEventsToHexagons(hexagons, pointsCube, hexWidth, maxSteps = 2) {
    const quadtree = d3.quadtree()
        .x(d => d.projX)
        .y(d => d.projY)
        .addAll(pointsCube);

    const searchRadius = maxSteps * hexWidth * 1.2;

    hexagons.forEach(h => {
        let sum = 0;
        const countryMap = new Map();

        quadtree.visit((node, x1, y1, x2, y2) => {
            // Prune distant quads
            if (x1 > h.x + searchRadius || x2 < h.x - searchRadius ||
                y1 > h.y + searchRadius || y2 < h.y - searchRadius) {
                return true;
            }

            // Check leaf nodes
            if (!node.length && node.data) {
                const p = node.data;
                const manhattan = manhattanDistance(h.cube, p.cube);

                if (manhattan <= maxSteps * 2) {
                    const distance = cubeDistance(h.cube, p.cube);
                    if (distance <= maxSteps) {
                        sum += p.events;
                        if (p.country) {
                            countryMap.set(p.country, (countryMap.get(p.country) || 0) + p.events);
                        }
                    }
                }
            }

            return false;
        });

        h.events = sum;
        h.countryCounts = countryMap;
    });
}

// Create legend
function createLegend(svg, width, height, margins, maxEvents, colorScale) {
    const legendWidth = 14;
    const legendHeight = Math.min(220, (height - margins.top - margins.bottom) * 0.5);
    const legendX = width - margins.right - legendWidth - 30;
    const legendY = margins.top + 10;

    const legendGroup = svg.append('g')
        .attr('class', 'hex-legend')
        .attr('transform', `translate(${legendX}, ${legendY})`);

    // Background
    legendGroup.append('rect')
        .attr('x', -8)
        .attr('y', -18)
        .attr('width', legendWidth + 56)
        .attr('height', legendHeight + 34)
        .attr('fill', '#fff')
        .attr('stroke', '#ccc')
        .attr('rx', 8)
        .attr('opacity', 0.95);

    // Title
    legendGroup.append('text')
        .attr('x', 0)
        .attr('y', -4)
        .attr('font-weight', '600')
        .text('Events');

    // Color bands
    const steps = 10;
    const stepH = legendHeight / steps;

    for (let i = 0; i < steps; i++) {
        const y = 8 + i * stepH;
        const upper = maxEvents * (1 - i / steps);
        const lower = maxEvents * (1 - (i + 1) / steps);
        const midVal = (upper + lower) / 2;

        legendGroup.append('rect')
            .attr('x', 0)
            .attr('y', y)
            .attr('width', legendWidth)
            .attr('height', Math.ceil(stepH))
            .attr('fill', colorScale(midVal))
            .attr('stroke', '#999');
    }

    // Labels
    const fmt = d3.format('.2s');
    const labelX = legendWidth + 8;

    for (let j = 0; j <= steps; j++) {
        const val = maxEvents * (1 - j / steps);
        const y = 8 + j * stepH;

        legendGroup.append('text')
            .attr('x', labelX)
            .attr('y', y + 4)
            .attr('font-size', '10px')
            .text(fmt(Math.round(val)));
    }
}

// Create tooltip
function createTooltip() {
    return d3.select(document.body)
        .append('div')
        .attr('class', 'hex-tooltip')
        .style('position', 'absolute')
        .style('pointer-events', 'none')
        .style('background', 'rgba(0,0,0,0.75)')
        .style('color', '#fff')
        .style('padding', '6px 8px')
        .style('border-radius', '4px')
        .style('font-size', '12px')
        .style('display', 'none')
        .style('z-index', '10000');
}

// Add tooltip interactions
function addTooltipInteractions(hexPaths, tooltip) {
    hexPaths
        .on('mouseover', function (event, d) {
            d3.select(this)
                .attr('stroke-width', 1.2)
                .attr('stroke-opacity', 0.95);

            // Build country list
            const entries = Array.from(d.countryCounts.entries())
                .filter(([_, v]) => v > 0)
                .sort((a, b) => b[1] - a[1]);

            const countriesHtml = entries.length
                ? entries.map(([k, v]) => `${k} (<strong>${Math.round(v)}</strong>)`).join('<br/>')
                : 'None';

            tooltip
                .style('display', 'block')
                .html(`<strong>Total Events:</strong> ${d.events}<br/><strong>Countries:</strong><br/>${countriesHtml}`);
        })
        .on('mousemove', function (event) {
            const left = Math.min(event.pageX + 12, window.innerWidth - 270);
            tooltip
                .style('left', `${left}px`)
                .style('top', `${event.pageY + 12}px`);
        })
        .on('mouseout', function () {
            d3.select(this)
                .attr('stroke-width', 0.5)
                .attr('stroke-opacity', 0.6);
            tooltip.style('display', 'none');
        });
}

// Main render function
export async function renderHexbinMapChart(container, data, margins) {
    // Load geojson
    const hexbinGeoJson = await loadGeoJson();

    // Setup
    const { width, height } = getContainerDimensions(container);
    container.innerHTML = "";

    const svg = createResponsiveSvg(width, height);
    const innerWidth = Math.max(100, width - margins.left - margins.right);
    const innerHeight = Math.max(100, height - margins.top - margins.bottom);

    // Projection
    const projection = d3.geoMercator()
        .center([45, 30])
        .scale(700)
        .translate([margins.left + innerWidth / 2, margins.top + innerHeight / 2]);

    // Process data
    const eventsByLocation = aggregateEvents(data);
    const hexRadius = 8;

    // Generate grid
    const { hexagons, gridStartX, gridStartY, hexWidth, hexHeight } =
        generateHexGrid(projection, hexbinGeoJson, _featureBounds, hexRadius);

    // Map data to grid
    const pointsCube = mapDataToHexGrid(
        eventsByLocation,
        projection,
        hexbinGeoJson,
        gridStartX,
        gridStartY,
        hexWidth,
        hexHeight
    );

    // Assign events
    assignEventsToHexagons(hexagons, pointsCube, hexWidth);

    // Color scale
    const maxEvents = d3.max(hexagons, d => d.events) || 1;
    const colorScale = d3.scaleSequential()
        .domain([0, maxEvents])
        .interpolator(d3.interpolateYlOrRd);

    // Draw hexagons
    const hexGroup = svg.append("g").attr("class", "hexagons");
    const hexPaths = hexGroup.selectAll("path")
        .data(hexagons)
        .enter()
        .append("path")
        .attr("d", generateHexagon(hexRadius))
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .attr("fill", d => d.events > 0 ? colorScale(d.events) : "#f0f0f0")
        .attr("stroke", d => d.events > 0 ? '#777' : '#eee')
        .attr("stroke-width", 0.5)
        .attr("stroke-opacity", 0.6)
        .attr("opacity", 0.92);

    // Create legend and tooltip
    createLegend(svg, width, height, margins, maxEvents, colorScale);
    const tooltip = createTooltip();
    addTooltipInteractions(hexPaths, tooltip);

    // Add to container
    container.appendChild(svg.node());
}
