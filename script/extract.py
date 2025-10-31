#!/usr/bin/env python3

import sys

import pandas as pd

file = sys.argv[1]
df = pd.read_csv(file)

"""
WEEK,REGION,COUNTRY,ADMIN1,EVENT_TYPE,SUB_EVENT_TYPE,EVENTS,FATALITIES,POPULATION_EXPOSURE,DISORDER_TYPE,ID,CENTROID_LATITUDE,CENTROID_LONGITUDE
2016-02-06,Middle East,Bahrain,Capital,Battles,Armed clash,1,0,,Political violence,285,26.1927,50.5508
2016-06-25,Middle East,Bahrain,Capital,Explosions/Remote violence,Remote explosive/landmine/IED,1,1,,Political violence,285,26.1927,50.5508
2017-02-11,Middle East,Bahrain,Capital,Explosions/Remote violence,Remote explosive/landmine/IED,2,0,,Political violence,285,26.1927,50.5508
"""

# Only keep events from 2020 onwards
df["WEEK"] = pd.to_datetime(df["WEEK"])
cutoff_date = pd.to_datetime("2020-01-01")
df = df[df["WEEK"] >= cutoff_date]

print(f"Data from {df['WEEK'].min().date()} to {df['WEEK'].max().date()}")

# barchart
# Total casualties by country
output = "fatalities_by_country.csv"
df_country = df.groupby("COUNTRY")["FATALITIES"].sum().reset_index()
df_country = df_country[df_country["FATALITIES"] > 0]
df_country.to_csv(output, index=False)

# grouped barchart and full barchart
# Total number of events by country and event type
output = "fatalities_by_country_event_type.csv"
df_country_event = df.groupby(["COUNTRY", "EVENT_TYPE"])["EVENTS"].sum().reset_index()
df_country_event = df_country_event[df_country_event["EVENTS"] > 0]
df_country_event.to_csv(output, index=False)
