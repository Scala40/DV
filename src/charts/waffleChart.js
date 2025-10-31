import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';

export function renderWaffleChart(container, data, margins) {
    const { width, height } = getContainerDimensions(container);

    // clear previous content
    container.innerHTML = "";

    // create responsive svg that fills its parent
    const svg = createResponsiveSvg(width, height);

    const padding = 3; // px between cells
    const gridWidth = 20;
    const gridHeight = 10;
    const cellsCount = gridHeight * gridWidth;

    // compute total and percentages
    const total = d3.sum(data, d => +d.events || 0);

    // normalized counts (integers summing to cellsCount)
    const raw = data.map(d => ({ eventType: d.eventType, events: +d.events }));
    const exact = raw.map(d => (d.events / total) * cellsCount);
    const floorCounts = exact.map(Math.floor);
    let assigned = d3.sum(floorCounts);
    const remains = exact.map((v, i) => ({ idx: i, frac: v - Math.floor(v) }));

    // distribute remaining cells by largest fractional parts
    remains.sort((a, b) => b.frac - a.frac);
    for (let i = 0; assigned < cellsCount; i++) {
        floorCounts[remains[i % remains.length].idx] += 1;
        assigned += 1;
    }

    // build array of cells with category index
    const cells = [];
    floorCounts.forEach((count, idx) => {
        for (let i = 0; i < count; i++) cells.push({ idx });
    });

    // ensure length exactly cellsCount
    if (cells.length > cellsCount) cells.length = cellsCount;
    while (cells.length < cellsCount) cells.push({ idx: 0 });

    // legend positioning
    const legendWidth = 180;

    // layout calculations (respect margins on all sides)
    const innerWidth = Math.max(100, width - margins.left - margins.right - legendWidth);
    const innerHeight = Math.max(100, height - margins.top - margins.bottom);

    // compute cell size independently for width and height and pick the smaller
    const cellSizeW = Math.floor((innerWidth - (gridWidth - 1) * padding) / gridWidth);
    const cellSizeH = Math.floor((innerHeight - (gridHeight - 1) * padding) / gridHeight);
    const cellSize = Math.max(1, Math.min(cellSizeW, cellSizeH));

    // position chartG inside the margin box and center it inside the inner area
    const chartGX = margins.left;
    const chartGY = margins.top;
    const chartG = svg.append('g')
        .attr('transform', `translate(${chartGX},${chartGY})`);

    // color scale
    const color = d3.scaleOrdinal(d3.schemeTableau10)
        .domain(d3.range(data.length).map(String));

    // draw cells
    const roundAmount = Math.max(0, Math.round(cellSize * 0.12));
    const cellSel = chartG.selectAll('rect.cell')
        .data(cells.map((d, i) => ({ ...d, i, x: i % gridWidth, y: Math.floor(i / gridWidth) })))
        .join('rect')
        .attr('width', cellSize)
        .attr('height', cellSize)
        .attr('x', d => d.x * (cellSize + padding))
        .attr('y', d => d.y * (cellSize + padding))
        .attr('fill', d => color(String(d.idx)))
        .attr('rx', roundAmount)
        .attr('ry', roundAmount);

    // title / tooltip
    cellSel.append('title').text(d => `${data[d.idx].eventType}`);

    // legend: positioned to the right of the chart
    const legendX = margins.left + innerWidth + 10;
    const legendY = margins.top;
    const legendG = svg.append('g')
        .attr('transform', `translate(${legendX},${legendY})`);

    const legendItems = legendG.selectAll('g.legend-item')
        .data(raw.map((d, i) => ({ ...d, idx: i, pct: (d.events / total) * 100 })))
        .join('g')
        .attr('transform', (_, i) => `translate(0, ${i * 30})`);

    legendItems.append('rect')
        .attr('width', 14)
        .attr('height', 14)
        .attr('rx', 3)
        .attr('fill', d => color(String(d.idx)));

    legendItems.append('text')
        .attr('x', 20)
        .attr('y', 0)
        .style('font-size', '12px')
        .each(function (d) {
            const t = d3.select(this);
            t.append('tspan')
                .text(d.eventType)
                .attr('x', 20)
                .attr('dy', '0.9em');
            t.append('tspan')
                .text(` — ${d3.format('.1f')(d.pct)}% (${d.events})`)
                .attr('x', 20)
                .attr('dy', '1.2em')
                .style('font-size', '11px')
                .attr('fill', '#555');
        });

    // append the svg to the container
    container.appendChild(svg.node());
}
