import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';
import { createGroupedChartTooltip } from '../utils/tooltip.js';

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
    const fallback = d3.schemeTableau10;
    const color = d3.scaleOrdinal()
        .domain(eventTypes)
        .range(eventTypes.map((_, i) => fallback[i % fallback.length]))
        .unknown("#ccc");

    // Create the SVG container.
    const svg = createResponsiveSvg(width, height);

    // legend positioning
    const legendWidth = 180;

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

    // Tooltip: use utility to create/manage tooltip
    const { tooltip, setContent, setVisible, setPosition } = createGroupedChartTooltip(container, {
        data,
        eventTypes,
        color,
        width,
        height,
        margins
    });

    const handleMouseMove = (event) => {
        const [mx, my] = d3.pointer(event, container);
        const ttRect = tooltip.getBoundingClientRect();
        const contRect = container.getBoundingClientRect();
        let left = mx + 12;
        let top = my + 12;
        if (left + ttRect.width > contRect.width) left = mx - ttRect.width - 12;
        if (top + ttRect.height > contRect.height) top = my - ttRect.height - 12;
        setPosition(Math.max(4, left), Math.max(4, top));
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
        .on('mouseenter', (event, d) => {
            setContent(d);
            setVisible(true);
            handleMouseMove(event);
        })
        .on('mousemove', handleMouseMove)
        .on('mouseleave', () => {
            setVisible(false);
        });


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
    const legendX = width - margins.right - legendWidth + 20;
    const legendY = margins.top;
    const legend = svg.append("g")
        .attr("transform", `translate(${legendX},${legendY})`);

    const legendItem = legend.selectAll("g")
        .data(eventTypes)
        .join("g")
        .attr('transform', (_, i) => `translate(0, ${i * 30})`);

    legendItem.append('rect')
        .attr('width', 14)
        .attr('height', 14)
        .attr('rx', 3)
        .attr('fill', d => color(d));

    legendItem.append("text")
        .attr("x", 18)
        .attr("y", 11)
        .attr("font-size", 12)
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
