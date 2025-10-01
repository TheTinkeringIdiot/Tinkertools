#!/bin/bash
# Test full import with detailed logging
source venv/bin/activate
export $(grep -v '^#' .env.claude | grep -v '^$' | xargs)
echo "y" | timeout 30 python import_v2.py all --clear --verbose 2>&1 | grep -E "(Attempting|First 10|Actually|inserted|Preloaded)" | head -30