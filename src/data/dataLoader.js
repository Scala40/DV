import * as d3 from "d3";

import fatalitiesByCountry from "../csv/fatalities_by_country.csv?raw";
import eventsByYearCountry from "../csv/events_by_year_country.csv?raw";
import eventsByCountryEventType from "../csv/events_by_country_event_type.csv?raw";
import eventsByEventType from "../csv/events_by_event_type.csv?raw";

import DemographicData from "../csv/population_long_format.csv?raw";
import DeathsData from "../csv/deaths_long_format.csv?raw";
import eventsOverTimeByCountry from "../csv/events_over_time_by_country.csv?raw";

// Parse the CSV data
const parsedData_BarChart = d3.csvParse(fatalitiesByCountry, d3.autoType);
const parsedData_GroupedBarChart = d3.csvParse(eventsByCountryEventType, d3.autoType);
const parsedData_HeatmapChart = d3.csvParse(eventsByYearCountry, d3.autoType);
const parsedData_WaffleChart = d3.csvParse(eventsByEventType, d3.autoType);
const parsedData_CirclePackingChart = d3.csvParse(fatalitiesByCountry, d3.autoType);

const parsedData_PopulationPyramidChart = d3.csvParse(DemographicData, d3.autoType);
const parsedData_DeathsPyramidChart = d3.csvParse(DeathsData, d3.autoType);

// Map and transform data for bar chart
export const barChartData = parsedData_BarChart
    .map(d => ({ country: d.COUNTRY, fatalities: d.FATALITIES }))
    .sort((a, b) => b.fatalities - a.fatalities);

// Map and transform data for grouped bar chart
export const groupedBarChartData = parsedData_GroupedBarChart
    .map(d => ({ country: d.COUNTRY, eventType: d.EVENT_TYPE, events: d.EVENTS }))
    .sort((a, b) => b.events - a.events);

// Map and transform data for heatmap chart
export const heatmapChartData = parsedData_HeatmapChart
    .map(d => ({ year: d.YEAR, country: d.COUNTRY, events: d.EVENTS }))
    .sort((a, b) => a.year - b.year || a.country.localeCompare(b.country));

// Map and transform data for waffle chart
export const waffleChartData = parsedData_WaffleChart
    .map(d => ({ eventType: d.EVENT_TYPE, events: d.EVENTS }))
    .sort((a, b) => b.events - a.events);

// Map and transform data for circle packing chart
export const circlePackingChartData = parsedData_CirclePackingChart
    .map(d => ({ country: d.COUNTRY, fatalities: d.FATALITIES }))
    .sort((a, b) => b.fatalities - a.fatalities);

// Map and transform data for pyramid chart
export const pyramidChartData = {
    population: parsedData_PopulationPyramidChart,
    deaths: parsedData_DeathsPyramidChart
};


// Map and transform data for ridge plot chart
export const ridgePlotData = d3.csvParse(eventsOverTimeByCountry, d3.autoType)
    .map(d => ({ week: d.WEEK, country: d.COUNTRY, events: d.EVENTS }))
    .sort((a, b) => a.country.localeCompare(b.country));

// Map and transform data for box plot chart
export const boxPlotData = {
    population: parsedData_PopulationPyramidChart,
    deaths: parsedData_DeathsPyramidChart
};