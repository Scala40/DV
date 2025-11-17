import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';
import { createUnigeOrdinalScale } from '../utils/palette.js';
import { createLineChartTooltip } from '../utils/tooltip.js';

export async function renderLineChart(container, data, margins) {
    const { width, height } = getContainerDimensions(container);

    // Clear previous content
    container.innerHTML = "";
    // ensure container can position absolute tooltip
    container.style.position = container.style.position || "relative";

    const svg = createResponsiveSvg(width, height);

    // Color scale
    const countries = Array.from(new Set(data.map(d => d.country)));
    const color = createUnigeOrdinalScale()
        .domain(countries)
        .unknown("#ccc");

    // Scales
    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.year))
        .range([margins.left, width - margins.right])

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.events)])
        .nice()
        .range([height - margins.bottom, margins.top]);

    // Axes
    const xAxis = d3.axisBottom(xScale)
        .tickFormat(d3.format("d"));

    const yAxis = d3.axisLeft(yScale)
        .ticks(6);

    svg.append("g")
        .attr("transform", `translate(0,${height - margins.bottom})`)
        .call(xAxis);

    const yAxisG = svg.append("g")
        .attr("transform", `translate(${margins.left},0)`)
        .call(yAxis);

    // Remove axis path and tick lines.
    yAxisG.select(".domain").remove();
    yAxisG.selectAll(".tick line").remove();

    // Add grid lines
    yAxisG.selectAll(".tick")
        .filter(d => d !== 0)
        .append("line")
        .attr("x1", 0)
        .attr("x2", width - margins.left - margins.right)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", "#e0e0e0")
        .attr("stroke-dasharray", "4,4");

    // Y axis label with arrows
    const labelX = margins.left - 50; // distance left of the y axis
    const centerY = margins.top + (height - margins.top - margins.bottom) / 2;

    const dirGroup = svg.append("g")
        .attr("transform", `translate(${labelX},0)`)
        .attr("class", "y-direction-label");

    // Main label rotated vertically
    dirGroup.append("text")
        .attr("x", 0)
        .attr("y", centerY)
        .attr("transform", `rotate(-90, 0, ${centerY})`)
        .attr("text-anchor", "middle")
        .attr("font-size", 12)
        .attr("font-weight", "600")
        .attr("fill", "#333")
        .attr("dy", "0.35em")
        .text("Number of Events");

    // Line generator
    const line = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.events));

    // Draw line
    const grouped = d3.group(data, d => d.country);
    const lineData = Array.from(grouped, ([country, values]) => ({ country, values }));

    svg.selectAll(".line")
        .data(lineData)
        .enter()
        .append("path")
        .attr("class", "line")
        .attr("fill", "none")
        .attr("stroke", d => color(d.country))
        .attr("stroke-width", 2.5)
        .attr("stroke-opacity", 1)
        .attr("d", d => line(d.values.sort((a, b) => a.year - b.year)));

    // Add points
    svg.selectAll(".point")
        .data(data)
        .enter()
        .append("circle")
        .attr("class", "point")
        .attr("cx", d => xScale(d.year))
        .attr("cy", d => yScale(d.events))
        .attr("r", 4)
        .attr("fill", d => color(d.country));

    // Add legend near the end of the lines
    const legendX = width - margins.right + 10;
    const legendData = lineData.map(({ country, values }) => {
        const lastPoint = values.reduce((a, b) => (a.year > b.year ? a : b));
        return { country, x: legendX, y: yScale(lastPoint.events) };
    });

    // Ensure there's no overlap in legend labels
    legendData.sort((a, b) => b.y - a.y);
    for (let i = 1; i < legendData.length; i++) {
        const desired = legendData[i - 1].y - 12;
        if (legendData[i].y > desired) {
            legendData[i].y = Math.max(margins.top, desired);
        }
    }

    // Interaction state and helpers
    const selectedCountries = new Set();

    // Apply persistent highlight for a set of countries (empty set => show all)
    function applyHighlightSet(set) {
        if (!set || set.size === 0) {
            svg.selectAll(".line").attr("stroke-opacity", 1);
            svg.selectAll(".point").attr("display", null);
            svg.selectAll(".legend").attr("font-weight", "400");
            svg.selectAll(".hover-point").attr("fill", d => color(d.country));
            return;
        }

        svg.selectAll(".line")
            .attr("stroke-opacity", d => (set.has(d.country) ? 1 : 0.2));

        svg.selectAll(".point")
            .attr("display", d => (set.has(d.country) ? null : "none"));

        svg.selectAll(".hover-point")
            .attr("fill", d => (set.has(d.country) ? color(d.country) : "#ccc"));

        svg.selectAll(".legend")
            .attr("font-weight", d => (set.has(d.country) ? "700" : "400"));
    }

    function clearHighlight() {
        selectedCountries.clear();
        applyHighlightSet(null);
    }

    // Transient highlight (kept as a standalone function to minimize diffs)
    function applyTransientHighlight(country) {
        svg.selectAll(".line").attr("stroke-opacity", d => (d.country === country ? 1 : 0.2));
        svg.selectAll(".point").attr("display", d => (d.country === country ? null : "none"));
        svg.selectAll(".legend").attr("font-weight", d => (d.country === country ? "700" : "400"));
        svg.selectAll(".hover-point").attr("fill", d => (d.country === country ? color(d.country) : "#ccc"));
    }

    function clearTransientHighlight() {
        // restore persistent selection (could be multi) or clear
        applyHighlightSet(selectedCountries.size > 0 ? selectedCountries : null);
    }

    // Legend
    svg.selectAll(".legend")
        .data(legendData)
        .enter()
        .append("text")
        .attr("class", "legend")
        .attr("x", d => d.x + 5)
        .attr("y", d => d.y)
        .attr("dy", "0.35em")
        .attr("font-size", "14px")
        .attr("fill", d => color(d.country))
        .attr("stroke", "rgba(0,0,0,0.12)")
        .attr("stroke-width", 1)
        .style("paint-order", "stroke")
        .style("stroke-linejoin", "round")
        .style("cursor", "pointer")
        .text(d => d.country)
        .on("mouseover", (_, d) => {
            // transient single-country highlight (delegated)
            applyTransientHighlight(d.country);
        })
        .on("mouseout", (_, d) => {
            // restore persistent selection (could be multi) or clear (delegated)
            clearTransientHighlight();
        })
        .on("click", (_, d) => {
            // Toggle membership in selectedCountries (multi-selection)
            if (selectedCountries.has(d.country)) selectedCountries.delete(d.country);
            else selectedCountries.add(d.country);

            if (selectedCountries.size > 0) applyHighlightSet(selectedCountries);
            else clearHighlight();
        });

    // Tooltip and hover interaction
    // prepare sorted unique years
    const sortedYears = Array.from(new Set(data.map(d => d.year))).sort((a, b) => a - b);
    const bisect = d3.bisector(d => d).left;

    // Use centralized tooltip helper (styles live in CSS .chart-tooltip)
    // also grab the tooltip element so we can measure it and avoid overflow when positioning
    const { tooltip, setContent, setVisible, setPosition } = createLineChartTooltip(container, { color });

    // Hover group for vertical line and per-country markers
    const hoverG = svg.append("g")
        .attr("class", "hover")
        .style("pointer-events", "none");
    const vLine = hoverG.append("line")
        .attr("class", "hover-line")
        .attr("y1", margins.top)
        .attr("y2", height - margins.bottom)
        .attr("stroke", "#666")
        .attr("stroke-dasharray", "3,3")
        .attr("stroke-width", 1)
        .style("display", "none");

    // Oerlay to capture mouse events
    svg.append("rect")
        .attr("class", "overlay")
        .attr("x", margins.left)
        .attr("y", margins.top)
        .attr("width", width - margins.left - margins.right)
        .attr("height", height - margins.top - margins.bottom)
        .attr("fill", "none")
        .style("pointer-events", "all")
        .on("mousemove", (event) => {
            const [mx] = d3.pointer(event, svg.node());
            // pointer relative to the container (for tooltip placement)
            const [cMx, cMy] = d3.pointer(event, container);
            const xValue = xScale.invert(mx);

            // Find closest year in sortedYears
            let i = bisect(sortedYears, xValue);
            let closest;
            if (i === 0) closest = sortedYears[0];
            else if (i >= sortedYears.length) closest = sortedYears[sortedYears.length - 1];
            else {
                const a = sortedYears[i - 1], b = sortedYears[i];
                closest = (Math.abs(xValue - a) <= Math.abs(xValue - b)) ? a : b;
            }

            // Update vertical line
            const vx = xScale(closest);
            vLine
                .attr("x1", vx)
                .attr("x2", vx)
                .style("display", null);

            // Prepare per-country values for this year
            const rows = countries.map(country => {
                const vals = grouped.get(country) || [];
                const match = vals.find(dd => dd.year === closest);
                return { country, value: match ? match.events : null };
            });

            // Update hover circles
            const rowsWithValue = rows.filter(r => r.value !== null);
            rowsWithValue.sort((a, b) => {
                const aSel = selectedCountries.has(a.country);
                const bSel = selectedCountries.has(b.country);
                if (aSel === bSel) return 0;
                return aSel ? 1 : -1;
            });

            const hoverPoints = hoverG
                .selectAll(".hover-point")
                .data(rowsWithValue, d => d.country);

            hoverPoints.join(
                enter => enter.append("circle")
                    .attr("class", "hover-point")
                    .attr("r", 5.5)
                    .attr("fill", d => color(d.country))
                    .attr("cx", vx)
                    .attr("cy", d => yScale(d.value)),
                update => update
                    .attr("cx", vx)
                    .attr("cy", d => yScale(d.value)),
                exit => exit.remove()
            );

            // Set tooltip content and show it
            setContent({ year: closest, rows, selectedCountries });
            setVisible(true);

            // Re-apply persistent selection (if any)
            if (selectedCountries.size > 0) {
                applyHighlightSet(selectedCountries);
            }

            // Position tooltip near mouse but keep it inside the container using the tooltip's size
            const ttRect = tooltip.getBoundingClientRect();
            const contRect = container.getBoundingClientRect();
            let left = cMx + 12;
            let top = cMy + 12;
            if (left + ttRect.width > contRect.width) left = cMx - ttRect.width - 12;
            if (top + ttRect.height > contRect.height) top = cMy - ttRect.height / 2;
            setPosition(Math.max(4, left), Math.max(4, top));
        })
        .on("mouseout", () => {
            vLine.style("display", "none");
            hoverG.selectAll(".hover-point")
                .remove();
            setVisible(false);

            // Restore persistent selection or clear
            if (selectedCountries.size > 0) applyHighlightSet(selectedCountries);
            else clearHighlight();
        });

    // Add svg to container
    container.appendChild(svg.node());

    // --- Animation: draw lines + reveal points when chart becomes fully visible ---
    // Prepare initial hidden states so animation can run when triggered.
    // Store final point positions and set points to their final y but keep them invisible (opacity 0).
    // This makes them appear in-place when revealed by the tracer rather than moving up from the baseline.
    // set final cy on points but keep them hidden via style (safer than attribute so transitions behave)
    svg.selectAll('.point').nodes().forEach((pt) => {
        try {
            const d = pt.__data__;
            if (d) pt.setAttribute('data-final-cy', String(yScale(d.events)));
            pt.setAttribute('cy', d ? String(yScale(d.events)) : pt.getAttribute('cy'));
            pt.style.opacity = '0';
            pt.style.transition = 'none';
        } catch (e) { }
    });

    // Prepare lines with dash properties for draw animation
    svg.selectAll('.line').nodes().forEach((path) => {
        try {
            const len = path.getTotalLength();
            path.style.strokeDasharray = len;
            path.style.strokeDashoffset = len;
            // ensure smooth transitions when animating
            path.style.transition = 'stroke-dashoffset 1000ms ease';
            path.style.willChange = 'stroke-dashoffset';
        } catch (e) {
            // ignore if path length can't be measured
        }
    });

    // Cleanup previous observer and timers if re-rendered
    if (container._lineAnimObserver) {
        try { container._lineAnimObserver.disconnect(); } catch (e) { }
        container._lineAnimObserver = null;
    }
    if (container._lineAnimRevealTimeout) {
        try { clearTimeout(container._lineAnimRevealTimeout); } catch (e) { }
        container._lineAnimRevealTimeout = null;
    }

    const playAnimation = () => {
        // draw lines with a small stagger and animate a tracer that follows each path left->right
        const lineNodes = svg.selectAll('.line').nodes();
        const allPointNodes = svg.selectAll('.point').nodes();
        // no stagger: start all lines at the same time
        const stagger = 0; // ms between line starts (0 -> simultaneous)
        const duration = 1200; // ms duration of each line draw

        // prepare array with point positions (cx) and country for reveal logic
        const pointsData = allPointNodes.map(pt => ({
            el: pt,
            cx: Number(pt.getAttribute('cx')),
            finalCy: pt.getAttribute('data-final-cy'),
            revealed: false,
            country: pt.__data__ ? pt.__data__.country : null
        }));

        lineNodes.forEach((path, i) => {
            const len = path.getTotalLength();
            const delay = i * stagger; // ms stagger between lines

            // ensure rounded stroke ends for nicer draw
            path.style.strokeLinecap = 'round';

            // animate stroke dashoffset to draw the line
            path.style.transition = `stroke-dashoffset 900ms ease ${delay}ms`;
            setTimeout(() => {
                path.style.strokeDashoffset = '0';
            }, delay);


            // animate the tracer along the path synchronized with the line draw
            setTimeout(() => {
                tracer.style.opacity = '1';
                const start = performance.now();
                function step(now) {
                    const t = Math.min(1, (now - start) / duration);
                    const traveled = t * len;
                    let pt = null;
                    try { pt = path.getPointAtLength(traveled); } catch (e) { }
                    if (pt) {
                        tracer.setAttribute('cx', pt.x);
                        tracer.setAttribute('cy', pt.y);
                    }


                    if (t < 1) requestAnimationFrame(step);
                    else {
                        // remove tracer after finished
                        try { tracer.parentNode && tracer.parentNode.removeChild(tracer); } catch (e) { }
                    }
                }
                requestAnimationFrame(step);
            }, delay);
        });
        // After the last line finishes drawing, reveal all points all at once
        const lastDelay = Math.max(0, (lineNodes.length - 1) * stagger);
        const revealAfter = lastDelay + duration + 40; // small buffer
        container._lineAnimRevealTimeout = setTimeout(() => {
            // reveal all points by transitioning their opacity to 1
            pointsData.forEach((ptData) => {
                if (ptData.el) {
                    ptData.el.style.transition = 'opacity 500ms ease';
                    ptData.el.style.opacity = '1';
                }
            });
            container._lineAnimRevealTimeout = null;
        }, revealAfter);
    };

    // IntersectionObserver: play when nearly fully visible, reset when out of view
    const obs = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                playAnimation();
            }
        }
    }, { threshold: [0.95] });

    obs.observe(container);
    container._lineAnimObserver = obs;
}
