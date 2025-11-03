import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';
import { createHeatmapTooltip } from '../utils/tooltip.js';

export function renderHeatmapChart(container, data, margins) {
    const { width, height } = getContainerDimensions(container);

    // clear previous content
    container.innerHTML = "";

    // create responsive svg that fills its parent
    const svg = createResponsiveSvg(width, height);

    const innerWidth = Math.max(0, width - margins.left - margins.right);
    const innerHeight = Math.max(0, height - margins.top - margins.bottom);

    // Create a group for the heatmap
    const g = svg.append("g")
        .attr("transform", `translate(${margins.left},${margins.top})`);

    // Prepare full grid of years x countries; where data is missing, value will be null
    const years = Array.from(new Set(data.map(d => d.year))).sort();
    const countries = Array.from(new Set(data.map(d => d.country))).sort();

    // Build lookup for existing values
    const lookup = new Map();
    data.forEach(d => lookup.set(`${d.year}||${d.country}`, +d.events));

    const cells = [];
    for (const y of years) {
        for (const c of countries) {
            const key = `${y}||${c}`;
            const val = lookup.has(key) ? lookup.get(key) : null;
            cells.push({ x: y, y: c, value: val });
        }
    }

    const xScale = d3.scaleBand().domain(years).range([0, innerWidth]).padding(0.05);
    const yScale = d3.scaleBand().domain(countries).range([0, innerHeight]).padding(0.05);

    // color scale only considers numeric values (ignore nulls)
    const numericValues = cells.filter(d => d.value != null).map(d => +d.value);
    const vmin = numericValues.length ? d3.min(numericValues) : 0;
    const vmax = numericValues.length ? d3.max(numericValues) : 1;
    const color = d3.scaleSequential(d3.interpolateYlOrRd).domain([vmin === vmax ? vmin - 1 : vmin, vmax]);

    // axes
    g.append("g")
        .attr("class", "x axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0))
        .call(g => g.select(".domain").remove())
        .selectAll("text")
        .attr("dy", "1.35em")
        .attr("dx", "-0.5em")
        .attr("transform", "rotate(0)")
        .style("text-anchor", "end");

    g.append("g")
        .attr("class", "y axis")
        .call(d3.axisLeft(yScale).tickSize(0))
        .call(g => g.select(".domain").remove());

    // tooltip (moved to shared utility)
    const { tooltip, setContent, setVisible, setPosition } = createHeatmapTooltip(container);

    g.selectAll("rect")
        .data(cells)
        .join("rect")
        .attr("x", d => xScale(d.x))
        .attr("y", d => yScale(d.y))
        .attr("width", xScale.bandwidth())
    .attr("height", yScale.bandwidth())
    .attr("fill", d => d.value == null ? '#ffffff' : color(d.value))
        .style("stroke", "#fff")
        .on("mousemove", (event, d) => {
            const [mx, my] = d3.pointer(event, container);
            setContent({ x: d.x, y: d.y, value: d.value });
            setPosition(mx + 8, my + 8);
            setVisible(true);
        })
        .on("mouseleave", () => {
            setVisible(false);
        });

    // colorbar (vertical) legend placed to the right of the plot
    const legendWidth = 12;
    const legendHeight = innerHeight; // span full plot height
    const legendGap = 20;
    const legendX = innerWidth + legendGap; // inside g coordinates
    const legendY = 0;

    const defs = g.append("defs");
    const gradientId = `heatmap-gradient-${Math.random().toString(36).slice(2, 9)}`;
    // vertical gradient (top -> bottom)
    const grad = defs.append("linearGradient").attr("id", gradientId).attr("x1", "0%").attr("x2", "0%").attr("y1", "0%").attr("y2", "100%");

    const stops = d3.range(0, 1.01, 0.05);
    stops.forEach(t => grad.append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", color(vmin + (1 - t) * (vmax - vmin)))
    );

    const legendG = g.append('g').attr('class', 'heatmap-legend').attr('transform', `translate(${legendX}, ${legendY})`);

    // gradient rect (vertical)
    legendG.append('rect')
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .style('fill', `url(#${gradientId})`)
        .attr('stroke', '#ddd');

    // axis at the right of gradient: map numeric domain to vertical pixels
    const legendScale = d3.scaleLinear().domain([vmin, vmax]).range([legendHeight, 0]);
    // choose tick count based on legend height (more ticks for taller legends), but cap to avoid clutter
    const ticksCount = Math.min(12, Math.max(4, Math.floor(legendHeight / 25)));
    legendG.append('g')
        .attr('transform', `translate(${legendWidth}, 0)`)
        .call(d3.axisRight(legendScale).ticks(ticksCount))
        .call(g => g.select('.domain').remove())
        .selectAll('text')
        .style('font-size', '10px');

    // 'No data' swatch and label placed directly beneath the gradient
    const swX = legendX; // align with left edge of gradient
    const swY = legendY + legendHeight + 8; // just below gradient with small gap
    const swGroup = g.append('g').attr('transform', `translate(${swX}, ${swY})`);
    swGroup.append('rect').attr('width', 14).attr('height', 14).attr('fill', '#ffffff').attr('stroke', '#ccc');
    swGroup.append('text').attr('x', 18).attr('y', 11).attr('font-size', 11).attr('fill', '#111').text('No data');

    container.appendChild(svg.node());


}