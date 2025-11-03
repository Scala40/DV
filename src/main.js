// Style imports
import './style.css'

// Local imports
import { observeRender } from "./utils/observeRender.js";
import {
    barChartMargins,
    groupedBarChartMargins,
    heatmapChartMargins,
    fullBarChartMargins,
    waffleChartMargins,
    circlePackingChartMargins
} from './utils/margins.js';

import { renderBarChart } from './charts/barChart.js';
import { renderGroupedBarChart } from './charts/groupedBarChart.js';
import { renderHeatmapChart } from './charts/heatmapChart.js';
import { renderFullBarChart } from './charts/fullChart.js';
import { renderWaffleChart } from './charts/waffleChart.js';
import { renderCirclePackingChart } from './charts/circlePackingChart.js';

import { initNavigation } from './utils/navigation.js';

// Data imports
import {
    barChartData,
    groupedBarChartData,
    heatmapChartData,
    waffleChartData,
    circlePackingChartData
} from './data/dataLoader.js';

// Initialize navigation menu
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
});

// Set up observed rendering for the charts
observeRender(
    document.getElementById("bar-chart"),
    renderBarChart,
    barChartData,
    barChartMargins
);

observeRender(
    document.getElementById("grouped-bar-chart"),
    renderGroupedBarChart,
    groupedBarChartData,
    groupedBarChartMargins
);

observeRender(
    document.getElementById("heatmap-chart"),
    renderHeatmapChart,
    heatmapChartData,
    heatmapChartMargins
)

observeRender(
    document.getElementById("full-bar-chart"),
    renderFullBarChart,
    groupedBarChartData,
    fullBarChartMargins
);

observeRender(
    document.getElementById("waffle-chart"),
    renderWaffleChart,
    waffleChartData,
    waffleChartMargins
);

// Additional charts
observeRender(
    document.getElementById("circle-packing-chart"),
    renderCirclePackingChart,
    circlePackingChartData,
    circlePackingChartMargins
);
