// Style imports
import './style.css'

// Local imports
import { observeRender } from "./utils/observeRender.js";

import {
    barChartMargins,
    groupedBarChartMargins,
} from './utils/margins.js';
import { renderBarChart } from './charts/barChart.js';
import { renderGroupedBarChart } from './charts/groupedBarChart.js';

// Data imports
import { barChartData, groupedBarChartData } from './data/dataLoader.js';

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
