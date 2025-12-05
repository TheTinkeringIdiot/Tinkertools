#!/usr/bin/env python3
"""
Example usage of StreamingCSVLoader.

This script demonstrates how to use the CSV loader to import data
from CSV files into PostgreSQL.

Requirements:
1. CSV files must be in the specified directory
2. CSV files must have headers matching column names
3. CSV files must be named: {table_name}.csv

Example CSV file (stat_values.csv):
    id,stat,value
    1,54,1
    2,54,2
    3,76,100

Usage:
    python csv_loader_example.py /path/to/csv/dir
"""

import sys
import os
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).parent.parent.parent))

from app.core.csv_loader import StreamingCSVLoader, load_csv_to_database
from app.core.database import SessionLocal


def example_basic_usage(csv_dir: str):
    """Basic usage example."""
    print("=== Basic Usage ===")
    print(f"Loading CSV files from: {csv_dir}\n")

    # Create database session
    db = SessionLocal()

    try:
        # Load all CSV files
        stats = load_csv_to_database(db, csv_dir)

        # Print results
        print("\n=== Load Results ===")
        print(f"Tables loaded: {stats['tables_loaded']}")
        print(f"Total rows: {stats['total_rows']}")
        print(f"Load time: {stats['total_time']:.1f}s")
        print(f"Rows/sec: {stats['rows_per_second']:.0f}")

        if stats['errors']:
            print(f"\nErrors ({len(stats['errors'])}):")
            for error in stats['errors']:
                print(f"  - {error}")

        # Commit transaction
        db.commit()
        print("\n✅ Transaction committed successfully")

    except Exception as e:
        print(f"\n❌ Load failed: {e}")
        db.rollback()
        raise

    finally:
        db.close()


def example_advanced_usage(csv_dir: str):
    """Advanced usage with custom configuration."""
    print("=== Advanced Usage ===")
    print(f"Loading CSV files from: {csv_dir}\n")

    # Create database session
    db = SessionLocal()

    try:
        # Create loader instance
        loader = StreamingCSVLoader(db, csv_dir)

        # Access load order
        print("Load order:")
        for i, (table, cols, has_seq) in enumerate(loader.LOAD_ORDER, 1):
            print(f"  {i}. {table} ({len(cols)} columns, seq={has_seq})")

        # Perform load
        print("\nStarting load...")
        stats = loader.load_all()

        # Print detailed results
        print("\n=== Detailed Results ===")
        print(f"Tables loaded: {stats['tables_loaded']}")
        print(f"Total rows: {stats['total_rows']}")
        print(f"Load time: {stats['total_time']:.1f}s")
        print(f"Rows/sec: {stats['rows_per_second']:.0f}")

        # Commit transaction
        db.commit()
        print("\n✅ Load successful")

    except Exception as e:
        print(f"\n❌ Load failed: {e}")
        db.rollback()
        raise

    finally:
        db.close()


def list_csv_files(csv_dir: str):
    """List CSV files in directory."""
    csv_path = Path(csv_dir)

    if not csv_path.exists():
        print(f"❌ Directory not found: {csv_dir}")
        return

    csv_files = sorted(csv_path.glob("*.csv"))

    if not csv_files:
        print(f"❌ No CSV files found in: {csv_dir}")
        return

    print(f"Found {len(csv_files)} CSV files:")
    for csv_file in csv_files:
        size_kb = csv_file.stat().st_size / 1024
        print(f"  - {csv_file.name} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    csv_directory = sys.argv[1]

    # List CSV files first
    print("=== CSV Files ===")
    list_csv_files(csv_directory)
    print()

    # Run basic usage example
    try:
        example_basic_usage(csv_directory)
    except Exception as e:
        print(f"Example failed: {e}")
        sys.exit(1)
