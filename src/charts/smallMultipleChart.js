import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';

import geoJson from "../geojson/custom.geo.json" assert { type: "json" };

export function renderSmallMultipleGeoChart(container, data, margins) {
    // Get container dimensions
    const { width, height } = getContainerDimensions(container);

    // Clear previous content
    container.innerHTML = "";

    // Create controls container (styled to match geoChart)
    let controls = container.querySelector('.geo-controls');
    if (!controls) {
        controls = document.createElement('div');
        controls.className = 'geo-controls';
        controls.style.display = 'flex';
        controls.style.flexDirection = 'column';
        controls.style.alignItems = 'center';
        controls.style.justifyContent = 'center';
        controls.style.gap = '8px';
        controls.style.width = '100%';
        container.appendChild(controls);
    }

    // Create or reuse a controls row to hold the selects (matches geoChart layout)
    let controlsRow = controls.querySelector('.geo-controls-row');
    if (!controlsRow) {
        controlsRow = document.createElement('div');
        controlsRow.className = 'geo-controls-row';
        controlsRow.style.display = 'flex';
        controlsRow.style.flexDirection = 'row';
        controlsRow.style.alignItems = 'center';
        controlsRow.style.justifyContent = 'center';
        controlsRow.style.gap = '10px';
        controls.appendChild(controlsRow);
    }

    // Helper to get unique sorted values
    const uniqueSorted = (arr, accessor = d => d) => {
        return Array.from(new Set((arr || []).map(accessor))).filter(v => v != null).sort((a, b) => {
            if (typeof a === "number" && typeof b === "number") return a - b;
            return String(a).localeCompare(String(b));
        });
    };

    const years = uniqueSorted(data, d => {
        const y = d && (d.YEAR ?? d.year);
        return y != null ? +y : null;
    }).map(String);

    const subevents = uniqueSorted(data, d => d.SUB_EVENT_TYPE);

    // Year select
    const yearLabel = document.createElement("label");
    yearLabel.textContent = "Year:";
    const yearSelect = document.createElement("select");
    yearSelect.className = 'geo-year-select';
    yearSelect.style.minWidth = "100px";
    yearLabel.appendChild(yearSelect);

    // Sub-event select
    const subLabel = document.createElement("label");
    subLabel.textContent = "Sub-event:";
    const subSelect = document.createElement("select");
    subSelect.className = 'geo-sub-select';
    subSelect.style.minWidth = "220px";
    subLabel.appendChild(subSelect);

    // Populate selects
    years.forEach(y => {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
    });
    subevents.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        subSelect.appendChild(opt);
    });

    // Set default selections (prefer 2022 and "Violent demonstration" if present)
    if (years.includes("2022")) yearSelect.value = "2022";
    if (subevents.includes("Violent demonstration")) subSelect.value = "Violent demonstration";

    // append controls into the controls row (keeps layout consistent with geoChart)
    controlsRow.appendChild(yearLabel);
    controlsRow.appendChild(yearSelect);
    controlsRow.appendChild(subLabel);
    controlsRow.appendChild(subSelect);

    // Create SVG
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

    // Normalization helper for country names
    const normalize = s => (s || "").toString().trim().toLowerCase();

    // Helper to get country name from feature (robust)
    const featureName = f => {
        const p = f.properties || {};
        return p.NAME || p.name || p.ADMIN || p.admin || p.country || p.Country || "";
    };

    // Draw boundaries and initial countries (fill will be updated)
    const countryGroup = svg.append("g");
    countryGroup.selectAll("path")
        .data(geoJson.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", "#f0f0f0")
        .attr("stroke", "#999")
        .attr("stroke-width", 0.5);

    // Append svg to container (after controls)
    container.appendChild(svg.node());

    // Update function to recolor countries based on selections
    function updateMap(selectedYear, selectedSubEvent) {
        // Filter data to the selected year and subevent
        const filtered = (data || []).filter(d =>
            String(d.YEAR).trim() === String(selectedYear) &&
            String(d.SUB_EVENT_TYPE).trim() === String(selectedSubEvent)
        );

        // Build a lookup map from normalized country -> events count
        const dataByCountry = new Map(filtered.map(d => [normalize(d.COUNTRY), +d.EVENTS || 0]));

        // Prepare a color scale based on min/max of filtered data
        const values = Array.from(dataByCountry.values());
        const minVal = values.length ? d3.min(values) : 0;
        const maxVal = values.length ? d3.max(values) : 0;
        const domainMin = minVal;
        const domainMax = (minVal === maxVal) ? (maxVal + 1) : maxVal;

        const colorScale = d3.scaleSequential()
            .domain([domainMin, domainMax])
            .interpolator(d3.interpolateReds);

        // Update fills with a transition
        countryGroup.selectAll("path")
            .transition()
            .duration(300)
            .attr("fill", feature => {
                const name = normalize(featureName(feature));
                if (!name) return "#e0e0e0";
                const val = dataByCountry.has(name) ? dataByCountry.get(name) : null;
                return (val === null || val === undefined) ? "#f0f0f0" : colorScale(val);
            });
    }

    // Initial render
    updateMap(yearSelect.value, subSelect.value);

    // Event listeners
    yearSelect.addEventListener("change", () => updateMap(yearSelect.value, subSelect.value));
    subSelect.addEventListener("change", () => updateMap(yearSelect.value, subSelect.value));
}
