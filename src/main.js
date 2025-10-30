import './style.css'

import fatalitiesByCountry from "./fatalities_by_country.csv?raw";
import fatalitiesByCountryEventType from "./fatalities_by_country_event_type.csv?raw";

import * as d3 from "d3";

function observeRender(element, renderFunction, data,  ...renderArgs) {
    // initial render (pass `data` as the second argument to the render function)
    renderFunction(element, data, ...renderArgs);

    // re-render when the container size changes
    if (typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(() => renderFunction(element, data, ...renderArgs));
        ro.observe(element);
    } else {
        // fallback to window resize if ResizeObserver is not available
        window.addEventListener("resize", () => renderFunction(element, data, ...renderArgs));
    }
}

// Parse the CSV data.
const parsedData_BarChart = d3.csvParse(fatalitiesByCountry, d3.autoType);
const parsedData_GroupedBarChart = d3.csvParse(fatalitiesByCountryEventType, d3.autoType);

// Map the parsed data to the desired format.
const data_barChart = parsedData_BarChart
    .map(d => ({ country: d.COUNTRY, fatalities: d.FATALITIES }))
    .sort((a, b) => b.fatalities - a.fatalities);

const data_groupedBarChart = parsedData_GroupedBarChart
    .map(d => ({ country: d.COUNTRY, eventType: d.EVENT_TYPE, fatalities: d.FATALITIES }))
    .filter(d => d.fatalities != null && !Number.isNaN(d.fatalities));

// create a margin class
class Margin {
    constructor(top, right, bottom, left) {
        this.top = top;
        this.right = right;
        this.bottom = bottom;
        this.left = left;
    }
}

const margins_barChart = new Margin(25, 20, 40, 120);
const margins_groupedBarChart = new Margin(25, 20, 90, 30);

// Render the bar chart inside the given container element.
// BarChart 
function renderBarChart(barchart, data, margins) {
    const rect = barchart.getBoundingClientRect();

    // fallback sizes to avoid zero dimensions
    const width = Math.max(300, Math.round(rect.width));
    const height = Math.max(200, Math.round(rect.height));

    // clear previous content
    barchart.innerHTML = "";

    // create responsive svg that fills its parent
    const svg = d3.create("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMinYMin meet")
        .attr("role", "img")
        .style("width", "100%")
        .style("height", "100%")
        .style("display", "block");

    // horizontal layout: x = value, y = category
    const x = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.fatalities) || 0])
        .nice()
        .range([margins.left, width - margins.right]);

    const y = d3.scaleBand()
        .domain(data.map(d => d.country))
        .range([margins.top, height - margins.bottom])
        .padding(0.12);

    // grid
    svg.append("g")
        .attr("stroke", "lightgray")
        .attr("stroke-opacity", 0.8)
        .selectAll("line")
        .data(x.ticks(10))
        .join("line")
        .attr("x1", d => x(d))
        .attr("x2", d => x(d))
        .attr("y1", margins.top)
        .attr("y2", height - margins.bottom);

    // tick formatter used for axis
    const formatK = d3.format(".2s"); // produces 10k, 1M, etc.

    // bars (horizontal)
    svg.append("g")
        .attr("fill", "steelblue")
        .selectAll("rect")
        .data(data)
        .join("rect")
        .attr("y", d => y(d.country))
        .attr("x", d => x(0))
        .attr("height", y.bandwidth())
        .attr("width", d => Math.max(0, x(d.fatalities) - x(0)));

    // labels on/near bars (value labels)
    svg.append("g")
        .attr("font-size", 12)
        .selectAll("text")
        .data(data)
        .join("text")
        .attr("y", d => (y(d.country) ?? 0) + y.bandwidth() / 2)
        .attr("x", d => {
            const barStart = x(0);
            const barEnd = x(d.fatalities);
            const barWidth = Math.max(0, barEnd - barStart);
            // place inside when there's enough room, otherwise outside
            return barWidth > 40 ? barEnd - 6 : barEnd + 6;
        })
        .attr("dy", "0.35em")
        .attr("text-anchor", d => {
            const barStart = x(0);
            const barEnd = x(d.fatalities);
            const barWidth = Math.max(0, barEnd - barStart);
            return barWidth > 40 ? "end" : "start";
        })
        .attr("fill", d => (x(d.fatalities) - x(0) > 40 ? "white" : "currentColor"))
        .text(d => d.fatalities);

    // x axis (values) with "k" formatting (e.g. 10k)
    svg.append("g")
        .attr("transform", `translate(0, ${height - margins.bottom})`)
        .call(d3.axisBottom(x)
            .ticks(5)
            .tickFormat(formatK)
            .tickSizeOuter(0))
        .call(g => g.select(".domain").remove());


    // x axis (values) with "k" formatting (e.g. 10k)
    svg.append("g")
        .attr("transform", `translate(0, ${height - margins.bottom})`)
        .call(d3.axisBottom(x)
            .ticks(10)
            .tickFormat(formatK)
            .tickSizeOuter(0))
        .call(g => g.select(".domain").remove());

    // y axis (categories)
    svg.append("g")
        .attr("transform", `translate(${margins.left},0)`)
        .call(d3.axisLeft(y).tickSizeOuter(0))
        .call(g => g.select(".domain").remove());

    // x axis label, centered on top of the chart
    const title = "Fatalities in Middle Eastern countries (2020-today)";
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", margins.top / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", 14)
        .attr("font-weight", "bold")
        .text(title);

    // append the svg to the container
    barchart.appendChild(svg.node());
}

// Grouped Bar Chart

function renderGroupedBarChart(groupedBarChart, data, margins) {
    const rect = groupedBarChart.getBoundingClientRect();

    // fallback sizes to avoid zero dimensions
    const width = Math.max(300, Math.round(rect.width));
    const height = Math.max(200, Math.round(rect.height));

    // clear previous content
    groupedBarChart.innerHTML = "";

    // Build list of event types and countries sorted by total fatalities (desc).
    const eventTypes = Array.from(new Set(data.map(d => d.eventType)));

    // Sum fatalities per country and sort countries by total (largest first).
    const countryTotals = d3.rollup(data, v => d3.sum(v, d => d.fatalities), d => d.country);
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
        .domain([0, d3.max(data, d => d.fatalities) || 0])
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
    const svg = d3.create("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMinYMin meet")
        .style("width", "100%")
        .style("height", "100%")
        .style("display", "block");

    // Create one group per country and translate it into place horizontally.
    const countryGroups = svg.append("g")
        .selectAll("g")
        .data(countries)
        .join("g")
        .attr("transform", d => `translate(${x0(d)},0)`);

    // For each country, draw rects only for event types present in the data.
    countryGroups.selectAll("rect")
        .data(country => data.filter(d => d.country === country))
        .join("rect")
        .attr("x", d => x1(d.eventType))
        .attr("y", d => y(d.fatalities))
        .attr("width", x1.bandwidth())
        .attr("height", d => Math.max(0, y(0) - y(d.fatalities)))
        .attr("fill", d => color(d.eventType));

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

    // Append the y axis (fatalities) on the left.
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

    // Append the SVG to the container.
    groupedBarChart.appendChild(svg.node());

}



observeRender(document.getElementById("bar-chart"), renderBarChart, data_barChart, margins_barChart);

observeRender(document.getElementById("grouped-bar-chart"), renderGroupedBarChart, data_groupedBarChart, margins_groupedBarChart);
