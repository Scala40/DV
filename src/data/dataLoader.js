import * as d3 from "d3";

import fatalitiesByCountry from "../csv/fatalities_by_country.csv?raw";
import fatalitiesByCountryEventType from "../csv/fatalities_by_country_event_type.csv?raw";
import eventsByLatLon from "../csv/events_by_lat_lon.csv?raw";
import eventsByYearCountry from "../csv/events_by_year_country.csv?raw";
import eventsByCountryEventType from "../csv/events_by_country_event_type.csv?raw";
import eventsByEventType from "../csv/events_by_event_type.csv?raw";

// Parse the CSV data
const parsedData_BarChart = d3.csvParse(fatalitiesByCountry, d3.autoType);
const parsedData_GroupedBarChart = d3.csvParse(eventsByCountryEventType, d3.autoType);
const parsedData_HeatmapChart = d3.csvParse(eventsByYearCountry, d3.autoType);
const parsedData_WaffleChart = d3.csvParse(eventsByEventType, d3.autoType);

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
