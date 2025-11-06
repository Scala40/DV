import pandas as pd

# Read the CSV file
df = pd.read_csv("MiddleEastPopulation.csv")

# Define the non-age columns to keep
metadata_cols = [
    "Sex",
    "Region, subregion, country or area *",
    "Notes",
    "Location code",
    "ISO3 Alpha-code",
    "ISO2 Alpha-code",
    "SDMX code**",
    "Type",
    "Parent code",
    "Year",
]

# Create age group ranges
age_groups = {
    "0-4": [f"{i}.0" for i in range(0, 5)],
    "5-9": [f"{i}.0" for i in range(5, 10)],
    "10-14": [f"{i}.0" for i in range(10, 15)],
    "15-19": [f"{i}.0" for i in range(15, 20)],
    "20-24": [f"{i}.0" for i in range(20, 25)],
    "25-29": [f"{i}.0" for i in range(25, 30)],
    "30-34": [f"{i}.0" for i in range(30, 35)],
    "35-39": [f"{i}.0" for i in range(35, 40)],
    "40-44": [f"{i}.0" for i in range(40, 45)],
    "45-49": [f"{i}.0" for i in range(45, 50)],
    "50-54": [f"{i}.0" for i in range(50, 55)],
    "55-59": [f"{i}.0" for i in range(55, 60)],
    "60-64": [f"{i}.0" for i in range(60, 65)],
    "65-69": [f"{i}.0" for i in range(65, 70)],
    "70-74": [f"{i}.0" for i in range(70, 75)],
    "75-79": [f"{i}.0" for i in range(75, 80)],
    "80-84": [f"{i}.0" for i in range(80, 85)],
    "85-89": [f"{i}.0" for i in range(85, 90)],
    "90-94": [f"{i}.0" for i in range(90, 95)],
    "95-99": [f"{i}.0" for i in range(95, 100)],
    "100+": ["100+"],
}

# Create new dataframe with metadata columns
result_df = df[metadata_cols].copy()

# Sum ages for each group
for group_name, age_cols in age_groups.items():
    # Filter to only existing columns
    existing_cols = [col for col in age_cols if col in df.columns]
    result_df[group_name] = df[existing_cols].sum(axis=1)

print("Step 1: Age groups merged successfully!")
print(f"Grouped data shape: {result_df.shape}")

print(result_df.head(10))

# Now convert to long format
age_group_cols = list(age_groups.keys())

df_long = pd.melt(
    result_df,
    id_vars=["Sex", "Region, subregion, country or area *", "Year"],
    value_vars=age_group_cols,
    var_name="Age_Group_5yr",
    value_name="Population",
)

# Rename columns for cleaner output
df_long = df_long.rename(columns={"Region, subregion, country or area *": "Country"})

# Reorder columns
df_long = df_long[["Sex", "Country", "Year", "Age_Group_5yr", "Population"]]

# Remove rows with missing values if needed
df_long = df_long.dropna(subset=["Population"])

# Save to new CSV
df_long.to_csv("population_long_format.csv", index=False)

print("\nStep 2: Converted to long format!")
print(f"Final data shape: {df_long.shape}")
print(f"\nConverted {len(result_df)} rows to {len(df_long)} rows.")
print("\nFirst few rows:")
print(df_long.head(10))
