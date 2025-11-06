import * as d3 from "d3";
import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';

// compute boxplot statistics for an array of numeric values
function boxStats(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    const n = sorted.length;
    if (n === 0) return null;
    const q = (p) => {
        const idx = (n - 1) * p;
        const lo = Math.floor(idx);
        const hi = Math.ceil(idx);
        if (lo === hi) return sorted[lo];
        return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
    };
    const q1 = q(0.25);
    const q2 = q(0.5);
    const q3 = q(0.75);
    const iqr = q3 - q1;
    const lower = Math.max(sorted[0], q1 - 1.5 * iqr);
    const upper = Math.min(sorted[n - 1], q3 + 1.5 * iqr);
    return { q1, q2, q3, iqr, lower, upper, min: sorted[0], max: sorted[n - 1] };
}

// Epanechnikov kernel for KDE
function epanechnikovKernel(bandwidth) {
    return function (u) {
        u = u / bandwidth;
        return Math.abs(u) <= 1 ? 0.75 * (1 - u * u) / bandwidth : 0;
    };
}

function kernelDensityEstimator(kernel, X) {
    return function (V) {
        return X.map(x => [x, d3.mean(V, v => kernel(x - v)) || 0]);
    };
}

// weighted kernel density estimator: V is array of {v: value, w: weight}
function kernelDensityEstimatorWeighted(kernel, X) {
    return function (VW) {
        const totalW = d3.sum(VW, d => d.w) || 1;
        return X.map(x => [x, (d3.sum(VW, d => d.w * kernel(x - d.v)) || 0) / totalW]);
    };
}

// parse Age_Group_5yr like "0-4", "5-9", "100+" -> midpoint (number)
function ageGroupMidpoint(s) {
    if (s == null) return NaN;
    const str = String(s).trim();
    const m = str.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) return (+m[1] + +m[2]) / 2;
    const m2 = str.match(/^(\d+)\s*\+$/);
    if (m2) return +m2[1] + 2; // approximate
    const n = +str;
    return isNaN(n) ? NaN : n;
}

// compute weighted quantiles and whiskers from arrays of values and weights
function weightedBoxStats(values, weights) {
    const pairs = values.map((v, i) => ({ v: +v, w: +weights[i] || 0 })).filter(d => !isNaN(d.v) && d.w > 0);
    if (pairs.length === 0) return null;
    pairs.sort((a, b) => a.v - b.v);
    const totalW = d3.sum(pairs, d => d.w);
    const cum = [];
    let s = 0;
    for (const p of pairs) { s += p.w; cum.push(s); }
    const q = (p) => {
        const target = p * totalW;
        for (let i = 0; i < pairs.length; i++) {
            if (cum[i] >= target) {
                if (i === 0) return pairs[0].v;
                const prevCum = cum[i - 1];
                const frac = (target - prevCum) / (cum[i] - prevCum || 1);
                return pairs[i - 1].v * (1 - frac) + pairs[i].v * frac;
            }
        }
        return pairs[pairs.length - 1].v;
    };
    const q1 = q(0.25);
    const q2 = q(0.5);
    const q3 = q(0.75);
    const iqr = q3 - q1;
    const minV = pairs[0].v;
    const maxV = pairs[pairs.length - 1].v;
    const lowerCut = q1 - 1.5 * iqr;
    const upperCut = q3 + 1.5 * iqr;
    const lower = pairs.find(p => p.v >= lowerCut)?.v ?? minV;
    const upper = [...pairs].reverse().find(p => p.v <= upperCut)?.v ?? maxV;
    return { q1, q2, q3, iqr, lower, upper, min: minV, max: maxV };
}

