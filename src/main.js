// Style imports
import './style.css'

// Local imports
import {
    barChartMargins,
    groupedBarChartMargins,
} from './utils/margins.js';

import { renderBarChart } from './charts/barChart.js';
import { renderGroupedBarChart } from './charts/groupedBarChart.js';

// Data imports
import { barChartData, groupedBarChartData } from './data/dataLoader.js';

renderBarChart(
    document.getElementById("bar-chart"),
    barChartData,
    barChartMargins
);

renderGroupedBarChart(
    document.getElementById("grouped-bar-chart"),
    groupedBarChartData,
    groupedBarChartMargins
);
