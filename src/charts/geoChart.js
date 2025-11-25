import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';

import geoJson from "../geojson/custom.geo.json" assert { type: "json" };

export function renderGeoChart(container, data, margins) {
    // persist raw data so controls survive re-renders
    if (!container.__geoRawData) container.__geoRawData = data;
    const rawData = container.__geoRawData;

    const { width, height } = getContainerDimensions(container);

    // Ensure container positioning
    container.style.position = container.style.position || "relative";

    // Ensure controls container exists and stays outside the chart content so re-renders don't remove it
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

    // create or reuse a wrapper for chart content so we can clear only the chart on re-render
    let wrapper = container.querySelector('.geo-chart-content');
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.className = 'geo-chart-content';
        wrapper.style.position = 'relative';
        container.appendChild(wrapper);
    }
    // clear only the chart content
    wrapper.innerHTML = '';

    // Create responsive svg that fills its parent
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

    // Compute aggregated max across all years per location (sum of events at same lon/lat)
    const _aggMap = new Map();
    (rawData || []).forEach(d => {
        const lon = +d.lon;
        const lat = +d.lat;
        const key = `${lon}|${lat}`;
        const prev = _aggMap.get(key) || 0;
        _aggMap.set(key, prev + (+d.events || 0));
    });
    const aggregatedMax = d3.max(Array.from(_aggMap.values())) || 0;

    // Discrete color palette (3 fixed reds) and fixed size tiers (3 sizes)
    // darker red palette for better contrast
    const colorPalette = ['var(--color-unige-red-light)', 'var(--color-unige-red)', 'var(--color-unige-red-dark)'];
    const sizeRadii = [6, 10, 14];

    // NOTE: `getColor` and `getSize` are defined later once we know the
    // appropriate domain maximum to use (aggregate vs per-year max).

    // Determine selected year and whether aggregate mode is active
    const years = Array.from(new Set((rawData || []).map(d => +d.Year || +d.year))).filter(y => !isNaN(y)).sort((a, b) => a - b);
    const yearSelectEl = container.querySelector('.geo-year-select');
    const selectedYear = yearSelectEl ? +yearSelectEl.value : (years.includes(2023) ? 2023 : years[years.length - 1] || null);
    const isAggregate = !!container.__geoAggregate;

    // Prepare data to plot according to mode
    let plotData;
    if (isAggregate) {
        const map = new Map();
        (rawData || []).forEach(d => {
            const lon = +d.lon;
            const lat = +d.lat;
            const key = `${lon}|${lat}`;
            const prev = map.get(key);
            const ev = +d.events || 0;
            if (prev) prev.events += ev; else map.set(key, { country: d.country, lon, lat, events: ev });
        });
        plotData = Array.from(map.values());
    } else if (selectedYear) {
        plotData = (rawData || []).filter(d => +d.Year === +selectedYear || +d.year === +selectedYear);
    } else {
        plotData = rawData || [];
    }

    // Compute merged-by-country maxima and determine domain max for sizing/coloring.
    // For aggregate mode we keep the aggregatedMax computed earlier; for
    // per-year mode we use the maximum among each year's per-country maxima
    // (i.e. the highest single-year country total across all years).
    const mergedByCountry = d3.rollup(plotData || [], v => d3.sum(v, d => +d.events || 0), d => d.country);
    let mergedMaxForLegend;
    if (isAggregate) {
        mergedMaxForLegend = d3.max(Array.from(mergedByCountry.values())) || 0;
    } else {
        const perYearMaxes = (years || []).map(y => {
            const perYearData = (rawData || []).filter(d => +d.Year === +y || +d.year === +y);
            const perYearByCountry = d3.rollup(perYearData, v => d3.sum(v, d => +d.events || 0), d => d.country);
            return d3.max(Array.from(perYearByCountry.values())) || 0;
        });
        mergedMaxForLegend = d3.max(perYearMaxes) || 0;
    }

    const domainMax = isAggregate ? aggregatedMax : mergedMaxForLegend;
    const sizeBreaks = [domainMax / 3, (domainMax * 2) / 3];

    function getColor(v) {
        const val = +v || 0;
        if (domainMax === 0) return colorPalette[0];
        if (val <= sizeBreaks[0]) return colorPalette[0];
        if (val <= sizeBreaks[1]) return colorPalette[1];
        return colorPalette[2];
    }

    function getSize(v) {
        const val = +v || 0;
        if (domainMax === 0) return sizeRadii[0];
        if (val <= sizeBreaks[0]) return sizeRadii[0];
        if (val <= sizeBreaks[1]) return sizeRadii[1];
        return sizeRadii[2];
    }

    // --- Merge overlapping points of the same country (optional) ---
    // If two circles (same country) overlap by >= overlapThreshold (relative to the smaller circle),
    // they will be merged (events summed, position = events-weighted centroid).
    const overlapMergeEnabled = true; // toggle this to disable merging
    const overlapThreshold = container.__geoOverlapThreshold ?? 0.3; // default 50%

    if (overlapMergeEnabled && plotData && plotData.length > 1) {
        // helper: circle intersection area
        function circleIntersectionArea(r1, r2, d) {
            if (d >= r1 + r2) return 0;
            const r1sq = r1 * r1;
            const r2sq = r2 * r2;
            if (d <= Math.abs(r1 - r2)) {
                // one circle fully inside the other -> intersection = area of smaller
                return Math.PI * Math.min(r1sq, r2sq);
            }
            const phi = Math.acos(Math.max(-1, Math.min(1, (d * d + r1sq - r2sq) / (2 * d * r1))));
            const theta = Math.acos(Math.max(-1, Math.min(1, (d * d + r2sq - r1sq) / (2 * d * r2))));
            const area = r1sq * phi + r2sq * theta - 0.5 * Math.sqrt(Math.max(0, (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2)));
            return area;
        }

        // create a working copy with screen positions & radii
        const pts = plotData.map(p => {
            const lon = +p.lon;
            const lat = +p.lat;
            const projected = projection([lon, lat]);
            const x = projected[0];
            const y = projected[1];
            const r = getSize(p.events);
            return { ...p, lon, lat, x, y, r, events: +p.events || 0 };
        });

        // greedy merge loop: combine any pair (same country) whose overlap ratio >= threshold
        let mergedSomething = true;
        while (mergedSomething) {
            mergedSomething = false;
            outer: for (let i = 0; i < pts.length; i++) {
                for (let j = i + 1; j < pts.length; j++) {
                    const a = pts[i];
                    const b = pts[j];
                    if (a.country !== b.country) continue;
                    const dx = a.x - b.x;
                    const dy = a.y - b.y;
                    const d = Math.hypot(dx, dy);
                    const inter = circleIntersectionArea(a.r, b.r, d);
                    const minArea = Math.PI * Math.min(a.r * a.r, b.r * b.r);
                    const ratio = minArea === 0 ? 0 : inter / minArea;
                    if (ratio >= overlapThreshold) {
                        // merge b into a (events-weighted)
                        const totalEvents = a.events + b.events;
                        const wA = a.events / totalEvents;
                        const wB = 1 - wA;
                        const newLon = (a.lon * wA) + (b.lon * wB);
                        const newLat = (a.lat * wA) + (b.lat * wB);
                        a.lon = newLon;
                        a.lat = newLat;
                        a.events = totalEvents;
                        // recompute screen pos & radius
                        const projected = projection([a.lon, a.lat]);
                        a.x = projected[0];
                        a.y = projected[1];
                        a.r = getSize(a.events);
                        // remove b
                        pts.splice(j, 1);
                        mergedSomething = true;
                        break outer;
                    }
                }
            }
        }

        // replace plotData with merged output
        plotData = pts.map(p => ({ country: p.country, lon: p.lon, lat: p.lat, events: p.events }));
    }

    // Draw points / heatmap (inside mainGroup)
    const points = mainGroup.selectAll("circle")
        .data(plotData)
        .join("circle")
        .attr("cx", d => projection([d.lon, d.lat])[0])
        .attr("cy", d => projection([d.lon, d.lat])[1])
        .attr("r", d => getSize(d.events))
        .attr("fill", d => getColor(d.events))
        .attr("fill-opacity", 0.8)
        .attr("stroke", "#333")
        .attr("stroke-width", 0.4)
        .style("cursor", "pointer");

    // Tooltip (HTML overlay)
    // remove any leftover tooltip from previous renders (prevents stuck tooltip)
    const oldTooltips = container.querySelectorAll('.geo-tooltip');
    oldTooltips.forEach(t => t.remove());

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
            const baseR = getSize(d.events);
            d3.select(this)
                .raise()
                .transition().duration(120)
                .attr("r", baseR + 3)
                .attr("stroke", "#222")
                .attr("stroke-width", 1.2);

            tooltip.style("display", "block")
                .html(`<strong>${d.country}</strong><br/><strong>Events:</strong> ${d.events}`);
        })
        .on("mousemove", function (event) {
            const [mx, my] = d3.pointer(event, container);
            const tooltipWidth = 160;
            const left = Math.min(mx + 12, width - tooltipWidth - 10);
            tooltip.style("left", `${left}px`)
                .style("top", `${my + 12}px`);
        })
        .on("mouseout", function (event, d) {
            const baseR = getSize(d.events);
            d3.select(this)
                .transition().duration(120)
                .attr("r", baseR)
                .attr("stroke", "#333")
                .attr("stroke-width", 0.4);

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
    // toolbar should be inside the chart wrapper so controls remain outside
    const existingWrapper = container.querySelector('.geo-chart-content');
    if (existingWrapper) existingWrapper.appendChild(toolbar); else container.appendChild(toolbar);

    zoomInBtn.addEventListener("click", () => {
        svg.transition().duration(350).call(zoom.scaleBy, 1.5);
    });
    zoomOutBtn.addEventListener("click", () => {
        svg.transition().duration(350).call(zoom.scaleBy, 1 / 1.5);
    });
    resetBtn.addEventListener("click", () => {
        svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
    });

    // Legend: discrete colors + size samples (computed from merged plotData grouped by country)
    // `mergedMaxForLegend` was computed earlier and contains the correct domain
    // maximum depending on `isAggregate`.
    const mergedMax = mergedMaxForLegend || 0;

    const legendX = width - margins.right - 140;
    const legendY = margins.top;
    const legend = svg.append('g').attr('transform', `translate(${legendX}, ${legendY})`).attr('class', 'geo-legend');

    // Legend layout
    const swatchSize = 14;
    const swatchGap = 6;
    const colorStartY = 18;
    const sizeGapY = 28;
    const legendWidth = 120;
    const legendHeight = colorStartY + (sizeRadii.length + 1) * sizeGapY;

    legend.append('rect')
        .attr('x', -8)
        .attr('y', -14)
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .attr('fill', '#ffffff')
        .attr('stroke', '#ccc')
        .attr('rx', 8)
        .attr('ry', 8)
        .attr('opacity', 0.95);

    // (Removed explicit "Color" title — swatches are self-explanatory)

    const fmt = d3.format('.2s');
    const mergedBreaks = d3.range(0, colorPalette.length + 1).map(i => Math.round((i / colorPalette.length) * mergedMax));

    // Size legend (use mergedMax to compute size ranges for labels)

    legend.append('text').attr('x', 0).attr('y', colorStartY - 10).attr('font-weight', '600').text('Events');
    const mergedSizeBreaks = [mergedMax / 3, (mergedMax * 2) / 3];
    const sizeRanges = [0, Math.round(mergedSizeBreaks[0]), Math.round(mergedSizeBreaks[1]), Math.round(mergedMax)];
    sizeRadii.forEach((r, i) => {
        const cy = (i + 1) * sizeGapY;
        // color the size-sample circles using the same discrete color palette
        legend.append('circle')
            .attr('cx', swatchSize)
            .attr('cy', cy)
            .attr('r', r)
            .attr('fill', colorPalette[i])
            .attr('fill-opacity', 0.8)
            .attr('stroke', '#333');

        const label = `${fmt(sizeRanges[i])} – ${fmt(sizeRanges[i + 1])}`;
        legend.append('text')
            .attr('x', swatchSize * 2 + 8)
            .attr('y', cy + 4)
            .text(label)
            .attr('font-size', 12);
    });

    // Ensure a controls container exists and is centered (reuse existing `controls` variable)
    controls = container.querySelector('.geo-controls');
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

    // compute years list from the persisted raw data (already computed earlier)

    createGeoYearSlider(container, years, controls, margins);
    createGeoPlayButton(container, controls.querySelector('.geo-year-select'), controls, margins);
    createGeoAggregateButton(container, controls, margins);

    // append svg into the chart wrapper (so controls remain intact)
    const chartWrapper = container.querySelector('.geo-chart-content');
    if (chartWrapper) chartWrapper.appendChild(svg.node()); else container.appendChild(svg.node());
}

// --- Controls helpers (copied/adapted from Boxplot chart) ---
function createGeoYearSlider(container, years, controls, margins) {
    if (!years || years.length === 0) return { yearSelect: null };

    // defensive: ensure controls exists
    if (!controls) {
        controls = container.querySelector('.geo-controls');
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
    }

    let yearSelect = controls.querySelector('.geo-year-select');
    if (yearSelect) return { yearSelect };

    const controlsRow = controls.querySelector('.geo-controls-row') || controls;

    const yLabel = document.createElement('label');
    yLabel.textContent = 'Year: ';

    yearSelect = document.createElement('input');
    yearSelect.type = 'range';
    yearSelect.className = 'geo-year-select';
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    yearSelect.min = minYear;
    yearSelect.max = maxYear;
    yearSelect.step = 1;

    const yearDisplay = document.createElement('span');
    yearDisplay.className = 'geo-year-display';

    const defaultYear = years.includes(2025) ? 2025 : years[years.length - 1];
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
        renderGeoChart(container, container.__geoRawData, margins);
        if (container.__geoAnimationId) {
            clearInterval(container.__geoAnimationId);
            container.__geoAnimationId = null;
            const playBtn = container.querySelector('.geo-play-btn');
            if (playBtn) playBtn.textContent = 'Play';
        }
    });

    controlsRow.appendChild(yLabel);
    controlsRow.appendChild(yearSelect);
    controlsRow.appendChild(yearDisplay);

    return { yearSelect };
}

