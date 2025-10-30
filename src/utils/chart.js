import * as d3 from "d3";

export function createResponsiveSvg(width, height) {
    return d3.create("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMinYMin meet")
        .attr("role", "img")
        .style("width", "100%")
        .style("height", "100%")
        .style("display", "block");
}

export function getContainerDimensions(container, minWidth = 300, minHeight = 200) {
    const rect = container.getBoundingClientRect();
    return {
        width: Math.max(minWidth, Math.round(rect.width)),
        height: Math.max(minHeight, Math.round(rect.height))
    };
}
