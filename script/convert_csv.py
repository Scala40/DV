import csv as _pycsv
import pandas as pd
from pathlib import Path


def main():
    # Determine file paths relative to this script so the script works when run from any cwd
    base = Path(__file__).resolve().parent
    input_file = base / "MiddleEastDeath.csv"

    # Read the CSV file. Auto-detect the delimiter (some files use comma, others semicolon).
    # Use the stdlib csv.Sniffer on a sample and fall back to comma if sniffing fails.
    detected_sep = ","
    try:
        with open(input_file, "r", encoding="utf-8") as fh:
            sample = fh.read(4096)
            try:
                dialect = _pycsv.Sniffer().sniff(sample)
                detected_sep = dialect.delimiter
            except Exception:
                # couldn't sniff reliably, fall back to comma
                detected_sep = ","
    except Exception:
        # if file can't be opened for sniffing, fall back to comma and let pandas raise if needed
        detected_sep = ","

    df = pd.read_csv(
        input_file,
        sep=detected_sep,
        skipinitialspace=True,
        dtype=str,  # read as strings first to normalize whitespace, we'll convert numerics later
        engine="python",
    )

    # Normalize column names: strip whitespace and surrounding quotes
    df.columns = [c.strip().strip('"') for c in df.columns]

    # If the dataset uses a verbose region/country header, map it to the standard name 'Country'
    rename_map = {}
    for c in df.columns:
        low = c.lower()
        if "region" in low or "country" in low or "area" in low:
            rename_map[c] = "Country"
            break
    if rename_map:
        df = df.rename(columns=rename_map)

    # Standard metadata columns in this dataset
    metadata_cols = ["Sex", "Country", "Year"]

    # Ensure required metadata columns exist
    for col in metadata_cols:
        if col not in df.columns:
            raise KeyError(f"Expected metadata column '{col}' not found in CSV. Found columns: {list(df.columns)[:10]} ...")

    # Identify age columns (everything that's not metadata)
    age_cols = [col for col in df.columns if col not in metadata_cols]

    # Clean up age column names (strip whitespace)
    age_cols = [c.strip() for c in age_cols]

    # Build 5-year age groups programmatically (0-4, 5-9, ..., 95-99) plus 100+
    age_groups = {}
    for start in range(0, 100, 5):
        group_name = f"{start}-{start+4}"
        group_cols = [str(i) for i in range(start, start + 5)]
        # only keep columns that exist in the dataframe
        existing = [c for c in group_cols if c in df.columns]
        if existing:
            age_groups[group_name] = existing

    # last open-ended group
    if "100+" in df.columns:
        age_groups["100+"] = ["100+"]

    # Create new dataframe with metadata columns
    result_df = df[metadata_cols].copy()

    # Convert age columns to numeric and sum into groups
    for group_name, cols in age_groups.items():
        # convert each referenced column to numeric (coerce errors to NaN)
        numeric = df[cols].apply(pd.to_numeric, errors="coerce")
        # sum across the numeric columns (NaN treated as 0 in sum by default if skipna=True)
        result_df[group_name] = numeric.sum(axis=1)

    print("Step 1: Age groups merged successfully!")
    print(f"Grouped data shape: {result_df.shape}")

    # Now convert to long format
    age_group_cols = list(age_groups.keys())

    df_long = pd.melt(
        result_df,
        id_vars=metadata_cols,
        value_vars=age_group_cols,
        var_name="Age_Group_5yr",
        value_name="Population",
    )

    # Reorder columns and drop missing populations
    df_long = df_long[["Sex", "Country", "Year", "Age_Group_5yr", "Population"]]
    df_long["Population"] = pd.to_numeric(df_long["Population"], errors="coerce")
    df_long = df_long.dropna(subset=["Population"])

    # Save to new CSV
    out_file = base / "deaths_long_format.csv"
    df_long.to_csv(out_file, index=False)

    print("\nStep 2: Converted to long format!")
    print(f"Final data shape: {df_long.shape}")
    print(f"\nConverted {len(result_df)} rows to {len(df_long)} rows.")
    print("\nFirst few rows:")
    print(df_long.head(10))


if __name__ == "__main__":
    main()
