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
    circlePackingChartMargins,
    pyramidChartMargins,
    ridgePlotMargins,
    boxplotChartMargins,
    lineChartMargins
} from './utils/margins.js';

import { renderBarChart } from './charts/barChart.js';
import { renderGroupedBarChart } from './charts/groupedBarChart.js';
import { renderHeatmapChart } from './charts/heatmapChart.js';
import { renderFullBarChart } from './charts/fullChart.js';
import { renderWaffleChart } from './charts/waffleChart.js';
import { renderCirclePackingChart } from './charts/circlePackingChart.js';
import { renderPyramidChart } from './charts/pyramidChart.js';
import { renderBoxplotChart } from './charts/boxplotChart.js';
import { renderRidgePlotChart } from './charts/ridgePlotChart.js';
import { renderLineChart } from './charts/lineChart.js';

import { initNavigation } from './utils/navigation.js';
import { initBackToTop } from './utils/backToTop.js';

import {
    loadBarChartData,
    loadGroupedBarChartData,
    loadHeatmapChartData,
    loadWaffleChartData,
    loadPyramidChartData,
    loadRidgePlotData,
    loadLineChartData
} from './data/dataLoader.js';

// Initialize navigation menu
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initBackToTop();

    // Bar chart and circle packing share the same source
    loadBarChartData()
        .then(data => {
            observeRender(
                document.getElementById('bar-chart'),
                renderBarChart,
                data,
                barChartMargins
            );
            observeRender(
                document.getElementById('circle-packing-chart'),
                renderCirclePackingChart,
                data,
                circlePackingChartMargins
            );
        })
        .catch(err => console.error('Bar chart data failed:', err));

    // Grouped bar chart and full bar chart share the same source
    loadGroupedBarChartData()
        .then(data => {
            observeRender(
                document.getElementById('grouped-bar-chart'),
                renderGroupedBarChart,
                data,
                groupedBarChartMargins
            );
            observeRender(
                document.getElementById('full-bar-chart'),
                renderFullBarChart,
                data,
                fullBarChartMargins
            );
        })
        .catch(err => console.error('Grouped bar chart data failed:', err));

    loadHeatmapChartData()
        .then(data => observeRender(
            document.getElementById('heatmap-chart'),
            renderHeatmapChart,
            data,
            heatmapChartMargins
        ))
        .catch(err => console.error('Heatmap chart data failed:', err));

    loadWaffleChartData()
        .then(data => observeRender(
            document.getElementById('waffle-chart'),
            renderWaffleChart,
            data,
            waffleChartMargins
        ))
        .catch(err => console.error('Waffle chart data failed:', err));

    // Pyramid and boxplot share the same source
    loadPyramidChartData()
        .then(data => {
            observeRender(
                document.getElementById('pyramid-chart'),
                renderPyramidChart,
                data,
                pyramidChartMargins
            );
            observeRender(
                document.getElementById('boxplot-chart'),
                renderBoxplotChart,
                data,
                boxplotChartMargins
            );
        })
        .catch(err => console.error('Pyramid/Boxplot data failed:', err));

    loadRidgePlotData()
        .then(data => observeRender(
            document.getElementById('ridgeline-plot'),
            renderRidgePlotChart,
            data,
            ridgePlotMargins
        ))
        .catch(err => console.error('Ridgeline data failed:', err));

    loadLineChartData()
        .then(data => observeRender(
            document.getElementById('line-chart'),
            renderLineChart,
            data,
            lineChartMargins
        ))
        .catch(err => console.error('Line chart data failed:', err));
});
