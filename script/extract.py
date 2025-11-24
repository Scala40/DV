#!/usr/bin/env python3

import sys
import os

import pandas as pd
from pathlib import Path

file = sys.argv[1]
df = pd.read_csv(file)

"""
WEEK,REGION,COUNTRY,ADMIN1,EVENT_TYPE,SUB_EVENT_TYPE,EVENTS,FATALITIES,POPULATION_EXPOSURE,DISORDER_TYPE,ID,CENTROID_LATITUDE,CENTROID_LONGITUDE
2016-02-06,Middle East,Bahrain,Capital,Battles,Armed clash,1,0,,Political violence,285,26.1927,50.5508
2016-06-25,Middle East,Bahrain,Capital,Explosions/Remote violence,Remote explosive/landmine/IED,1,1,,Political violence,285,26.1927,50.5508
2017-02-11,Middle East,Bahrain,Capital,Explosions/Remote violence,Remote explosive/landmine/IED,2,0,,Political violence,285,26.1927,50.5508
"""

output_dir = Path.cwd().parent / "src" / "csv"
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# # Only keep events from 2020 onwards
df_less_weeks = df.copy()
df_less_weeks["WEEK"] = pd.to_datetime(df_less_weeks["WEEK"])
cutoff_date = pd.to_datetime("2020-01-01")
df_less_weeks = df_less_weeks[df_less_weeks["WEEK"] >= cutoff_date]

print(
    f"Data from {df_less_weeks['WEEK'].min().date()} to {df_less_weeks['WEEK'].max().date()}"
)

df_less_weeks["YEAR"] = df_less_weeks["WEEK"].dt.year

# barchart
# Total casualties by country
output = output_dir / "fatalities_by_country.csv"
df_country = df_less_weeks.groupby("COUNTRY")["FATALITIES"].sum().reset_index()
df_country = df_country[df_country["FATALITIES"] > 0]
df_country.to_csv(output, index=False)

# grouped barchart and full barchart
# Total number of events by country and event type
output = output_dir / "events_by_country_event_type.csv"
df_country_event = (
    df_less_weeks.groupby(["COUNTRY", "EVENT_TYPE"])["EVENTS"].sum().reset_index()
)
df_country_event = df_country_event[df_country_event["EVENTS"] > 0]
df_country_event.to_csv(output, index=False)

# Geo chart
# Extract data for geo chart
output = output_dir / "events_by_lat_lon.csv"
df_country_lat_lon = (
    df_less_weeks.groupby(["COUNTRY", "CENTROID_LATITUDE", "CENTROID_LONGITUDE", "YEAR"])["EVENTS"]
    .sum()
    .reset_index()
)
df_country_lat_lon = df_country_lat_lon[df_country_lat_lon["EVENTS"] > 0]
df_country_lat_lon.to_csv(output, index=False)

# Heatmap chart
# Number of events by years and country
output = output_dir / "events_by_year_country.csv"

df_year_country = (
    df_less_weeks.groupby(["YEAR", "COUNTRY"])["EVENTS"].sum().reset_index()
)
df_year_country = df_year_country[df_year_country["EVENTS"] > 0]
df_year_country.to_csv(output, index=False)

# waffle chart
# Number of events by event type
output = output_dir / "events_by_event_type.csv"
df_event_type = df_less_weeks.groupby("EVENT_TYPE")["EVENTS"].sum().reset_index()
df_event_type = df_event_type[df_event_type["EVENTS"] > 0]
df_event_type.to_csv(output, index=False)

# ridge plot
# Events over time for each country
output = output_dir / "events_over_time_by_country.csv"
df_week_country = df_less_weeks[["WEEK", "COUNTRY", "EVENTS"]]
df_week_country.to_csv(output, index=False)

# line chart
# Yearly fatalities and events by country
df_year = df.copy()
output = output_dir / "yearly_fatalities_events_by_country.csv"
df_year["YEAR"] = pd.to_datetime(df_year["WEEK"]).dt.year
df_year = df_year[df_year["YEAR"] >= 2015]
df_year_country_fatalities = (
    df_year.groupby(["YEAR", "COUNTRY"])["FATALITIES"].sum().reset_index()
)
df_year_country_events = (
    df_year.groupby(["YEAR", "COUNTRY"])["EVENTS"].sum().reset_index()
)
df_merged = pd.merge(
    df_year_country_fatalities, df_year_country_events, on=["YEAR", "COUNTRY"]
)

df_sum = df_merged.groupby("COUNTRY")[["FATALITIES", "EVENTS"]].sum().reset_index()
countries_less_events = df_sum[df_sum["EVENTS"] < 10000]["COUNTRY"].unique()
df_merged = df_merged[~df_merged["COUNTRY"].isin(countries_less_events)]
df_merged.to_csv(output, index=False)

# sub_events_by_country.csv
# Small multiple geo chart
output = output_dir / "sub_events_by_country.csv"
df_sub_events = (
    df_less_weeks.groupby(["COUNTRY", "YEAR", "SUB_EVENT_TYPE"])["EVENTS"]
    .sum()
    .reset_index()
)
df_sub_events = df_sub_events[df_sub_events["EVENTS"] > 0]
df_sub_events.to_csv(output, index=False)
