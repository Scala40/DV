import * as d3 from "d3";

import fatalitiesByCountryUrl from "../csv/fatalities_by_country.csv?url";
import eventsByYearCountryUrl from "../csv/events_by_year_country.csv?url";
import eventsByCountryEventTypeUrl from "../csv/events_by_country_event_type.csv?url";
import eventsByEventTypeUrl from "../csv/events_by_event_type.csv?url";
import demographicDataUrl from "../csv/population_long_format.csv?url";
import deathsDataUrl from "../csv/deaths_long_format.csv?url";
import eventsOverTimeByCountryUrl from "../csv/events_over_time_by_country.csv?url";
import yearlyFatalitiesEventsByCountryUrl from "../csv/yearly_fatalities_events_by_country.csv?url";

const countryMap = {
    "Iran (Islamic Republic of)": "Iran",
    "State of Palestine": "Palestine",
    "Syrian Arab Republic": "Syria",
};

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
        .sort((a, b) => b.year - a.year || a.country.localeCompare(b.country));
}

export async function loadWaffleChartData() {
    const parsed = await d3.csv(eventsByEventTypeUrl, d3.autoType);
    return parsed
        .map(d => ({ eventType: d.EVENT_TYPE, events: d.EVENTS }))
        .sort((a, b) => b.events - a.events);
}

export async function loadPyramidChartData() {
    const [population, deaths] = await Promise.all([
        d3.csv(demographicDataUrl, d3.autoType),
        d3.csv(deathsDataUrl, d3.autoType)
    ]);
    return {
        population: population.map(d => ({
            Sex: d.Sex,
            Country: countryMap[d.Country] || d.Country,
            Year: d.Year,
            Age_Group_5yr: d.Age_Group_5yr,
            Population: d.Population
        })),
        deaths,
    };
}

export async function loadRidgePlotData() {
    const parsed = await d3.csv(eventsOverTimeByCountryUrl, d3.autoType);
    return parsed
        .map(d => ({ week: d.WEEK, country: d.COUNTRY, events: d.EVENTS }))
        .sort((a, b) => a.country.localeCompare(b.country));
}

export async function loadLineChartData() {
    const parsed = await d3.csv(yearlyFatalitiesEventsByCountryUrl, d3.autoType);
    return parsed
        .map(d => ({
            year: d.YEAR,
            country: d.COUNTRY,
            fatalities: d.FATALITIES,
            events: d.EVENTS
        }))
        .sort((a, b) => a.country.localeCompare(b.country));
}
