#!/usr/bin/env python3

import sys
import os

import pandas as pd

file = sys.argv[1]
df = pd.read_excel(file)

output = os.path.splitext(file)[0] + ".csv"

df.to_csv(output, index=False)