// Renders a vertical boxplot with violin-like density for Male/Female.
// data can be either an array of records or an object of named datasets
export function renderBoxplotChart(container, data, margins) {
    const { width, height } = getContainerDimensions(container);

    // remove previous svg but keep controls wrapper
    const existingSvg = container.querySelector('svg');
    if (existingSvg) existingSvg.remove();

    const svg = createResponsiveSvg(width, height);

    // Persist rawData/datasetKey on the container (like pyramidChart does)
    const rawData = container.__boxplotRawData || data;
    let datasetKey = container.__boxplotDatasetKey || 'population';
    let fullData;

    if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
        // object of named datasets
        const keys = Object.keys(rawData);
        if (!rawData[datasetKey]) datasetKey = keys[0];
        fullData = rawData[datasetKey];
        container.__boxplotRawData = rawData;
        container.__boxplotDatasetKey = datasetKey;
        container.__boxplotFullData = fullData;
    } else {
        // legacy: data is an array
        fullData = container.__boxplotFullData || rawData;
        container.__boxplotFullData = fullData;
        container.__boxplotRawData = null;
        container.__boxplotDatasetKey = null;
    }

    // --- Controls ---
    const countries = Array.from(new Set((fullData || []).map(d => d.Country))).sort();
    const years = Array.from(new Set((fullData || []).map(d => +d.Year))).sort((a, b) => a - b);

    let controls = container.querySelector('.boxplot-controls');
    if (!controls) {
        controls = document.createElement('div');
        controls.className = 'boxplot-controls';
        container.appendChild(controls);
    }

    // dataset selector when multiple named datasets available
    if (container.__boxplotRawData) {
        let ds = controls.querySelector('.boxplot-dataset-select');
        if (!ds) {
            const lbl = document.createElement('label');
            lbl.textContent = 'Dataset: ';
            ds = document.createElement('select');
            ds.className = 'boxplot-dataset-select';
            Object.keys(container.__boxplotRawData).forEach(k => {
                const opt = document.createElement('option');
                opt.value = k;
                opt.text = (k.toLowerCase() === 'population') ? 'Population' : k;
                ds.appendChild(opt);
            });
            ds.value = container.__boxplotDatasetKey || Object.keys(container.__boxplotRawData)[0];
            ds.addEventListener('change', () => {
                container.__boxplotDatasetKey = ds.value;
                renderBoxplotChart(container, container.__boxplotRawData, margins);
            });
            controls.appendChild(lbl);
            controls.appendChild(ds);
        }
    }

    // Sex selector (All / Male / Female)
    let sexSelect = controls.querySelector('.boxplot-sex-select');
    if (!sexSelect) {
        const sLabel = document.createElement('label');
        sLabel.textContent = ' Sex: ';
        sexSelect = document.createElement('select');
        sexSelect.className = 'boxplot-sex-select';
        ['All', 'Male', 'Female'].forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.text = s;
            sexSelect.appendChild(opt);
        });
        sexSelect.value = 'All';
        sexSelect.addEventListener('change', () => renderBoxplotChart(container, container.__boxplotRawData || fullData, margins));
        controls.appendChild(sLabel);
        controls.appendChild(sexSelect);
    }

    // country selector
    let countrySelect = controls.querySelector('.boxplot-country-select');
    if (!countrySelect) {
        const label = document.createElement('label');
        label.textContent = ' Country: ';
        countrySelect = document.createElement('select');
        countrySelect.className = 'boxplot-country-select';
        countries.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.text = c;
            countrySelect.appendChild(opt);
        });
        // sensible default
        countrySelect.value = countries.includes('Syrian Arab Republic') ? 'Syrian Arab Republic' : (countries[0] || '');
        countrySelect.addEventListener('change', () => renderBoxplotChart(container, container.__boxplotRawData || fullData, margins));
        controls.appendChild(label);
        controls.appendChild(countrySelect);
    }

    // year slider
    let yearSelect = controls.querySelector('.boxplot-year-select');
    if (!yearSelect) {
        const yLabel = document.createElement('label');
        yLabel.textContent = ' Year: ';
        yearSelect = document.createElement('input');
        yearSelect.type = 'range';
        yearSelect.className = 'boxplot-year-select';
        const minYear = years.length ? Math.min(...years) : 0;
        const maxYear = years.length ? Math.max(...years) : 0;
        yearSelect.min = minYear;
        yearSelect.max = maxYear;
        yearSelect.step = 1;
        const yearDisplay = document.createElement('span');
        yearDisplay.className = 'boxplot-year-display';
        const defaultYear = years.includes(2023) ? 2023 : (years[years.length - 1] || minYear);
        yearSelect.value = defaultYear;
        yearDisplay.textContent = defaultYear;
        yearSelect.addEventListener('input', () => {
            yearDisplay.textContent = yearSelect.value;
            renderBoxplotChart(container, container.__boxplotRawData || fullData, margins);
        });
        controls.appendChild(yLabel);
        controls.appendChild(yearSelect);
        controls.appendChild(yearDisplay);
    }

    const selectedCountry = countrySelect ? countrySelect.value : (countries[0] || null);
    const selectedYear = yearSelect ? +yearSelect.value : (years[years.length - 1] || null);
    const selectedSex = sexSelect ? sexSelect.value : 'All';

    // filter data for chosen country/year and sex
    let filtered = (fullData || []).filter(d => (!selectedYear || +d.Year === +selectedYear) && (!selectedCountry || d.Country === selectedCountry));
    if (selectedSex && selectedSex !== 'All') filtered = filtered.filter(d => d.Sex === selectedSex);

    // detect numeric value field (Population / Deaths / other) dynamically
    function detectValueField(sampleData) {
        if (!sampleData || sampleData.length === 0) return null;
        const prefer = ['Population', 'Deaths', 'Value', 'Count', 'Fatalities', 'Fatality'];
        const keys = Object.keys(sampleData[0]);
        for (const p of prefer) if (keys.includes(p)) return p;
        for (const k of keys) {
            if (['Country', 'Year', 'Sex', 'Age_Group_5yr', 'Age_Group', 'Age', 'Age group'].includes(k)) continue;
            for (let i = 0; i < Math.min(20, sampleData.length); i++) {
                const v = +sampleData[i][k];
                if (!isNaN(v)) return k;
            }
        }
        return null;
    }

    const valueField = detectValueField(filtered) || 'Population';

    // Build weighted age midpoints: value (age midpoint) and weight (count)
    const VW = filtered.map(d => {
        const ageStr = d.Age_Group_5yr || d['Age group'] || d.Age_Group || d.Age;
        return { v: ageGroupMidpoint(ageStr), w: Math.max(0, +d[valueField] || 0) };
    }).filter(d => !isNaN(d.v) && d.w > 0);

    if (VW.length === 0) {
        svg.append('text').attr('x', width/2).attr('y', height/2).attr('text-anchor','middle').text('No data for selection');
        container.appendChild(svg.node());
        return;
    }

    // compute weighted stats
    const vals = VW.map(d => d.v);
    const ws = VW.map(d => d.w);
    const stats = weightedBoxStats(vals, ws);
    const minAge = d3.min(vals);
    const maxAge = d3.max(vals);

    // vertical box: single category
    const categories = ['All ages'];
    const xBand = d3.scaleBand().domain(categories).range([margins.left, width - margins.right]).padding(0.4);
    const yScale = d3.scaleLinear().domain([Math.max(0, minAge - 2), maxAge + 2]).nice().range([height - margins.bottom, margins.top]);

    // axes
    const xAxis = d3.axisBottom(xBand).tickFormat(() => selectedSex === 'All' ? 'All' : selectedSex);
    const yAxis = d3.axisLeft(yScale).ticks(8).tickFormat(d3.format('.0f'));
    svg.append('g').attr('transform', `translate(0,${height - margins.bottom})`).call(xAxis);
    svg.append('g').attr('transform', `translate(${margins.left},0)`).call(yAxis);

    // draw vertical box using weighted stats
    const cx = (xBand('All ages') || 0) + xBand.bandwidth() / 2;
    const boxWidth = Math.max(24, xBand.bandwidth() * 0.3);
    if (stats) {
        const q1y = yScale(stats.q1);
        const q3y = yScale(stats.q3);
        const medy = yScale(stats.q2);
        const lowy = yScale(stats.lower);
        const upy = yScale(stats.upper);

        // whisker line
        svg.append('line').attr('x1', cx).attr('x2', cx).attr('y1', lowy).attr('y2', upy).attr('stroke', 'currentColor');

        // box
        svg.append('rect')
            .attr('x', cx - boxWidth / 2)
            .attr('y', q3y)
            .attr('width', boxWidth)
            .attr('height', Math.max(1, q1y - q3y))
            .attr('fill', '#60A5FA')
            .attr('opacity', 0.75);

        // median line
        svg.append('line')
            .attr('x1', cx - boxWidth / 2)
            .attr('x2', cx + boxWidth / 2)
            .attr('y1', medy)
            .attr('y2', medy)
            .attr('stroke', '#111')
            .attr('stroke-width', 1.5);

        // caps
        svg.append('line').attr('x1', cx - boxWidth / 4).attr('x2', cx + boxWidth / 4).attr('y1', lowy).attr('y2', lowy).attr('stroke', 'currentColor');
        svg.append('line').attr('x1', cx - boxWidth / 4).attr('x2', cx + boxWidth / 4).attr('y1', upy).attr('y2', upy).attr('stroke', 'currentColor');

        // annotations: total weight and median above box
        const totalW = d3.sum(ws) || 0;
        svg.append('text')
            .attr('x', cx)
            .attr('y', margins.top + 12)
            .attr('text-anchor', 'middle')
            .attr('font-size', 12)
            .text(`n=${d3.format(',')(Math.round(totalW))}  med=${d3.format('.1f')(stats.q2)}`);
    }

    // Violin: density across ages, weighted
    const bandwidth = Math.max((maxAge - minAge) * 0.08, 0.5);
    const kernel = epanechnikovKernel(bandwidth);
    const yVals = d3.range(Math.max(0, minAge - 2), maxAge + 2, Math.max((maxAge - minAge) / 80, 0.5));
    const kdeW = kernelDensityEstimatorWeighted(kernel, yVals);
    const kdeData = kdeW(VW);
    const maxDensity = d3.max(kdeData, d => d[1]) || 1;
    const densityScale = d3.scaleLinear().domain([0, maxDensity]).range([0, xBand.bandwidth() / 2 - 6]);

    // build mirrored polygon
    const right = kdeData.map(d => [cx + densityScale(d[1]), yScale(d[0])]);
    const left = kdeData.slice().reverse().map(d => [cx - densityScale(d[1]), yScale(d[0])]);
    const pts = right.concat(left);
    const area = d3.line().x(d => d[0]).y(d => d[1]).curve(d3.curveCatmullRom);
    svg.append('path').attr('d', area(pts)).attr('fill', '#60A5FA').attr('opacity', 0.25);

    // Title and labels
    const datasetLabel = (container.__boxplotDatasetKey || 'Population');
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', Math.max(18, margins.top / 2))
        .attr('text-anchor', 'middle')
        .attr('font-size', 15)
        .attr('font-weight', 600)
        .text(`${datasetLabel} — Age distribution (${selectedCountry} ${selectedYear})`);

    svg.append('text')
        .attr('transform', `rotate(-90)`)
        .attr('x', -height / 2)
        .attr('y', margins.left - 44)
        .attr('text-anchor', 'middle')
        .attr('font-size', 12)
        .text('Age (years)');

    container.appendChild(svg.node());
}

export default renderBoxplotChart;