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

    // Persist rawData/datasetKey on the container (like boxplotChart does)
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
        // layout: two centered rows
        controls.style.display = 'flex';
        controls.style.flexDirection = 'column';
        controls.style.alignItems = 'center';
        controls.style.gap = '8px';
        container.appendChild(controls);
    }

    // top row: dataset & country selectors (and optional sex)
    let rowTop = controls.querySelector('.boxplot-controls-row-top');
    if (!rowTop) {
        rowTop = document.createElement('div');
        rowTop.className = 'boxplot-controls-row-top';
        rowTop.style.display = 'flex';
        rowTop.style.justifyContent = 'center';
        rowTop.style.alignItems = 'center';
        rowTop.style.gap = '10px';
        controls.appendChild(rowTop);
    }
    // bottom row: year slider + play button
    let rowBottom = controls.querySelector('.boxplot-controls-row-bottom');
    if (!rowBottom) {
        rowBottom = document.createElement('div');
        rowBottom.className = 'boxplot-controls-row-bottom';
        rowBottom.style.display = 'flex';
        rowBottom.style.justifyContent = 'center';
        rowBottom.style.alignItems = 'center';
        rowBottom.style.gap = '10px';
        controls.appendChild(rowBottom);
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
            rowTop.appendChild(lbl);
            rowTop.appendChild(ds);
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
        rowTop.appendChild(sLabel);
        rowTop.appendChild(sexSelect);
    }

    // two country selectors: Country A and Country B
    let countrySelectA = controls.querySelector('.boxplot-country-select-a');
    let countrySelectB = controls.querySelector('.boxplot-country-select-b');
    if (!countrySelectA) {
        const labelA = document.createElement('label');
        labelA.textContent = 'Left : ';
        countrySelectA = document.createElement('select');
        countrySelectA.className = 'boxplot-country-select-a';
        countrySelectA.style.color = 'var(--color-scienze-mfn)';
        countries.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.text = c;
            countrySelectA.appendChild(opt);
        });
        // sensible default A
        countrySelectA.value = countries[0]
        countrySelectA.addEventListener('change', () => renderBoxplotChart(container, container.__boxplotRawData || fullData, margins));
        rowTop.appendChild(labelA);
        rowTop.appendChild(countrySelectA);
    }
    if (!countrySelectB) {
        const labelB = document.createElement('label');
        labelB.textContent = 'Right : ';
        countrySelectB = document.createElement('select');
        countrySelectB.className = 'boxplot-country-select-b';
        countrySelectB.style.color = 'var(--color-architettura-design)';
        countries.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.text = c;
            countrySelectB.appendChild(opt);
        });
        // default B: pick second country if available or different from A
        countrySelectB.value = countries[1] && countries[1] !== countrySelectA.value ? countries[1] : (countries[0] === countrySelectA.value ? countries[1] || countries[0] : countries[0]);
        countrySelectB.addEventListener('change', () => renderBoxplotChart(container, container.__boxplotRawData || fullData, margins));
        rowTop.appendChild(labelB);
        rowTop.appendChild(countrySelectB);
    }
    // Year slider

    let yearSelect = controls.querySelector('.boxplot-year-select');
    if (!yearSelect) {
        const yLabel = document.createElement('label');
        yLabel.textContent = 'Year: ';

        // create a slider (range input) for years
        yearSelect = document.createElement('input');
        yearSelect.type = 'range';
        yearSelect.className = 'boxplot-year-select';
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        yearSelect.min = minYear;
        yearSelect.max = maxYear;
        yearSelect.step = 1;

        // display current value
        const yearDisplay = document.createElement('span');
        yearDisplay.className = 'boxplot-year-display';

        const defaultYear = years.includes(2023) ? 2023 : years[0];
        yearSelect.value = defaultYear;
        yearDisplay.textContent = defaultYear;

        // helper to update range fill (colored track up to thumb)
        function updateYearSliderFill() {
            const min = +yearSelect.min;
            const max = +yearSelect.max;
            const val = +yearSelect.value;
            const pct = (val - min) / (max - min) * 100;
            
            yearSelect.style.setProperty('--pct', `${pct}%`);
        }

        // initialize fill
        updateYearSliderFill();

        // update display when slider moves
        yearSelect.addEventListener('input', () => {
            yearDisplay.textContent = yearSelect.value;
            // update visual fill
            updateYearSliderFill();
            // live update the chart while sliding
            renderBoxplotChart(container, fullData, margins);
            // if user moves the slider manually, stop any running animation
            if (container.__boxplotAnimationId) {
                clearInterval(container.__boxplotAnimationId);
                container.__boxplotAnimationId = null;
                const playBtn = controls.querySelector('.boxplot-play-btn');
                if (playBtn) playBtn.textContent = 'Play';
            }
        });
        rowBottom.appendChild(yLabel);
        rowBottom.appendChild(yearSelect);
        rowBottom.appendChild(yearDisplay);


        // Play/Stop button to animate the slider through the years
        let playBtn = controls.querySelector('.boxplot-play-btn');
        if (!playBtn) {
            playBtn = document.createElement('button');
            playBtn.className = 'boxplot-play-btn';
            playBtn.textContent = 'Play';
            rowBottom.appendChild(playBtn);

            playBtn.addEventListener('click', () => {
                // toggle animation
                if (container.__boxplotAnimationId) {
                    clearInterval(container.__boxplotAnimationId);
                    container.__boxplotAnimationId = null;
                    playBtn.textContent = 'Play';
                    return;
                }

                playBtn.textContent = 'Stop';
                const minY = +yearSelect.min;
                const maxY = +yearSelect.max;
                let current = +yearSelect.value || minY;
                // if currently at max, start from min
                if (current >= maxY) current = minY - 1;
                const stepMs = 400; // milliseconds per year step
                container.__boxplotAnimationId = setInterval(() => {
                    current += 1;
                    if (current > maxY) {
                        clearInterval(container.__boxplotAnimationId);
                        container.__boxplotAnimationId = null;
                        playBtn.textContent = 'Play';
                        return;
                    }
                    yearSelect.value = current;
                    const disp = controls.querySelector('.boxplot-year-display');
                    if (disp) disp.textContent = current;
                    // update fill before rendering
                    updateYearSliderFill();
                    renderBoxplotChart(container, fullData, margins);
                }, stepMs);
            });
        }
    }


    const selectedCountryA = countrySelectA ? countrySelectA.value : (countries[0] || null);
    const selectedCountryB = countrySelectB ? countrySelectB.value : (countries[1] || selectedCountryA || null);
    const selectedYear = yearSelect ? +yearSelect.value : (years[years.length - 1] || null);
    const selectedSex = sexSelect ? sexSelect.value : 'All';

    // filter data for chosen countries/year and sex (produce two datasets)
    let filteredA = (fullData || []).filter(d => (!selectedYear || +d.Year === +selectedYear) && (!selectedCountryA || d.Country === selectedCountryA));
    let filteredB = (fullData || []).filter(d => (!selectedYear || +d.Year === +selectedYear) && (!selectedCountryB || d.Country === selectedCountryB));
    if (selectedSex && selectedSex !== 'All') {
        filteredA = filteredA.filter(d => d.Sex === selectedSex);
        filteredB = filteredB.filter(d => d.Sex === selectedSex);
    }

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

    // detect value field from the full dataset (not a filtered variable that was removed)
    const valueField = detectValueField(fullData) || 'Population';

    // Build weighted age midpoints for A and B: value (age midpoint) and weight (count)
    const VW_A = filteredA.map(d => {
        const ageStr = d.Age_Group_5yr || d['Age group'] || d.Age_Group || d.Age;
        return { v: ageGroupMidpoint(ageStr), w: Math.max(0, +d[valueField] || 0) };
    }).filter(d => !isNaN(d.v) && d.w > 0);
    const VW_B = filteredB.map(d => {
        const ageStr = d.Age_Group_5yr || d['Age group'] || d.Age_Group || d.Age;
        return { v: ageGroupMidpoint(ageStr), w: Math.max(0, +d[valueField] || 0) };
    }).filter(d => !isNaN(d.v) && d.w > 0);

    if (VW_A.length === 0 && VW_B.length === 0) {
        svg.append('text').attr('x', width / 2).attr('y', height / 2).attr('text-anchor', 'middle').text('No data for selection');
        container.appendChild(svg.node());
        return;
    }

    // compute weighted stats for each (may be null if no data)
    const valsA = VW_A.map(d => d.v);
    const wsA = VW_A.map(d => d.w);
    const statsA = VW_A.length ? weightedBoxStats(valsA, wsA) : null;

    const valsB = VW_B.map(d => d.v);
    const wsB = VW_B.map(d => d.w);
    const statsB = VW_B.length ? weightedBoxStats(valsB, wsB) : null;

    const minAge = d3.min([d3.min(valsA) || Infinity, d3.min(valsB) || Infinity]);
    const maxAge = d3.max([d3.max(valsA) || -Infinity, d3.max(valsB) || -Infinity]);

    // vertical boxes: two categories (Country A, Country B)
    const nameA = selectedCountryA || 'A';
    const nameB = selectedCountryB || 'B';
    const categories = [nameA, nameB];
    const xBand = d3.scaleBand().domain(categories).range([margins.left, width - margins.right]).padding(0.4);
    const yScale = d3.scaleLinear().domain([Math.max(0, minAge - 2), maxAge + 2]).nice().range([height - margins.bottom, margins.top]);

    // axes
    const yAxis = d3.axisLeft(yScale).ticks(8).tickFormat(d3.format('.0f'));
    svg.append('g').attr('transform', `translate(${margins.left},0)`).call(yAxis);

    // draw vertical boxes for A and B using weighted stats
    const boxWidth = Math.max(24, xBand.bandwidth() * 0.3);
    const cxA = (xBand(nameA) || 0) + xBand.bandwidth() / 2;
    const cxB = (xBand(nameB) || 0) + xBand.bandwidth() / 2;
    const colorA = 'var(--color-scienze-mfn)'; // green
    const colorB = 'var(--color-architettura-design)'; // orange

    function drawBoxFor(stats, cx, VW_arr, color, labelSuffix) {
        if (!stats) return;
        const q1y = yScale(stats.q1);
        const q3y = yScale(stats.q3);
        const medy = yScale(stats.q2);
        const lowy = yScale(stats.lower);
        const upy = yScale(stats.upper);

        // whisker line
        svg.append('line')
            .attr('x1', cx)
            .attr('x2', cx)
            .attr('y1', lowy)
            .attr('y2', upy)
            .attr('stroke', 'currentColor');

        // box
        svg.append('rect')
            .attr('x', cx - boxWidth / 2)
            .attr('y', q3y)
            .attr('width', boxWidth)
            .attr('height', Math.max(1, q1y - q3y))
            .attr('fill', color)
            .attr('opacity', 0.75);

        // median line
        svg.append('line')
            .attr('x1', cx - boxWidth / 2)
            .attr('x2', cx + boxWidth / 2)
            .attr('y1', medy)
            .attr('y2', medy)
            .attr('stroke', 'black')
            .attr('stroke-width', 1);

        // caps
        svg.append('line')
            .attr('x1', cx - boxWidth / 4)
            .attr('x2', cx + boxWidth / 4)
            .attr('y1', lowy)
            .attr('y2', lowy)
            .attr('stroke', 'currentColor');
        svg.append('line')
            .attr('x1', cx - boxWidth / 4)
            .attr('x2', cx + boxWidth / 4)
            .attr('y1', upy)
            .attr('y2', upy)
            .attr('stroke', 'currentColor');

        
    }
    svg.append("text")
        .attr("x", margins.left - 5)
        .attr("y", margins.top - 12)
        .attr("text-anchor", "middle")
        .attr("font-size", 15)
        .text("Age");

    // Violin: density across ages, weighted for A and B
    const bandwidth = Math.max((maxAge - minAge) * 0.08, 0.5);
    const kernel = epanechnikovKernel(bandwidth);
    const yVals = d3.range(Math.max(0, minAge - 2), maxAge + 2, Math.max((maxAge - minAge) / 80, 0.5));
    const kdeW = kernelDensityEstimatorWeighted(kernel, yVals);

    // compute kde and density scales for each dataset
    const kdeDataA = VW_A.length ? kdeW(VW_A) : [];
    const kdeDataB = VW_B.length ? kdeW(VW_B) : [];
    const maxDensity = d3.max([d3.max(kdeDataA, d => d[1]) || 0, d3.max(kdeDataB, d => d[1]) || 0]) || 1;
    const densityScale = d3.scaleLinear().domain([0, maxDensity]).range([0, xBand.bandwidth() / 2 - 6]);

    function drawViolinFor(kdeData, cx, color) {
        if (!kdeData || kdeData.length === 0) return;
        const right = kdeData.map(d => [cx + densityScale(d[1]), yScale(d[0])]);
        const left = kdeData.slice().reverse().map(d => [cx - densityScale(d[1]), yScale(d[0])]);
        const pts = right.concat(left);
        const area = d3.line().x(d => d[0]).y(d => d[1]).curve(d3.curveCatmullRom);
        svg.append('path').attr('d', area(pts))
            .attr('fill', color)
            .attr('opacity', 0.25);
    }

    // draw for A and B
    drawViolinFor(kdeDataA, cxA, colorA);
    drawViolinFor(kdeDataB, cxB, colorB);

    // draw boxes
    drawBoxFor(statsA, cxA, VW_A, colorA, 'A:');
    drawBoxFor(statsB, cxB, VW_B, colorB, 'B:');


    container.appendChild(svg.node());
}

export default renderBoxplotChart;