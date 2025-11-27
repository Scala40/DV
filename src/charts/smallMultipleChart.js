import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';

import geoJsonUrl from "../geojson/custom.geo.json?url";
let _geoJsonCache = null;

export async function renderSmallMultipleGeoChart(container, data, margins) {
    if (!_geoJsonCache) {
        try {
            const res = await fetch(geoJsonUrl);
            if (!res.ok) throw new Error(`Failed to fetch geojson: ${res.status} ${res.statusText}`);
            _geoJsonCache = await res.json();
        } catch (err) {
            console.error("Error loading geojson:", err);
            _geoJsonCache = { type: "FeatureCollection", features: [] };
        }
    }
    const geoJson = _geoJsonCache;

    // Get container dimensions
    const { width, height } = getContainerDimensions(container);

    // Ensure container positioning for absolute tooltip
    container.style.position = container.style.position || "relative";

    // Clear previous content
    container.innerHTML = "";

    // Create or reuse a geo-chart-content wrapper to ensure proper layout (matches geoChart)
    let content = container.querySelector('.geo-chart-content');
    if (!content) {
        content = document.createElement('div');
        content.className = 'geo-chart-content';
        // basic layout so controls and svg stack like in geoChart
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.style.width = '100%';
        container.appendChild(content);
    }

    // Create controls container (styled to match geoChart)
    let controls = content.querySelector('.geo-controls');
    if (!controls) {
        controls = document.createElement('div');
        controls.className = 'geo-controls';
        controls.style.display = 'flex';
        controls.style.flexDirection = 'column';
        controls.style.alignItems = 'center';
        controls.style.justifyContent = 'center';
        controls.style.gap = '8px';
        controls.style.width = '100%';
        content.appendChild(controls);
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

    const events = uniqueSorted(data, d => d.EVENT_TYPE);

    // Precompute maximum events across all years & countries per event type
    const eventMaxByType = new Map();
    (events || []).forEach(ev => {
        const rows = (data || []).filter(d => String(d.EVENT_TYPE).trim() === String(ev));
        // aggregate by country+year in case dataset contains multiple rows
        const byCountryYear = d3.rollup(rows, v => d3.sum(v, d => +d.EVENTS || 0), d => `${d.COUNTRY}||${d.YEAR}`);
        const max = byCountryYear.size ? d3.max(Array.from(byCountryYear.values())) : 0;
        eventMaxByType.set(ev, max || 0);
    });

    // Year slider (replaces select) - matches `geoChart` behavior
    const yearLabel = document.createElement("label");
    yearLabel.textContent = "Year: ";
    const yearSelect = document.createElement("input");
    yearSelect.type = 'range';
    yearSelect.className = 'geo-year-select';
    yearSelect.style.minWidth = "100px";
    yearLabel.appendChild(yearSelect);
    const yearDisplay = document.createElement('span');
    yearDisplay.className = 'geo-year-display';

    // Sub-event select
    const subLabel = document.createElement("label");
    subLabel.textContent = "Event:";
    const subSelect = document.createElement("select");
    subSelect.className = 'geo-event-select';
    subSelect.style.minWidth = "220px";
    subLabel.appendChild(subSelect);

    // Configure slider range
    const yearsNumeric = years.map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
    if (yearsNumeric.length) {
        const minYear = Math.min(...yearsNumeric);
        const maxYear = Math.max(...yearsNumeric);
        yearSelect.min = minYear;
        yearSelect.max = maxYear;
        yearSelect.step = 1;
        const defaultYear = yearsNumeric.includes(2025) ? 2025 : (yearsNumeric[yearsNumeric.length - 1] || maxYear);
        yearSelect.value = defaultYear;
        yearDisplay.textContent = defaultYear;

        function updateYearSliderFill() {
            const min = +yearSelect.min;
            const max = +yearSelect.max;
            const val = +yearSelect.value;
            const pct = (val - min) / (max - min) * 100;
            yearSelect.style.setProperty('--pct', `${pct}%`);
        }
        updateYearSliderFill();
        yearSelect.addEventListener('input', () => {
            yearDisplay.textContent = yearSelect.value;
            updateYearSliderFill();
            updateMap(yearSelect.value, subSelect.value);
            // stop any running animation when user manually changes year
            if (container.__smAnimationId) {
                clearInterval(container.__smAnimationId);
                container.__smAnimationId = null;
                const playBtn = container.querySelector('.sm-play-btn');
                if (playBtn) playBtn.textContent = 'Play';
            }
        });
    } else {
        yearSelect.disabled = true;
        yearDisplay.textContent = '';
    }
    events.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        subSelect.appendChild(opt);
    });

    // Set default selections (prefer 2022 and "Violent demonstration" if present)
    if (yearsNumeric.includes(2022)) {
        yearSelect.value = 2022;
        yearDisplay.textContent = 2022;
        const min = +yearSelect.min;
        const max = +yearSelect.max;
        const pct = (2022 - min) / (max - min) * 100;
        yearSelect.style.setProperty('--pct', `${pct}%`);
    }
    if (events.includes("Violent demonstration")) subSelect.value = "Violent demonstration";

    // append controls into the controls row (keeps layout consistent with geoChart)
    // keep the event select in the top controls; move year slider and play under the plot
    controlsRow.appendChild(subLabel);
    controlsRow.appendChild(subSelect);

    // Create SVG
    const svg = createResponsiveSvg(width, height - margins.bottom);

    // Layout calculations (respect margins on all sides)
    const innerWidth = Math.max(100, width - margins.left - margins.right);
    const innerHeight = Math.max(100, height - margins.top - margins.bottom);

    // Projection centered on the Middle East
    const projection = d3.geoMercator()
        .center([45, 30]) // long, lat
        .scale(700)
        .translate([margins.left + innerWidth / 2, margins.top + innerHeight / 2]);

    const path = d3.geoPath().projection(projection);

    // Helper to get country name from feature (robust)
    const featureName = f => {
        const p = f.properties || {};
        return p.NAME || p.name || p.ADMIN || p.admin || p.country || p.Country || "";
    };

    // Draw boundaries and initial countries (fill will be updated)
    const countryGroup = svg.append("g");
    const countryPaths = countryGroup.selectAll("path")
        .data(geoJson.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", "#f0f0f0")
        .attr("stroke", "#999")
        .attr("stroke-width", 0.5)
        .attr("pointer-events", "all")
        .style("cursor", "default");

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
        .style("display", "none")
        .style("z-index", "1000");

    // Add hover interactions
    countryPaths
        .on("mouseover", function (event, d) {
            d3.select(this).attr("stroke-width", 1.5);

            const name = featureName(d) || "Unknown";
            tooltip.style("display", "block")
                .html(`<strong>${name}</strong>`);
        })
        .on("mousemove", function (event) {
            const [mx, my] = d3.pointer(event, container);
            const tooltipWidth = 180;
            const left = Math.min(mx + 12, width - tooltipWidth - 10);
            tooltip.style("left", `${left}px`)
                .style("top", `${my + 12}px`);
        })
        .on("mouseout", function () {
            d3.select(this).attr("stroke-width", 0.5);
            tooltip.style("display", "none");
        });

    // Append svg to container (after controls)
    // append svg into the geo-chart-content wrapper so layout stays consistent
    content.appendChild(svg.node());

    // Create a legend group (will be updated inside updateMap)
    const legendGroup = svg.append('g').attr('class', 'sm-legend');

    // Create a bottom controls row (slider + play) and append under the svg
    let bottomControls = content.querySelector('.geo-controls-bottom');
    if (!bottomControls) {
        bottomControls = document.createElement('div');
        // include 'geo-controls' so slider inherits the shared controls styles (same as geoChart)
        bottomControls.className = 'geo-controls-bottom geo-controls';
        bottomControls.style.display = 'flex';
        bottomControls.style.flexDirection = 'row';
        bottomControls.style.alignItems = 'center';
        bottomControls.style.justifyContent = 'center';
        bottomControls.style.gap = '10px';
        bottomControls.style.marginTop = '8px';
        content.appendChild(bottomControls);
    }

    // move year controls into bottomControls
    bottomControls.appendChild(yearLabel);
    bottomControls.appendChild(yearSelect);
    bottomControls.appendChild(yearDisplay);

    // Play button to animate year slider (matches geoChart behavior)
    let playBtn = bottomControls.querySelector('.sm-play-btn');
    if (!playBtn) {
        playBtn = document.createElement('button');
        playBtn.className = 'sm-play-btn';
        playBtn.textContent = 'Play';
        bottomControls.appendChild(playBtn);
    }
    playBtn.addEventListener('click', () => {
        if (container.__smAnimationId) {
            clearInterval(container.__smAnimationId);
            container.__smAnimationId = null;
            playBtn.textContent = 'Play';
            return;
        }
        playBtn.textContent = 'Stop';
        const minY = +yearSelect.min;
        const maxY = +yearSelect.max;
        let current = +yearSelect.value || minY;
        if (current >= maxY) current = minY - 1;
        const stepMs = 400;
        container.__smAnimationId = setInterval(() => {
            current += 1;
            if (current > maxY) {
                clearInterval(container.__smAnimationId);
                container.__smAnimationId = null;
                playBtn.textContent = 'Play';
                return;
            }
            yearSelect.value = current;
            const disp = content.querySelector('.geo-year-display');
            if (disp) disp.textContent = current;
            const min = +yearSelect.min;
            const max = +yearSelect.max;
            const pct = (current - min) / (max - min) * 100;
            yearSelect.style.setProperty('--pct', `${pct}%`);
            updateMap(yearSelect.value, subSelect.value);
        }, stepMs);
    });

    // Update function to recolor countries based on selections
    function updateMap(selectedYear, selectedEvent) {
        // Filter data to the selected year and event
        const filtered = (data || []).filter(d =>
            String(d.YEAR).trim() === String(selectedYear) &&
            String(d.EVENT_TYPE).trim() === String(selectedEvent)
        );

        // Build a lookup map from normalized country -> events count
        const dataByCountry = new Map(filtered.map(d => [d.COUNTRY, +d.EVENTS || 0]));

        // Prepare a color scale using a fixed domain determined per event type
        const values = Array.from(dataByCountry.values());
        const maxVal = values.length ? d3.max(values) : 0;
        // domainMin = 0 for clarity; domainMax is the precomputed maximum across all years for this event type
        const domainMin = 0;
        let domainMax = eventMaxByType.get(selectedEvent) ?? maxVal;
        if (!domainMax || domainMax === 0) domainMax = Math.max(1, maxVal, 1);

        const colorScale = d3.scaleSequential()
            .domain([domainMin, domainMax])
            .interpolator(d3.interpolateReds);

        // --- Vertical color-range legend (stepped bands + axis) ---
        // legend layout
        const legendWidth = 14;
        const legendHeight = Math.min(220, innerHeight * 0.5);
        const legendX = width - margins.right - legendWidth - 30;
        const legendY = margins.top + 10;

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

        // stepped bands
        const steps = 6; // number of discrete bands
        const stepH = legendHeight / steps;
        for (let i = 0; i < steps; i++) {
            // i=0 at top should be the highest values
            const y = 8 + i * stepH;
            const midNorm = 1 - (i + 0.5) / steps; // 1..0
            const midVal = domainMin + midNorm * (domainMax - domainMin);
            legendGroup.append('rect')
                .attr('x', 0)
                .attr('y', y)
                .attr('width', legendWidth)
                .attr('height', Math.ceil(stepH))
                .attr('fill', colorScale(midVal))
                .attr('stroke', '#999');
        }

        // axis with step boundaries
        const scale = d3.scaleLinear().domain([domainMin, domainMax]).range([legendHeight, 0]);
        const tickValues = d3.range(0, steps + 1).map(i => domainMin + (i / steps) * (domainMax - domainMin));
        const axis = d3.axisRight(scale).tickValues(tickValues).tickFormat(d3.format('.2s'));
        const axisG = legendGroup.append('g')
            .attr('class', 'legend-axis')
            .attr('transform', `translate(${legendWidth + 6}, ${8})`)
            .call(axis);
        // remove the domain line and any tick lines so only labels remain
        axisG.select('.domain').remove();
        axisG.selectAll('line').remove();
        axisG.selectAll('text').attr('font-size', 11);
        // Update fills with a transition and update tooltip with event count
        countryPaths
            .transition()
            .duration(300)
            .attr("fill", feature => {
                const name = featureName(feature);
                if (!name) return "#e0e0e0";
                const val = dataByCountry.has(name) ? dataByCountry.get(name) : null;
                return (val === null || val === undefined) ? "#f0f0f0" : colorScale(val);
            });

        // Update hover interactions to include event count
        countryPaths
            .on("mouseover", function (event, d) {
                d3.select(this).attr("stroke-width", 1.5);

                const name = featureName(d) || "Unknown";
                const val = dataByCountry.has(name) ? dataByCountry.get(name) : null;

                if (val !== null && val !== undefined) {
                    tooltip.style("display", "block")
                        .html(`<strong>${name}</strong><br/><strong>Events:</strong> ${val}`);
                } else {
                    tooltip.style("display", "block")
                        .html(`<strong>${name}</strong>`);
                }
            })
            .on("mousemove", function (event) {
                const [mx, my] = d3.pointer(event, container);
                const tooltipWidth = 180;
                const left = Math.min(mx + 12, width - tooltipWidth - 10);
                tooltip.style("left", `${left}px`)
                    .style("top", `${my + 12}px`);
            })
            .on("mouseout", function () {
                d3.select(this).attr("stroke-width", 0.5);
                tooltip.style("display", "none");
            });
    }

    // Initial render
    updateMap(yearSelect.value, subSelect.value);

    // Event listeners
    // `input` event already wired for the slider; use change for subSelect
    subSelect.addEventListener("change", () => updateMap(yearSelect.value, subSelect.value));
}
