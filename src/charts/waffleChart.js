import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';

export function renderWaffleChart(container, data, margins) {
    const { width, height } = getContainerDimensions(container);

    // clear previous content
    container.innerHTML = "";

    // create responsive svg that fills its parent
    const svg = createResponsiveSvg(width, height);

    const padding = 3; // px between cells
    const gridWidth = 18;
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
        .attr('class', 'cell')
        .attr('width', cellSize)
        .attr('height', cellSize)
        .attr('x', d => d.x * (cellSize + padding))
        .attr('y', d => d.y * (cellSize + padding))
        .attr('fill', d => color(String(d.idx)))
        .attr('rx', roundAmount)
        .attr('ry', roundAmount)
        .style('cursor', 'pointer');

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
        .attr('class', 'legend-item')
        .attr('transform', (_, i) => `translate(0, ${i * 30})`)
        .style('cursor', 'pointer');

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
                .text(`${d3.format('.1f')(d.pct)}% (${d.events})`)
                .attr('x', 20)
                .attr('dy', '1.2em')
                .style('font-size', '11px')
                .attr('fill', '#555');
        });

    // --- Selection handling: clicking a cell or legend item selects the whole group ---
    let selectedIdx = null;

    function updateSelection(idx) {
        selectedIdx = idx;

        // highlight cells: selected group full opacity + stroke, others faded
        cellSel
            .attr('opacity', d => (selectedIdx === null ? 1 : (d.idx === selectedIdx ? 1 : 0.25)))
            .attr('stroke', d => (selectedIdx !== null && d.idx === selectedIdx ? '#000' : 'none'))
            .attr('stroke-width', d => (selectedIdx !== null && d.idx === selectedIdx ? 1.5 : 0));

        // legend highlight
        legendItems.selectAll('rect')
            .attr('stroke', d => (selectedIdx !== null && d.idx === selectedIdx ? '#000' : 'none'))
            .attr('stroke-width', d => (selectedIdx !== null && d.idx === selectedIdx ? 1.5 : 0));

        legendItems.selectAll('text')
            .style('font-weight', d => (selectedIdx !== null && d.idx === selectedIdx ? '700' : '400'));
    }

    // cell click: select group
    cellSel.on('click', (event, d) => {
        const idx = d.idx;
        const next = (selectedIdx === idx) ? null : idx;
        updateSelection(next);
        event.stopPropagation();
    });

    // legend click: select group
    legendItems.on('click', (event, d) => {
        const idx = d.idx;
        const next = (selectedIdx === idx) ? null : idx;
        updateSelection(next);
        event.stopPropagation();
    });

    // clicking empty space clears selection
    svg.on('click', () => updateSelection(null));

    // append the svg to the container
    container.appendChild(svg.node());

    // Recalculate container height based on actual rendered SVG content.
    // Many layouts use a fixed container height; here we compute the SVG
    // bounding box after rendering and resize the container so the chart
    // fills it without extra whitespace.

    const svgNode = svg.node();
    // getBBox requires the node to be in the DOM (we appended it above)
    const bbox = svgNode.getBBox();

    // compute a safe desired height (include any top/bottom margins)
    const desiredHeight = Math.max(50, Math.ceil(bbox.y + bbox.height + margins.top + margins.bottom));

    // set the container height in pixels so the SVG with height:100% will fill it
    container.style.height = desiredHeight + 'px';

    // update the svg viewBox height so it matches the rendered content width/height
    // keep width at least the original width
    const newViewBoxWidth = Math.max(width, Math.ceil(bbox.width));
    const newViewBoxHeight = Math.max(50, Math.ceil(bbox.y + bbox.height));
    svg.attr('viewBox', `0 0 ${newViewBoxWidth} ${newViewBoxHeight}`);
}
