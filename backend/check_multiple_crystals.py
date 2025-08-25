#!/usr/bin/env python3
import asyncio
import asyncpg

async def check_multiple_crystals():
    conn = await asyncpg.connect("postgresql://aodbuser:password@localhost:5432/tinkertools")
    
    # Check how many nano programs have multiple crystals
    query = """
    SELECT 
        (s.spell_params::json->>'NanoID')::int as nano_aoid,
        COUNT(DISTINCT crystal.aoid) as crystal_count,
        array_agg(DISTINCT crystal.aoid ORDER BY crystal.aoid) as crystal_aoids,
        array_agg(DISTINCT crystal.name ORDER BY crystal.name) as crystal_names
    FROM items crystal
    JOIN item_spell_data isd ON crystal.id = isd.item_id
    JOIN spell_data sd ON isd.spell_data_id = sd.id
    JOIN spell_data_spells sds ON sd.id = sds.spell_data_id
    JOIN spells s ON sds.spell_id = s.id
    WHERE s.spell_id = 53019 
      AND s.spell_params::json->>'NanoID' IS NOT NULL
    GROUP BY nano_aoid
    HAVING COUNT(DISTINCT crystal.aoid) > 1
    ORDER BY crystal_count DESC
    LIMIT 20;
    """
    
    rows = await conn.fetch(query)
    
    print(f"Found {len(rows)} nano programs with multiple crystals\n")
    
    for row in rows[:10]:
        print(f"Nano AOID {row['nano_aoid']}: {row['crystal_count']} crystals")
        for i, (aoid, name) in enumerate(zip(row['crystal_aoids'], row['crystal_names'])):
            if i < 3:  # Show first 3 crystals
                print(f"  - {aoid}: {name}")
        if row['crystal_count'] > 3:
            print(f"  ... and {row['crystal_count'] - 3} more")
        print()
    
    # Total count
    total_query = """
    SELECT COUNT(DISTINCT (s.spell_params::json->>'NanoID')::int) as total_nanos,
           COUNT(DISTINCT crystal.aoid) as total_crystals,
           COUNT(*) as total_mappings
    FROM items crystal
    JOIN item_spell_data isd ON crystal.id = isd.item_id
    JOIN spell_data sd ON isd.spell_data_id = sd.id
    JOIN spell_data_spells sds ON sd.id = sds.spell_data_id
    JOIN spells s ON sds.spell_id = s.id
    WHERE s.spell_id = 53019 
      AND s.spell_params::json->>'NanoID' IS NOT NULL;
    """
    
    result = await conn.fetchrow(total_query)
    print(f"Total statistics:")
    print(f"  Unique nano programs: {result['total_nanos']}")
    print(f"  Unique crystals: {result['total_crystals']}")
    print(f"  Total crystal->nano mappings: {result['total_mappings']}")
    
    await conn.close()

if __name__ == "__main__":
    asyncio.run(check_multiple_crystals())