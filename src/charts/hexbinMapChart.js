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

    // Helper to get country/name from feature
    const featureName = f => {
        const p = f.properties || {};
        return p.NAME || p.name || p.ADMIN || p.admin || p.country || p.Country || f.id || "Unknown";
    };

    // Aggregate events by location across ALL years (use aggregated dataset rather than a single year)
    const eventsByLocation = new Map();
    data.forEach(d => {
        if (d.CENTROID_LONGITUDE == null || d.CENTROID_LATITUDE == null) return;
        const lon = +d.CENTROID_LONGITUDE;
        const lat = +d.CENTROID_LATITUDE;
        const key = `${lon.toFixed(4)},${lat.toFixed(4)}`;
        const existing = eventsByLocation.get(key);
        if (existing) {
            existing.events += +d.EVENTS || 0;
        } else {
            eventsByLocation.set(key, { lon, lat, events: +d.EVENTS || 0 });
        }
    });

    // Hexagon generation offsets and function
    const SQRT3 = Math.sqrt(3);
    const HEX_OFFSETS = [
        [0, -1],
        [SQRT3 / 2, -0.5],
        [SQRT3 / 2, 0.5],
        [0, 1],
        [-SQRT3 / 2, 0.5],
        [-SQRT3 / 2, -0.5]
    ];
    function generateHexagon(hexRadius) {
        return "M" + HEX_OFFSETS.map(p =>
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
                // Store grid coordinates for distance calculations later
                hexagons.push({ x, y, row, col, events: 0 });
            }
        }
    }

    // Helper to convert odd-r offset (row,col) to cube coordinates for hex distance
    // Our grid uses odd-r horizontal layout (odd rows offset by half a column)
    function oddr_to_cube(col, row) {
        const x = col - Math.floor((row - (row & 1)) / 2);
        const z = row;
        const y = -x - z;
        return { x, y, z };
    }

    function cube_distance(a, b) {
        return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));
    }

    // Precompute cube coords for each hexagon
    hexagons.forEach(h => { h.cube = oddr_to_cube(h.col, h.row); });

    // Map each aggregated location to approximate hex (by projecting then rounding to nearest row/col)
    // Map each aggregated location to approximate hex (by projecting then rounding to nearest row/col)
    // Also detect which country the point belongs to (if any)
    const pointsCube = Array.from(eventsByLocation.values()).map(d => {
        const proj = projection([d.lon, d.lat]);
        const px = proj[0];
        const py = proj[1];
        const approxRow = Math.round((py - gridStartY) / (hexHeight * 0.75));
        const rowOffset = (approxRow & 1) ? hexWidth / 2 : 0;
        const approxCol = Math.round((px - gridStartX - rowOffset) / hexWidth);
        // find country that contains the geographic point
        let country = null;
        for (const feature of hexbinGeoJson.features) {
            try {
                if (d3.geoContains(feature, [d.lon, d.lat])) {
                    country = featureName(feature);
                    break;
                }
            } catch (e) {
                // ignore
            }
        }
        return { cube: oddr_to_cube(approxCol, approxRow), events: d.events, projX: px, projY: py, lon: d.lon, lat: d.lat, country };
    });

    // Assign to each hexagon the SUM of EVENTS of all data points within MAX_STEPS hex-distance.
    // This aggregates nearby events into the hex cell instead of taking a single nearest point.
    const MAX_STEPS = 2;
    hexagons.forEach(h => {
        let sum = 0;
        const countryMap = new Map();
        for (const p of pointsCube) {
            const dSteps = cube_distance(h.cube, p.cube);
            if (dSteps <= MAX_STEPS) {
                const ev = +p.events || 0;
                sum += ev;
                const c = p.country || 'Unknown';
                countryMap.set(c, (countryMap.get(c) || 0) + ev);
            }
        }
        h.events = sum;
        h.countryCounts = countryMap; // Map<string,number>
    });

    // Color scale based on aggregated events (linear spacing)
    const maxEvents = d3.max(hexagons, d => d.events) || 1;
    const colorScale = d3.scaleSequential()
        .domain([0, maxEvents])
        .interpolator(d3.interpolateYlOrRd);


    // --- Stepped vertical legend (color steps + range) ---
    // --- Vertical color-range legend (stepped bands + axis) ---
    // Use the same visual style/placement as `smallMultipleChart.js` (background, box, ticks positioning)
    const legendWidth = 14;
    const legendHeight = Math.min(220, innerHeight * 0.5);
    const legendX = width - margins.right - legendWidth - 20;
    const legendY = margins.top + 10;

    const legendGroup = svg.append('g').attr('class', 'hex-legend');
    legendGroup.attr('transform', `translate(${legendX}, ${legendY})`);
    legendGroup.selectAll('*').remove();

    // background box
    legendGroup.append('rect')
        .attr('x', -8)
        .attr('y', -18)
        .attr('width', legendWidth + 56)
        .attr('height', legendHeight + 34)
        .attr('fill', '#ffffff')
        .attr('stroke', '#ccc')
        .attr('rx', 8)
        .attr('ry', 8)
        .attr('opacity', 0.95);

    // title
    legendGroup.append('text')
        .attr('x', 0)
        .attr('y', -4)
        .attr('font-weight', '600')
        .text('Events');

    // stepped bands (linear scale) — top band = highest values
    const steps = 10; // number of discrete bands
    const stepH = legendHeight / steps;
    const domainMin = 0;
    const domainMax = maxEvents;
    for (let i = 0; i < steps; i++) {
        const y = 8 + i * stepH;
        // compute linear upper/lower for this band (top-to-bottom)
        const upper = domainMax - (i / steps) * (domainMax - domainMin);
        const lower = domainMax - ((i + 1) / steps) * (domainMax - domainMin);
        const midVal = (upper + lower) / 2;
        legendGroup.append('rect')
            .attr('x', 0)
            .attr('y', y)
            .attr('width', legendWidth)
            .attr('height', Math.ceil(stepH))
            .attr('fill', colorScale(midVal))
            .attr('stroke', '#999');
    }

    // Add boundary labels (steps+1 values) placed at band boundaries
    const labelX = legendWidth + 8;
    // use k formatting (ex 1500 -> 1.5k)
    const fmt = d3.format('.2s');
    for (let j = 0; j <= steps; j++) {
        const val = domainMax - (j / steps) * (domainMax - domainMin);
        const y = 8 + j * stepH;
        legendGroup.append('text')
            .attr('x', labelX)
            .attr('y', y + 4) // +4 to vertically center on boundary
            .attr('font-size', '10px')
            .text(fmt(Math.round(val)));
    }

    // (map boundaries removed — only hexagons are drawn)

    // Draw hexagons (store selection for interactions)
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

    // Tooltip for hex hover (attach to body so it appears above the SVG)
    const tooltip = d3.select(document.body)
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

    // Helper to compute countries under a hex (approximate)
    function getCountriesUnderHex(h) {
        const vertsScreen = HEX_OFFSETS.map(p => [h.x + p[0] * hexRadius, h.y + p[1] * hexRadius]);
        // compute vertices in geographic coords (may be null if outside projection)
        const vertsGeo = vertsScreen.map(v => {
            try { return projection.invert(v); } catch (e) { return null; }
        });
        const countries = new Set();
        for (const feature of hexbinGeoJson.features) {
            // 1) if any hex vertex is inside the feature
            if (vertsGeo.some(g => g && d3.geoContains(feature, g))) {
                const name = (feature.properties && (feature.properties.NAME || feature.properties.name)) || feature.id || 'Unknown';
                countries.add(name);
                continue;
            }
            // 2) if feature centroid falls inside the hex polygon (project centroid to screen and test)
            const fc = d3.geoCentroid(feature);
            const fcScreen = projection(fc);
            if (fcScreen && d3.polygonContains(vertsScreen, fcScreen)) {
                const name = (feature.properties && (feature.properties.NAME || feature.properties.name)) || feature.id || 'Unknown';
                countries.add(name);
            }
        }
        return Array.from(countries);
    }

    // Add hover interactions
    hexPaths
        .on('mouseover', function (event, d) {
            d3.select(this).attr('stroke-width', 1.2).attr('stroke-opacity', 0.95);
            // Build country contribution list from the precomputed countryCounts map
            const map = d.countryCounts instanceof Map ? d.countryCounts : new Map();
            const entries = Array.from(map.entries()).filter(([k, v]) => v > 0);
            entries.sort((a, b) => b[1] - a[1]);
            const countriesHtml = entries.length ? entries.map(e => `${e[0]} (<strong>${Math.round(e[1])}</strong>)`).join('<br/>') : 'None';
            const html = `<strong>Total Events:</strong> ${d.events}<br/><strong>Countries contributing:</strong><br/>${countriesHtml}`;
            tooltip.style('display', 'block').html(html);
        })
        .on('mousemove', function (event) {
            const tooltipWidth = 260;
            const pageX = event.pageX;
            const pageY = event.pageY;
            const left = Math.min(pageX + 12, window.innerWidth - tooltipWidth - 10);
            tooltip.style('left', `${left}px`).style('top', `${pageY + 12}px`);
        })
        .on('mouseout', function () {
            d3.select(this).attr('stroke-width', 0.5).attr('stroke-opacity', 0.6);
            tooltip.style('display', 'none');
        });

    // Add svg to container
    container.appendChild(svg.node());
}