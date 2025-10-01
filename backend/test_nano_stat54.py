"""Test script to verify nano stat 54 (NCU cost) preservation."""
import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.dirname(__file__))
from app.core.optimized_importer import OptimizedImporter

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://aodbuser:password@localhost:5432/tinkertools")

def test_nano_stat54():
    """Test that nanos preserve stat 54 in stat_values."""

    # Import a small set of nanos
    importer = OptimizedImporter(db_url=DATABASE_URL, batch_size=100)

    nano_file = "database/nanos.json"
    if not os.path.exists(nano_file):
        print(f"Test file {nano_file} not found. Skipping test.")
        return

    print("Importing nanos...")
    stats = importer.import_items_from_json(nano_file, is_nano=True, clear_existing=True)
    print(f"Import stats: {stats}")

    # Verify stat 54 preservation
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)

    with SessionLocal() as db:
        # Check that nanos have stat 54 in stat_values
        result = db.execute(text("""
            SELECT
                i.id,
                i.name,
                i.ql as crystal_ql,
                sv.value as ncu_cost
            FROM items i
            JOIN item_stats ist ON i.id = ist.item_id
            JOIN stat_values sv ON ist.stat_value_id = sv.id AND sv.stat = 54
            WHERE i.is_nano = true
            LIMIT 10;
        """))

        rows = result.fetchall()

        if not rows:
            print("\n❌ FAILED: No nanos found with stat 54 in stat_values")
            return False

        print(f"\n✓ Found {len(rows)} nanos with stat 54 preserved:")
        for row in rows:
            print(f"  ID: {row.id}, Name: {row.name}, Crystal QL: {row.crystal_ql}, NCU Cost: {row.ncu_cost}")

        # Check that crystal QL and NCU cost are different (they should be for most nanos)
        different_count = sum(1 for row in rows if row.crystal_ql != row.ncu_cost)
        print(f"\n✓ {different_count}/{len(rows)} nanos have different crystal QL and NCU cost")

        return True

if __name__ == "__main__":
    success = test_nano_stat54()
    sys.exit(0 if success else 1)