import './style.css'

import fatalitiesByCountry from "./fatalities_by_country.csv?raw";

import * as d3 from "d3";

function observeRender(element, renderFunction) {
    // initial render
    renderFunction(element);

    // re-render when the container size changes
    if (typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(() => renderFunction(element));
        ro.observe(element);
    } else {
        // fallback to window resize if ResizeObserver is not available
        window.addEventListener("resize", () => renderFunction());
    }
}

// Parse the CSV data.
const parsedData = d3.csvParse(fatalitiesByCountry, d3.autoType);

// Map the parsed data to the desired format.
const data = parsedData
    .map(d => ({ country: d.COUNTRY, fatailities: d.FATALITIES }))
    .sort((a, b) => b.fatailities - a.fatailities);

// Declare the chart margins (width/height will be measured from container).
const marginTop = 20;
const marginRight = 20;
const marginBottom = 40;
const marginLeft = 120;

// Render the bar chart inside the given container element.
function renderBarChart(barchart) {
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
        .domain([0, d3.max(data, d => d.fatailities) || 0])
        .nice()
        .range([marginLeft, width - marginRight]);

    const y = d3.scaleBand()
        .domain(data.map(d => d.country))
        .range([marginTop, height - marginBottom])
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
        .attr("y1", marginTop)
        .attr("y2", height - marginBottom);

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
        .attr("width", d => Math.max(0, x(d.fatailities) - x(0)));

    // labels on/near bars (value labels)
    svg.append("g")
        .attr("font-size", 12)
        .selectAll("text")
        .data(data)
        .join("text")
        .attr("y", d => (y(d.country) ?? 0) + y.bandwidth() / 2)
        .attr("x", d => {
            const barStart = x(0);
            const barEnd = x(d.fatailities);
            const barWidth = Math.max(0, barEnd - barStart);
            // place inside when there's enough room, otherwise outside
            return barWidth > 40 ? barEnd - 6 : barEnd + 6;
        })
        .attr("dy", "0.35em")
        .attr("text-anchor", d => {
            const barStart = x(0);
            const barEnd = x(d.fatailities);
            const barWidth = Math.max(0, barEnd - barStart);
            return barWidth > 40 ? "end" : "start";
        })
        .attr("fill", d => (x(d.fatailities) - x(0) > 40 ? "white" : "currentColor"))
        .text(d => d.fatailities);

    // x axis (values) with "k" formatting (e.g. 10k)
    svg.append("g")
        .attr("transform", `translate(0, ${height - marginBottom})`)
        .call(d3.axisBottom(x)
            .ticks(5)
            .tickFormat(formatK)
            .tickSizeOuter(0))
        .call(g => g.select(".domain").remove());


    // x axis (values) with "k" formatting (e.g. 10k)
    svg.append("g")
        .attr("transform", `translate(0, ${height - marginBottom})`)
        .call(d3.axisBottom(x)
            .ticks(10)
            .tickFormat(formatK)
            .tickSizeOuter(0))
        .call(g => g.select(".domain").remove());

    // y axis (categories)
    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(d3.axisLeft(y).tickSizeOuter(0))
        .call(g => g.select(".domain").remove());

    // x axis label, centered on top of the chart
    const title = "Fatalities in Middle Eastern countries (2020-today)";
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", marginTop / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", 14)
        .attr("font-weight", "bold")
        .text(title);

    // append the svg to the container
    barchart.appendChild(svg.node());
}

observeRender(document.getElementById("bar-chart"), renderBarChart);
