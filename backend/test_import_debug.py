#!/usr/bin/env python3
"""Test import with debug logging."""

import os
import sys
import json
import logging
from dotenv import load_dotenv

# Add app to path
sys.path.insert(0, '/home/quigley/projects/Tinkertools/backend')

from app.import_v2.stages import TwoPassImporter
from app.import_v2.streaming import StreamingJSONReader

# Set up detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Load environment
load_dotenv('.env.claude')
DATABASE_URL = os.getenv('DATABASE_URL')

# Create a small test file with the problematic stat values (using original AO format)
test_data = [
    {
        "AOID": 1001,
        "Name": "Test Item 1",
        "QL": 100,
        "Icon": 123456,
        "Type": "Weapon",
        "Slot": "HUD1",
        "StatValues": [
            {"Stat": 23, "RawValue": 11099},  # Problematic stat
            {"Stat": 76, "RawValue": 2},       # Problematic stat
            {"Stat": 6, "RawValue": 15}        # Problematic stat
        ],
        "Sources": []
    }
]

# Write test data
with open('test_import.json', 'w') as f:
    json.dump(test_data, f)

print("Running import with test data...")

# Create importer
importer = TwoPassImporter(DATABASE_URL)

# Run import
def stream_factory():
    reader = StreamingJSONReader('test_import.json', chunk_size=1)
    return reader.stream()

try:
    stats = importer.import_data_with_factory(stream_factory)
    print(f"Import completed: {stats}")
except Exception as e:
    print(f"Import failed: {e}")
    import traceback
    traceback.print_exc()

# Clean up
os.remove('test_import.json')