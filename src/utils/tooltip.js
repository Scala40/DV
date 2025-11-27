import * as d3 from "d3";

export function createFullChartTooltip(container) {
    if (window.getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';

    container.appendChild(tooltip);

    function setContent({ country, key, pct, count, formatPct }) {
        tooltip.innerHTML = '';

        const h = document.createElement('h1');
        const strong = document.createElement('strong');
        strong.textContent = country;
        h.appendChild(strong);

        const detail = document.createElement('div');
        const txt = document.createTextNode(`${key}: ${formatPct(pct)} `);
        const span = document.createElement('span');
        span.textContent = `(${count})`;

        detail.appendChild(txt);
        detail.appendChild(span);

        tooltip.appendChild(h);
        tooltip.appendChild(detail);
    }

    function setVisible(visible) {
        tooltip.style.opacity = visible ? '1' : '0';
        tooltip.style.transform = visible ? 'translateY(0px)' : 'translateY(4px)';
    }

    function setPosition(left, top) {
        tooltip.style.left = `${Math.max(4, left)}px`;
        tooltip.style.top = `${Math.max(4, top)}px`;
    }

    return { tooltip, setContent, setVisible, setPosition };
}

export function createGroupedChartTooltip(container, { data, eventTypes, color }) {
    if (window.getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';

    container.appendChild(tooltip);

    function setContent(d) {
        tooltip.innerHTML = '';

        const strong = document.createElement('strong');
        const line = document.createElement('div');

        strong.style.fontSize = '20px';
        strong.textContent = d.country;

        const totalEvents = data.filter(x => x.country === d.country).reduce((sum, x) => sum + x.events, 0);
        line.textContent = `Total Events: ${totalEvents}`;
        line.style.fontSize = '16px';

        tooltip.appendChild(strong);
        tooltip.appendChild(line);

        // Show mini-chart only when hovered bar value is > 0
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
                .style('opacity', 1)
                .attr('stroke-width', 1);

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
    }

    function setVisible(visible) {
        tooltip.style.opacity = visible ? '1' : '0';
        tooltip.style.transform = visible ? 'translateY(0px)' : 'translateY(4px)';
    }

    function setPosition(left, top) {
        tooltip.style.left = `${Math.max(4, left)}px`;
        tooltip.style.top = `${Math.max(4, top)}px`;
    }

    return { tooltip, setContent, setVisible, setPosition };
}

export function createHeatmapTooltip(container) {
    if (window.getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
    }

    const tooltip = document.createElement('div');
    // Use the same tooltip class as other charts so CSS is consistent
    tooltip.className = 'chart-tooltip';
    container.appendChild(tooltip);

    function setContent({ x, y, value }) {
        tooltip.innerHTML = '';
        const line1 = document.createElement('strong');
        line1.textContent = `${y} (${x})`;
        const line2 = document.createElement('div');
        line2.textContent = value == null ? 'No event' : `Events: ${value}`;
        tooltip.appendChild(line1);
        tooltip.appendChild(line2);
    }

    function setVisible(visible) {
        // rely on shared CSS transition and class for appearance
        tooltip.style.opacity = visible ? '1' : '0';
        tooltip.style.transform = visible ? 'translateY(0px)' : 'translateY(4px)';
    }

    function setPosition(left, top) {
        tooltip.style.left = `${Math.max(4, left)}px`;
        tooltip.style.top = `${Math.max(4, top)}px`;
    }

    return { tooltip, setContent, setVisible, setPosition };
}

export function createLineChartTooltip(container, { color }) {
    if (window.getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';
    container.appendChild(tooltip);

    function setContent({ year, rows, selectedCountries }) {
        tooltip.innerHTML = '';

        const header = document.createElement('div');
        header.style.fontWeight = '700';
        header.style.marginBottom = '6px';
        header.textContent = `Year: ${year}`;
        tooltip.appendChild(header);

        const list = document.createElement('div');
        list.style.overflow = 'auto';

        // Sort rows by value descending
        rows.sort((a, b) => {
            if (b.value === null && a.value === null) return 0;
            if (b.value === null) return -1;
            if (a.value === null) return 1;
            return b.value - a.value;
        });

        for (const r of rows) {
            const row = document.createElement('div');
            row.style.margin = '2px 0';
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.justifyContent = 'space-between';
            row.style.gap = '8px';

            const left = document.createElement('div');
            left.style.display = 'flex';
            left.style.alignItems = 'center';
            left.style.gap = '8px';

            const sw = document.createElement('span');
            sw.style.display = 'inline-block';
            sw.style.width = '10px';
            sw.style.height = '10px';
            sw.style.borderRadius = '2px';
            sw.style.background = color(r.country);

            let opacity = 1.0
            if (selectedCountries.size != 0 && !selectedCountries.has(r.country)) {
                opacity = 0.2;
            }
            sw.style.opacity = opacity;

            const name = document.createElement('span');
            name.style.fontSize = '12px';
            name.textContent = r.country;

            left.appendChild(sw);
            left.appendChild(name);

            const val = document.createElement('span');
            val.style.fontSize = '12px';
            val.textContent = r.value !== null ? String(r.value) : '—';

            row.appendChild(left);
            row.appendChild(val);
            list.appendChild(row);
        }

        tooltip.appendChild(list);
    }

    function setVisible(visible) {
        tooltip.style.opacity = visible ? '1' : '0';
        tooltip.style.transform = visible ? 'translateY(0px)' : 'translateY(4px)';
    }

    function setPosition(left, top) {
        tooltip.style.left = `${Math.max(4, left)}px`;
        tooltip.style.top = `${Math.max(4, top)}px`;
    }

    return { tooltip, setContent, setVisible, setPosition };
}
