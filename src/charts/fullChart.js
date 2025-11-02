import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';
import { createFullChartTooltip } from '../utils/tooltip.js';

export function renderFullBarChart(container, data, margins) {
    const { width, height } = getContainerDimensions(container);

    // clear previous content
    container.innerHTML = "";

    // filter invalid rows
    const filtered = data.filter(d => d.events != null && Number.isFinite(d.events));

    // gather event types and countries (sorted by total events desc)
    const eventTypes = Array.from(new Set(filtered.map(d => d.eventType)));
    const countryTotals = d3.rollup(filtered, v => d3.sum(v, d => d.events), d => d.country);
    const countries = Array.from(countryTotals.entries()).sort((a, b) => b[1] - a[1]).map(([c]) => c);

    // build per-country data object with counts per event type
    const countsByCountry = new Map();
    for (const country of countries) {
        const rows = filtered.filter(d => d.country === country);
        const m = new Map();
        for (const et of eventTypes) {
            const sum = d3.sum(rows.filter(r => r.eventType === et), r => r.events);
            m.set(et, sum || 0);
        }
        countsByCountry.set(country, m);
    }

    // build data array for stacking where values are proportions (0..1)
    const stackedInput = countries.map(country => {
        const row = { country };
        const m = countsByCountry.get(country);
        const total = d3.sum(eventTypes, et => m.get(et));
        for (const et of eventTypes) row[et] = total ? m.get(et) / total : 0;
        row.__total = total;
        return row;
    }).filter(d => d.__total > 0);

    const series = d3.stack().keys(eventTypes)(stackedInput);

    const svg = createResponsiveSvg(width, height);

    const legendWidth = 180;

    const x = d3.scaleLinear()
        .domain([0, 1])
        .range([margins.left, width - margins.right - legendWidth]);

    const y = d3.scaleBand()
        .domain(stackedInput.map(d => d.country))
        .range([margins.top, height - margins.bottom])
        .padding(0.12);

    const color = d3.scaleOrdinal()
        .domain(eventTypes)
        .range(d3.schemeTableau10)
        .unknown('#ccc');

    const formatPct = d3.format('.1%');

    // draw stacks
    const stackGroups = svg.append('g')
        .selectAll('g')
        .data(series)
        .join('g')
        .attr('fill', d => color(d.key));

    const rects = stackGroups
        .selectAll('rect')
        .data(d => d.map((p, i) => ({ key: d.key, country: stackedInput[i].country, x0: p[0], x1: p[1] })))
        .join('rect')
        .attr('x', d => x(d.x0))
        .attr('y', d => y(d.country))
        .attr('width', d => Math.max(0, x(d.x1) - x(d.x0)))
        .attr('height', y.bandwidth())
        .attr('cursor', 'pointer');

    // create tooltip via helper
    const { tooltip, setContent, setVisible, setPosition } = createFullChartTooltip(container);

    // Hover handlers: emphasize the hovered segment, dim other segments of the same bar strongly
    // and set other bars to a higher but not full opacity so the hovered segment stands out.
    rects.on('mouseenter', (_, d) => {
        const hoveredKey = d.key;
        const hoveredCountry = d.country;
        // Set opacities:
        // - segments in the same country but different key -> 0.1
        // - segments in other countries -> 0.8
        // - hovered segment -> 1
        rects.transition().duration(120).style('opacity', function (d0) {
            if (d0.country === hoveredCountry) {
                return d0.key === hoveredKey ? 1 : 0.5;
            }
            return 0.1;
        });

        const total = d3.sum(eventTypes, et => countsByCountry.get(d.country).get(et));
        const pct = d.x1 - d.x0;
        const count = Math.round(pct * total);

        setContent({ country: d.country, key: d.key, pct, count, formatPct });
        setVisible(true);
    }).on('mousemove', (event, d) => {
        const [mx, my] = d3.pointer(event, container);
        // keep tooltip within container bounds
        const ttRect = tooltip.getBoundingClientRect();
        const contRect = container.getBoundingClientRect();
        let left = mx - ttRect.width / 2;
        let top = my + ttRect.height / 3;
        // if overflowing right edge, shift left
        if (left + ttRect.width > contRect.width) left = mx - ttRect.width - 12;
        if (top + ttRect.height > contRect.height) top = my - ttRect.height - 12;

        setPosition(left, top);
    }).on('mouseleave', (_) => {
        // Restore all rect opacities
        rects.transition().duration(120).style('opacity', 1);
        setVisible(false);

    });

    // y axis (countries)
    svg.append('g')
        .attr('transform', `translate(${margins.left},0)`)
        .call(d3.axisLeft(y).tickSizeOuter(0))
        .call(g => g.select('.domain').remove());

    // Legend: event types with color swatches.
    const legendX = width - margins.right - legendWidth + 20;
    const legendY = margins.top;
    const legend = svg.append("g")
        .attr("transform", `translate(${legendX},${legendY})`);

    const legendItem = legend.selectAll("g")
        .data(eventTypes)
        .join("g")
        .attr("transform", (_, i) => `translate(0, ${i * 30})`);

    legendItem.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", d => color(d));

    legendItem.append("text")
        .attr("x", 18)
        .attr("y", 11)
        .attr("font-size", 12)
        .text(d => d);

    container.appendChild(svg.node());
}