function createGeoPlayButton(container, yearSelect, controls, margins) {
    if (!yearSelect) return;
    // defensive: ensure controls exists
    if (!controls) {
        controls = container.querySelector('.geo-controls');
        if (!controls) {
            controls.className = 'geo-controls';
            controls.style.display = 'flex';
            controls.style.flexDirection = 'column';
            controls.style.alignItems = 'center';
            controls.style.justifyContent = 'center';
            controls.style.gap = '8px';
            controls.style.width = '100%';
            container.appendChild(controls);
        }
    }

    let playBtn = controls.querySelector('.geo-play-btn');
    if (playBtn) return;

    const controlsRow = controls.querySelector('.geo-controls-row') || controls;

    playBtn = document.createElement('button');
    playBtn.className = 'geo-play-btn';
    playBtn.textContent = 'Play';
    controlsRow.appendChild(playBtn);

    // hide play when aggregate view is active
    if (container.__geoAggregate) playBtn.style.display = 'none';

    playBtn.addEventListener('click', () => {
        if (container.__geoAnimationId) {
            clearInterval(container.__geoAnimationId);
            container.__geoAnimationId = null;
            playBtn.textContent = 'Play';
            return;
        }

        playBtn.textContent = 'Stop';
        const minY = +yearSelect.min;
        const maxY = +yearSelect.max;
        let current = +yearSelect.value || minY;
        if (current >= maxY) current = minY - 1;

        const stepMs = 400;
        container.__geoAnimationId = setInterval(() => {
            current += 1;
            if (current > maxY) {
                clearInterval(container.__geoAnimationId);
                container.__geoAnimationId = null;
                playBtn.textContent = 'Play';
                return;
            }
            yearSelect.value = current;
            const disp = controls.querySelector('.geo-year-display');
            if (disp) disp.textContent = current;

            const min = +yearSelect.min;
            const max = +yearSelect.max;
            const pct = (current - min) / (max - min) * 100;
            yearSelect.style.setProperty('--pct', `${pct}%`);

            renderGeoChart(container, container.__geoRawData, margins);
        }, stepMs);
    });
}

