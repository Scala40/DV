import * as d3 from "d3";

import fatalitiesByCountryUrl from "../csv/fatalities_by_country.csv?url";
import eventsByYearCountryUrl from "../csv/events_by_year_country.csv?url";
import eventsByCountryEventTypeUrl from "../csv/events_by_country_event_type.csv?url";
import eventsByEventTypeUrl from "../csv/events_by_event_type.csv?url";

import DemographicDataUrl from "../csv/population_long_format.csv?url";
import DeathsDataUrl from "../csv/deaths_long_format.csv?url";
import eventsOverTimeByCountryUrl from "../csv/events_over_time_by_country.csv?url";

export async function loadBarChartData() {
    const parsed = await d3.csv(fatalitiesByCountryUrl, d3.autoType);
    return parsed
        .map(d => ({ country: d.COUNTRY, fatalities: d.FATALITIES }))
        .sort((a, b) => b.fatalities - a.fatalities);
}

export async function loadGroupedBarChartData() {
    const parsed = await d3.csv(eventsByCountryEventTypeUrl, d3.autoType);
    return parsed
        .map(d => ({ country: d.COUNTRY, eventType: d.EVENT_TYPE, events: d.EVENTS }))
        .sort((a, b) => b.events - a.events);
}

export async function loadHeatmapChartData() {
    const parsed = await d3.csv(eventsByYearCountryUrl, d3.autoType);
    return parsed
        .map(d => ({ year: d.YEAR, country: d.COUNTRY, events: d.EVENTS }))
        .sort((a, b) => a.year - b.year || a.country.localeCompare(b.country));
}

export async function loadWaffleChartData() {
    const parsed = await d3.csv(eventsByEventTypeUrl, d3.autoType);
    return parsed
        .map(d => ({ eventType: d.EVENT_TYPE, events: d.EVENTS }))
        .sort((a, b) => b.events - a.events);
}

export async function loadPyramidChartData() {
    const [population, deaths] = await Promise.all([
        d3.csv(DemographicDataUrl, d3.autoType),
        d3.csv(DeathsDataUrl, d3.autoType)
    ]);
    return { population, deaths };
}

export async function loadRidgePlotData() {
    const parsed = await d3.csv(eventsOverTimeByCountryUrl, d3.autoType);
    return parsed
        .map(d => ({ week: d.WEEK, country: d.COUNTRY, events: d.EVENTS }))
        .sort((a, b) => a.country.localeCompare(b.country));
}
