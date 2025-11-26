#!/usr/bin/env python3

import sys
import json
from typing import Any, Dict, List


def usage():
    print(
        "Usage: extract_middle_east.py INPUT.geojson OUTPUT.geojson COUNTRY [COUNTRY ...]"
    )
    sys.exit(1)


if len(sys.argv) < 4:
    usage()

input_path = sys.argv[1]
output_file = sys.argv[2]
countries = sys.argv[3:]
countries_lc = [c.lower() for c in countries]

with open(input_path, "r", encoding="utf-8") as fh:
    geojson = json.load(fh)


def feature_matches(feature: Dict[str, Any], targets: List[str]) -> bool:
    props = feature.get("properties", {})
    # candidate property keys that may contain the country name or code
    keys = [
        "NAME",
        "Name",
        "name",
        "admin",
        "sovereignt",
        "sovereignty",
        "name_en",
        "name_long",
        "postal",
        "iso_a2",
        "iso_a3",
        "adm0_a3",
        "gu_a3",
        "brk_a3",
    ]
    for k in keys:
        v = props.get(k)
        if v is None:
            continue
        v_s = str(v).lower()
        for t in targets:
            if v_s == t:
                return True
    return False


features = [f for f in geojson.get("features", []) if feature_matches(f, countries_lc)]
geojson["features"] = features

with open(output_file, "w", encoding="utf-8") as f:
    json.dump(geojson, f, ensure_ascii=False, indent=2)

print(f"Extracted {len(features)} features to {output_file}")
