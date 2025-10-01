#!/bin/bash
# Load environment and run import
source venv/bin/activate
# Export only non-comment lines from .env.claude
export $(grep -v '^#' .env.claude | grep -v '^$' | xargs)
echo "y" | timeout 30 python import_v2.py all --clear 2>&1 | grep -E "(WARNING|ERROR|cache|Preloading)" | head -100