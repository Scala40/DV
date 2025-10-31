import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';

export function renderGroupedBarChart(container, data, margins) {
    const { width, height } = getContainerDimensions(container);

    // clear previous content
    container.innerHTML = "";

    // Build list of event types and countries sorted by total fatalities (desc).
    const eventTypes = Array.from(new Set(data.map(d => d.eventType)));

    // Sum fatalities per country and sort countries by total (largest first).
    const countryTotals = d3.rollup(data, v => d3.sum(v, d => d.events), d => d.country);
    const countries = Array.from(countryTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([country]) => country);

    // x0 positions each country's group horizontally.
    const x0 = d3.scaleBand()
        .domain(countries)
        .range([margins.left, width - margins.right])
        .paddingInner(0.12);

    // x1 positions event types inside each country's band.
    const x1 = d3.scaleBand()
        .domain(eventTypes)
        .range([0, x0.bandwidth()])
        .padding(0.05);

    // y is the linear scale for fatalities (vertical height of bars).
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.events) || 0])
        .nice()
        .range([height - margins.bottom, margins.top]);

    // color per event type; safe fallback palette if needed.
    const spectral = d3.schemeSpectral[eventTypes.length];
    const fallback = d3.schemeTableau10;
    const color = d3.scaleOrdinal()
        .domain(eventTypes)
        .range(spectral && spectral.length === eventTypes.length ? spectral : eventTypes.map((_, i) => fallback[i % fallback.length]))
        .unknown("#ccc");

    // Create the SVG container.
    const svg = createResponsiveSvg(width, height);

    // Create one group per country and translate it into place horizontally.
    const countryGroups = svg.append("g")
        .selectAll("g")
        .data(countries)
        .join("g")
        .attr("transform", d => `translate(${x0(d)},0)`);

    // For each country, draw rects only for event types present in the data.
    const rects = countryGroups.selectAll("rect")
        .data(country => data.filter(d => d.country === country))
        .join("rect")
        .attr("x", d => x1(d.eventType))
        .attr("y", d => y(d.events))
        .attr("width", x1.bandwidth())
        .attr("height", d => Math.max(0, y(0) - y(d.events)))
        .attr("fill", d => color(d.eventType))
        .attr('cursor', 'pointer');

    // Tooltip: HTML element for hover interactions
    if (window.getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
    }
    // Remove previous tooltip if re-rendering
    const prev = container.querySelector('.d3-tooltip-grouped');
    if (prev) prev.remove();

    const tooltip = document.createElement('div');
    tooltip.className = 'd3-tooltip-grouped';
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

    const handleMouseEnter = (event, d) => {
        // Base tooltip content
        tooltip.innerHTML = `<strong style="font-size: 20px;">${d.country}</strong>`;

        // remove any previous mini-chart
        const prevSvg = tooltip.querySelector('svg');
        if (prevSvg) prevSvg.remove();

        // Show mini-chart only when hovered bar value is within the low-value range
        if (d.events > 0) {
            const countryData = data.filter(x => x.country === d.country);
            const countryMax = d3.max(countryData, x => x.events) || 0;

            // create an svg inside tooltip to show the country's breakdown with a local y-scale
            const miniWidth = 400;
            const miniHeight = 200;
            const miniMargin = { top: 20, right: 6, bottom: 20, left: 50 };
            const miniInnerW = miniWidth - miniMargin.left - miniMargin.right;
            const miniInnerH = miniHeight - miniMargin.top - miniMargin.bottom;
            // Keep the mini-chart eventType order the same as the main chart by sorting in-place
            countryData.sort((a, b) => {
                const ia = eventTypes.indexOf(a.eventType);
                const ib = eventTypes.indexOf(b.eventType);
                return ia - ib;
            });
            const miniSvg = d3.select(tooltip)
                .append('svg')
                .attr('width', miniWidth)
                .attr('height', miniHeight)
                .style('display', 'block')
                .style('margin-top', '8px');

            const miniG = miniSvg.append('g')
                .attr('transform', `translate(${miniMargin.left},${miniMargin.top})`);

            const miniX = d3.scaleBand()
                .domain(countryData.map(c => c.eventType))
                .range([0, miniInnerW])
                .padding(0.15);

            const miniY = d3.scaleLinear()
                .domain([0, Math.max(countryMax, 1)])
                .range([miniInnerH, 0]);

            // bars
            miniG.selectAll('rect')
                .data(countryData)
                .join('rect')
                .attr('x', d2 => miniX(d2.eventType))
                .attr('y', d2 => miniY(d2.events))
                .attr('width', miniX.bandwidth())
                .attr('height', d2 => Math.max(0, miniInnerH - miniY(d2.events)))
                .attr('fill', d2 => color(d2.eventType))
                .style('opacity', d2 => d2.eventType === d.eventType ? 1 : 0.9)
                .attr('stroke-width', d2 => d2.eventType === d.eventType ? 1 : 0);

            // add value labels above each mini bar
            miniG.selectAll('text.bar-value')
                .data(countryData)
                .join('text')
                .attr('class', 'bar-value')
                .attr('x', d2 => miniX(d2.eventType) + miniX.bandwidth() / 2)
                .attr('y', d2 => miniY(d2.events) - 6)
                .attr('text-anchor', 'middle')
                .attr('font-size', 11)
                .attr('fill', '#111')
                .text(d2 => d3.format(',')(d2.events));


            // y axis
            miniG.append('g')
                .call(d3.axisLeft(miniY).ticks(4).tickFormat(d3.format(',')))
                .selectAll('text')
                .style('font-size', '10px');
        }

        tooltip.style.opacity = '1';
        tooltip.style.transform = 'translateY(0px)';
    };

    const handleMouseMove = (event) => {
        const [mx, my] = d3.pointer(event, container);
        const ttRect = tooltip.getBoundingClientRect();
        const contRect = container.getBoundingClientRect();
        let left = mx + 12;
        let top = my + 12;
        if (left + ttRect.width > contRect.width) left = mx - ttRect.width - 12;
        if (top + ttRect.height > contRect.height) top = my - ttRect.height - 12;
        tooltip.style.left = `${Math.max(4, left)}px`;
        tooltip.style.top = `${Math.max(4, top)}px`;
    };

    const handleMouseLeave = () => {
        const prevSvg2 = tooltip.querySelector('svg');
        if (prevSvg2) prevSvg2.remove();
        tooltip.style.opacity = '0';
        tooltip.style.transform = 'translateY(4px)';
    };

    // Create invisible hit areas positioned near the top of each bar so hovering close to the bar head triggers the popup.
    const hitPadding = 5; // horizontal padding (px)
    const hitZoneAbove = 50; // px above the bar top to include in hit area
    const hitZoneBelow = height;  // px below the bar top to include in hit area

    const overlays = countryGroups.selectAll('rect.hit')
        .data(country => data.filter(d => d.country === country))
        .join('rect')
        .attr('class', 'hit')
        .attr('x', d => x1(d.eventType) - hitPadding / 2)
        .attr('width', d => x1.bandwidth() + hitPadding)
        .attr('y', d => {
            // position the top of the hit zone above the bar top but not above the chart area
            const candidateTop = y(d.events) - hitZoneAbove;
            return Math.max(margins.top, candidateTop);
        })
        .attr('height', d => {
            // bottom of zone is slightly below bar top, but not below the chart bottom
            const top = Math.max(margins.top, y(d.events) - hitZoneAbove);
            const bottom = Math.min(height - margins.bottom, y(d.events) + hitZoneBelow);
            return Math.max(8, bottom - top);
        })
        .style('fill', 'transparent')
        .style('pointer-events', 'all')
        .style('cursor', 'pointer')
        .on('mouseenter', handleMouseEnter)
        .on('mousemove', handleMouseMove)
        .on('mouseleave', handleMouseLeave);


    // Append the x axis (countries) at the bottom and rotate labels 45°.
    svg.append("g")
        .attr("transform", `translate(0,${height - margins.bottom})`)
        .call(d3.axisBottom(x0).tickSizeOuter(0))
        .call(g => g.selectAll(".domain").remove())
        .call(g => g.selectAll("text")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end")
            .attr("dx", "-0.6em")
            .attr("dy", "0.25em")
        );

    // Append the y axis (events) on the left.
    const formatK = d3.format(".2s");
    svg.append("g")
        .attr("transform", `translate(${margins.left},0)`)
        .call(d3.axisLeft(y).ticks(null, "s").tickFormat(formatK))
        .call(g => g.selectAll(".domain").remove());

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

    const title = "Events types in Middle Eastern countries (2020-today)";
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", margins.top / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", 14)
        .attr("font-weight", "bold")
        .text(title);

    // Append the SVG to the container.
    container.appendChild(svg.node());
}