function createGeoAggregateButton(container, controls, margins) {
    // defensive: ensure controls exists
    if (!controls) {
        controls = container.querySelector('.geo-controls');
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
    }

    let aggBtn = controls.querySelector('.geo-aggregate-btn');
    const controlsRow = controls.querySelector('.geo-controls-row') || controls;
    if (!aggBtn) {
        aggBtn = document.createElement('button');
        aggBtn.className = 'geo-aggregate-btn';
        aggBtn.textContent = container.__geoAggregate ? 'Per-year' : 'Aggregate (All years)';
        controlsRow.appendChild(aggBtn);
    }

    function updateUIForAggregate(active) {
        const yearSelect = controls.querySelector('.geo-year-select');
        const yearDisplay = controls.querySelector('.geo-year-display');
        const playBtn = controls.querySelector('.geo-play-btn');
        if (yearSelect) yearSelect.style.display = active ? 'none' : '';
        if (yearDisplay) yearDisplay.style.display = active ? 'none' : '';
        if (playBtn) playBtn.style.display = active ? 'none' : '';
        aggBtn.textContent = active ? 'Per-year' : 'Aggregate (All years)';
    }

    // initialize UI state
    updateUIForAggregate(!!container.__geoAggregate);

    // Use onclick to ensure a single handler is active and avoid stacked listeners when re-rendering
    aggBtn.onclick = () => {
        const now = !container.__geoAggregate;
        container.__geoAggregate = now;

        // stop any running animation and reset play button
        if (container.__geoAnimationId) {
            clearInterval(container.__geoAnimationId);
            container.__geoAnimationId = null;
        }
        const playBtn = controls.querySelector('.geo-play-btn');
        if (playBtn) playBtn.textContent = 'Play';

        // if switching to aggregate, reset slider to default and hide it
        const yearSelect = controls.querySelector('.geo-year-select');
        const years = Array.from(new Set((container.__geoRawData || []).map(d => +d.Year || +d.year))).filter(y => !isNaN(y)).sort((a, b) => a - b);
        if (yearSelect) {
            yearSelect.value = years.includes(2025) ? 2025 : years[years.length - 1] || yearSelect.min;
        }

        updateUIForAggregate(now);

        // re-render chart with new mode
        renderGeoChart(container, container.__geoRawData, margins);
    };

    return { aggBtn };
}
