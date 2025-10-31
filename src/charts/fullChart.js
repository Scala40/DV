import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';

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

    const x = d3.scaleLinear()
        .domain([0, 1])
        .range([margins.left, width - margins.right- 180]);

    const y = d3.scaleBand()
        .domain(stackedInput.map(d => d.country))
        .range([margins.top, height - margins.bottom])
        .padding(0.12);

    const color = d3.scaleOrdinal()
        .domain(eventTypes)
        .range(d3.schemeSpectral[eventTypes.length] || d3.schemeTableau10)
        .unknown('#ccc');

    const formatPct = d3.format('.0%');

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

    // Create an HTML tooltip inside the chart container for hover interactions.
    // Ensure the container is positioned so the absolute tooltip can be placed correctly.
    if (window.getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
    }
    const tooltip = document.createElement('div');
    tooltip.style.position = 'absolute';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.background = 'white';
    tooltip.style.border = '1px solid rgba(0,0,0,0.12)';
    tooltip.style.padding = '6px 8px';
    tooltip.style.borderRadius = '6px';
    tooltip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
    tooltip.style.fontSize = '12px';
    tooltip.style.opacity = '0';
    tooltip.style.transition = 'opacity 120ms ease, transform 120ms ease';
    tooltip.style.transform = 'translateY(4px)';
    container.appendChild(tooltip);

    // Hover handlers: dim non-hovered bars, and show percentage + absolute count
    rects.on('mouseenter', (event, d) => {
        // Dim all rects then highlight the hovered one
        rects.transition().duration(120).style('opacity', 0.35);
        d3.select(event.currentTarget).transition().duration(120).style('opacity', 1);

        const total = d3.sum(eventTypes, et => countsByCountry.get(d.country).get(et));
        const pct = d.x1 - d.x0;
        const count = Math.round(pct * total);
        tooltip.innerHTML = `<h1 style="margin:0"><strong>${d.country}</strong></h1><div style="margin-top:6px">${d.key}: ${formatPct(pct)} <span style="color:#666">(${count})</span></div>`;
        tooltip.style.opacity = '1';
        tooltip.style.transform = 'translateY(0px)';
    }).on('mousemove', (event, d) => {
        const [mx, my] = d3.pointer(event, container);
        // keep tooltip within container bounds
        const ttRect = tooltip.getBoundingClientRect();
        const contRect = container.getBoundingClientRect();
        let left = mx + 12;
        let top = my + 12;
        // if overflowing right edge, shift left
        if (left + ttRect.width > contRect.width) left = mx - ttRect.width - 12;
        if (top + ttRect.height > contRect.height) top = my - ttRect.height - 12;
        tooltip.style.left = `${Math.max(4, left)}px`;
        tooltip.style.top = `${Math.max(4, top)}px`;
    }).on('mouseleave', (event) => {
        // Restore all rect opacities
        rects.transition().duration(120).style('opacity', 1);
        tooltip.style.opacity = '0';
        tooltip.style.transform = 'translateY(4px)';
    });

    // x axis (percent)
    svg.append('g')
        .attr('transform', `translate(0, ${height - margins.bottom})`)
        .call(d3.axisBottom(x).ticks(20).tickFormat(d3.format('.0%')))
        .call(g => g.select('.domain').remove());

    // y axis (countries)
    svg.append('g')
        .attr('transform', `translate(${margins.left},0)`)
        .call(d3.axisLeft(y).tickSizeOuter(0))
        .call(g => g.select('.domain').remove());

        // Legend: event types with color swatches.
    const legendX = width - margins.right - 160;
    const legendY = margins.top;
    const legend = svg.append("g")
        .attr("transform", `translate(${legendX},${legendY})`);

    const legendItem = legend.selectAll("g")
        .data(eventTypes)
        .join("g")
        .attr("transform", (d, i) => `translate(0, ${i * 20})`);

    legendItem.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", d => color(d));

    legendItem.append("text")
        .attr("x", 18)
        .attr("y", 10)
        .attr("font-size", 12)
        .attr("fill", "#111")
        .text(d => d);

    const title = "Events types in Middle Eastern countries in percentage (2020-today)";
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", margins.top / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", 14)
        .attr("font-weight", "bold")
        .text(title);
    container.appendChild(svg.node());
}
