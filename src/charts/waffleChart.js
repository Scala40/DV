import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';

// Renders a simple, robust waffle chart.
// data: array of { label: string, value: number }
// container: DOM element to render into
export function renderWaffleChart(container, data, margins) {
    const { width: parentWidth, height: parentHeight } = getContainerDimensions(container);

    // clear previous content
    container.innerHTML = "";
    data = [
        { label: 'Territory A', value: 42000 },
        { label: 'Territory B', value: 30000 },
        { label: 'Territory C', value: 18000 },
        { label: 'Territory D', value: 10000 }
    ];

    // create responsive svg that fills its parent
    const svg = createResponsiveSvg(parentWidth, parentHeight);

    const padding = 2; // px between cells
    const gridWidth = 20;
    const gridHeight = 10;
    const cellsCount = gridHeight * gridWidth;

    // compute total and percentages
    const total = d3.sum(data, d => +d.value || 0);
    if (total <= 0) {
        const msg = document.createElement('div');
        msg.textContent = 'Data values must be positive';
        msg.style.color = '#666';
        container.appendChild(msg);
        return;
    }

    // normalized counts (integers summing to cellsCount)
    const raw = data.map(d => ({ label: d.label, value: +d.value }));
    const exact = raw.map(d => (d.value / total) * cellsCount);
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

    // layout calculations
    const innerWidth = Math.max(100, parentWidth - margins.left - margins.right);
    const innerHeight = Math.max(100, parentHeight - margins.top - margins.bottom);
    const cellSize = Math.floor((Math.min(innerWidth, innerHeight) - (gridHeight - 1) * padding) / gridHeight);
    const chartWidth = cellSize * gridWidth + padding * (gridWidth - 1);
    const chartHeight = cellSize * gridHeight + padding * (gridHeight - 1);

    const chartG = svg.append('g');
        
    // color scale
    const color = d3.scaleOrdinal(d3.schemeTableau10).domain(d3.range(data.length).map(String));

    // draw cells
    const cellSel = chartG.selectAll('rect.cell')
        .data(cells.map((d, i) => ({ ...d, i, x: i % gridWidth, y: Math.floor(i / gridWidth) })))
        .join('rect')
        .attr('class', 'cell')
        .attr('width', cellSize)
        .attr('height', cellSize)
        .attr('x', d => d.x * (cellSize + padding))
        .attr('y', d => d.y * (cellSize + padding))
        .attr('fill', d => color(String(d.idx)))
        .attr('rx', Math.max(0, Math.round(cellSize * 0.12)))
        .attr('ry', Math.max(0, Math.round(cellSize * 0.12)));

    // title / tooltip
    cellSel.append('title').text(d => `${data[d.idx].label}`);

    // legend (right side)
    const legendG = svg.append('g')
        .attr('transform', `translate(${(parentWidth + chartWidth) / 2 + 10}, ${margins.top})`);

    const legendItems = legendG.selectAll('g.legend-item')
        .data(raw.map((d, i) => ({ ...d, idx: i, pct: (d.value / total) * 100 })))
        .join('g')
        .attr('class', 'legend-item')
        .attr('transform', (d, i) => `translate(0, ${i * 22})`);

    legendItems.append('rect')
        .attr('width', 14)
        .attr('height', 14)
        .attr('rx', 3)
        .attr('fill', d => color(String(d.idx)));

    legendItems.append('text')
        .attr('x', 20)
        .attr('y', 11)
        .style('font-size', '12px')
        .text(d => `${d.label} — ${d3.format('.1f')(d.pct)}% (${d.value})`);

    // append the svg to the container
    container.appendChild(svg.node());
}