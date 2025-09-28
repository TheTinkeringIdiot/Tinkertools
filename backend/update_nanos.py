#!/usr/bin/env python3
"""
Nano Data Updater

Updates the database with nano program information:
1. Migrates crystal-nano relationships from CSV to source system
2. Creates crystal items as sources with type 'item'
3. Links nanoprograms to their crystal sources
4. Updates nano stat values (QL, NanoStrain, NanoSubStrain)

Designed to be idempotent and extensible for future updates.
"""

import os
import csv
import json
import asyncio
import asyncpg
from dotenv import load_dotenv
from typing import Dict, List, Set, Tuple

# Load environment variables
load_dotenv()


class NanoDataUpdater:
    def __init__(self):
        self.database_url = os.getenv('DATABASE_URL')
        if not self.database_url:
            raise ValueError("DATABASE_URL environment variable not set")
        
        self.csv_path = "/home/quigley/projects/Tinkertools/backend/all_nanos_compacted.csv"
        self.conn = None
        self.stats = {
            'nanos_processed': 0,
            'crystals_created': 0,
            'relationships_created': 0,
            'existing_crystals': 0,
            'existing_relationships': 0,
            'ql_updates': 0,
            'stat_updates': 0,
            'strain_updates': 0,
            'substrain_updates': 0
        }
    
    async def connect(self):
        """Establish database connection"""
        print(f"Connecting to database...")
        self.conn = await asyncpg.connect(self.database_url)
        print("✓ Database connection established")
    
    async def disconnect(self):
        """Close database connection"""
        if self.conn:
            await self.conn.close()
            print("✓ Database connection closed")
    
    async def get_item_source_type_id(self) -> int:
        """Get the ID for 'item' source type"""
        result = await self.conn.fetchrow(
            "SELECT id FROM source_types WHERE name = 'item'"
        )
        if not result:
            raise ValueError("'item' source type not found - run migration first")
        return result['id']
    
    async def get_existing_sources(self, source_type_id: int) -> Dict[int, int]:
        """Get existing crystal sources (crystal_aoid -> source_id mapping)"""
        rows = await self.conn.fetch("""
            SELECT source_id as crystal_aoid, id as source_id
            FROM sources 
            WHERE source_type_id = $1
        """, source_type_id)
        
        return {row['crystal_aoid']: row['source_id'] for row in rows}
    
    async def get_existing_item_sources(self) -> Set[Tuple[int, int]]:
        """Get existing item-source relationships"""
        rows = await self.conn.fetch("""
            SELECT item_id, source_id
            FROM item_sources
        """)
        
        return {(row['item_id'], row['source_id']) for row in rows}
    
    async def get_item_info(self, aoid: int) -> Dict:
        """Get item information by AOID"""
        result = await self.conn.fetchrow("""
            SELECT id, name, ql, is_nano
            FROM items 
            WHERE aoid = $1
        """, aoid)
        
        return dict(result) if result else None
    
    async def create_crystal_source(self, crystal_aoid: int, crystal_name: str, source_type_id: int) -> int:
        """Create a source entry for a crystal"""
        source_id = await self.conn.fetchval("""
            INSERT INTO sources (source_type_id, source_id, name, metadata)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (source_type_id, source_id) DO UPDATE SET
                name = EXCLUDED.name,
                metadata = EXCLUDED.metadata
            RETURNING id
        """, source_type_id, crystal_aoid, crystal_name, json.dumps({"type": "nanocrystal"}))
        
        return source_id
    
    async def create_item_source_relationship(self, nano_item_id: int, source_id: int, 
                                            nano_ql: int, metadata: Dict = None):
        """Create item-source relationship"""
        if metadata is None:
            metadata = {}
        
        await self.conn.execute("""
            INSERT INTO item_sources (item_id, source_id, min_ql, max_ql, metadata)
            VALUES ($1, $2, $3, $3, $4)
            ON CONFLICT (item_id, source_id) DO UPDATE SET
                min_ql = LEAST(item_sources.min_ql, EXCLUDED.min_ql),
                max_ql = GREATEST(item_sources.max_ql, EXCLUDED.max_ql),
                metadata = EXCLUDED.metadata
        """, nano_item_id, source_id, nano_ql, json.dumps(metadata))
    
    async def get_or_create_stat_value(self, stat: int, value: int) -> int:
        """Get existing stat_value or create new one"""
        result = await self.conn.fetchrow("""
            INSERT INTO stat_values (stat, value) 
            VALUES ($1, $2)
            ON CONFLICT (stat, value) DO UPDATE SET stat = EXCLUDED.stat
            RETURNING id
        """, stat, value)
        return result['id']
    
    async def get_item_stats(self, item_id: int) -> Dict[int, int]:
        """Get current stats for an item (stat -> value mapping)"""
        rows = await self.conn.fetch("""
            SELECT sv.stat, sv.value
            FROM item_stats ist
            JOIN stat_values sv ON ist.stat_value_id = sv.id
            WHERE ist.item_id = $1
        """, item_id)
        
        return {row['stat']: row['value'] for row in rows}
    
    async def update_item_stat(self, item_id: int, stat: int, new_value: int):
        """Update or insert an item stat"""
        # Get or create the stat_value
        stat_value_id = await self.get_or_create_stat_value(stat, new_value)
        
        # Remove any existing stat of this type for this item
        await self.conn.execute("""
            DELETE FROM item_stats 
            WHERE item_id = $1 AND stat_value_id IN (
                SELECT id FROM stat_values WHERE stat = $2
            )
        """, item_id, stat)
        
        # Insert the new stat
        await self.conn.execute("""
            INSERT INTO item_stats (item_id, stat_value_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
        """, item_id, stat_value_id)
    
    async def update_nano_stats(self, nano_item_id: int, nano_ql: int, strain_id: str, sub_strain_id: str):
        """Update QL, NanoStrain, and NanoSubStrain stats for a nano"""
        # Get current stats for this nano
        current_stats = await self.get_item_stats(nano_item_id)
        
        # Get current items.ql value
        current_item_ql = await self.conn.fetchval("""
            SELECT ql FROM items WHERE id = $1
        """, nano_item_id)
        
        # Update QL (stat 54 AND items.ql column)
        # if current_stats.get(54) != nano_ql:
        #     await self.update_item_stat(nano_item_id, 54, nano_ql)
        #     self.stats['stat_updates'] += 1
        
        # Update items.ql column if different
        if current_item_ql != nano_ql:
            await self.conn.execute("""
                UPDATE items 
                SET ql = $1 
                WHERE id = $2
            """, nano_ql, nano_item_id)
            self.stats['ql_updates'] += 1
        
        # Update NanoStrain (stat 75) if strain_id is valid
        if strain_id and strain_id.isdigit() and int(strain_id) > 0:
            strain_value = int(strain_id)
            if current_stats.get(75) != strain_value:
                await self.update_item_stat(nano_item_id, 75, strain_value)
                self.stats['strain_updates'] += 1
        
        # Update NanoSubStrain (stat 1003) if sub_strain_id is valid and > 0
        if sub_strain_id and sub_strain_id.isdigit() and int(sub_strain_id) > 0:
            sub_strain_value = int(sub_strain_id)
            if current_stats.get(1003) != sub_strain_value:
                await self.update_item_stat(nano_item_id, 1003, sub_strain_value)
                self.stats['substrain_updates'] += 1
    
    async def process_nano_csv(self):
        """Process the compacted nano CSV and create source relationships"""
        print(f"Processing nano CSV: {self.csv_path}")
        
        # Get source type ID for items
        item_source_type_id = await self.get_item_source_type_id()
        
        # Get existing data to avoid duplicates
        existing_sources = await self.get_existing_sources(item_source_type_id)
        existing_relationships = await self.get_existing_item_sources()
        
        print(f"Found {len(existing_sources)} existing crystal sources")
        print(f"Found {len(existing_relationships)} existing item-source relationships")
        
        # Process CSV
        with open(self.csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                nano_aoid = int(row['nano_id'])
                nano_ql = int(row['ql'])
                crystal_ids = row['crystal_ids'].split(';')
                nano_name = row['nano_name']
                
                # Get nano item info
                nano_item = await self.get_item_info(nano_aoid)
                if not nano_item:
                    print(f"Warning: Nano {nano_aoid} ({nano_name}) not found in items table")
                    continue
                
                nano_item_id = nano_item['id']
                
                # Process each crystal that uploads this nano
                for crystal_aoid_str in crystal_ids:
                    crystal_aoid = int(crystal_aoid_str.strip())
                    
                    # Get crystal info
                    crystal_item = await self.get_item_info(crystal_aoid)
                    if not crystal_item:
                        print(f"Warning: Crystal {crystal_aoid} not found in items table")
                        continue
                    
                    crystal_name = crystal_item['name']
                    
                    # Create or get crystal source
                    if crystal_aoid in existing_sources:
                        source_id = existing_sources[crystal_aoid]
                        self.stats['existing_crystals'] += 1
                    else:
                        source_id = await self.create_crystal_source(
                            crystal_aoid, crystal_name, item_source_type_id
                        )
                        existing_sources[crystal_aoid] = source_id
                        self.stats['crystals_created'] += 1
                    
                    # Create item-source relationship
                    relationship_key = (nano_item_id, source_id)
                    if relationship_key in existing_relationships:
                        self.stats['existing_relationships'] += 1
                    else:
                        metadata = {
                            'nano_name': nano_name,
                            'crystal_name': crystal_name,
                            'crystal_aoid': crystal_aoid
                        }
                        
                        await self.create_item_source_relationship(
                            nano_item_id, source_id, nano_ql, metadata
                        )
                        existing_relationships.add(relationship_key)
                        self.stats['relationships_created'] += 1
                
                # Update nano stat values (QL, NanoStrain, NanoSubStrain)
                try:
                    await self.update_nano_stats(
                        nano_item_id,
                        nano_ql,
                        row.get('strain_id', ''),
                        row.get('sub_strain_id', '')
                    )
                except Exception as e:
                    print(f"Warning: Failed to update stats for nano {nano_aoid} ({nano_name}): {e}")
                
                self.stats['nanos_processed'] += 1
    
    async def print_report(self):
        """Print summary of changes made"""
        print(f"\n{'='*60}")
        print("NANO DATA UPDATE COMPLETE")
        print(f"{'='*60}")
        
        print(f"📊 Processing Results:")
        print(f"  Nano programs processed: {self.stats['nanos_processed']:,}")
        print(f"  Crystal sources created: {self.stats['crystals_created']:,}")
        print(f"  Crystal sources existing: {self.stats['existing_crystals']:,}")
        print(f"  Item-source relationships created: {self.stats['relationships_created']:,}")
        print(f"  Item-source relationships existing: {self.stats['existing_relationships']:,}")
        print(f"")
        print(f"📈 Stat Updates:")
        print(f"  QL column updates (items.ql): {self.stats['ql_updates']:,}")
        print(f"  QL stat updates (stat 54): {self.stats['stat_updates']:,}")
        print(f"  Strain stat updates (stat 75): {self.stats['strain_updates']:,}")
        print(f"  Substrain stat updates (stat 1003): {self.stats['substrain_updates']:,}")
        
        # Verify data integrity
        total_sources = await self.conn.fetchval("""
            SELECT COUNT(*) FROM sources WHERE source_type_id = (
                SELECT id FROM source_types WHERE name = 'item'
            )
        """)
        
        total_relationships = await self.conn.fetchval("""
            SELECT COUNT(*) FROM item_sources
        """)
        
        print(f"\n📈 Database Totals:")
        print(f"  Total crystal sources: {total_sources:,}")
        print(f"  Total item-source relationships: {total_relationships:,}")
        
        print(f"\n✅ Nano data (sources and stats) successfully updated!")
    
    async def run(self):
        """Execute the complete nano data update process"""
        print("="*60)
        print("NANO DATA UPDATE")
        print("="*60)
        
        try:
            await self.connect()
            
            # Process the nano CSV data
            await self.process_nano_csv()
            
            # Print summary report
            await self.print_report()
            
        except Exception as e:
            print(f"❌ Error during update: {e}")
            raise
        finally:
            await self.disconnect()


async def main():
    """Main entry point"""
    updater = NanoDataUpdater()
    await updater.run()


if __name__ == "__main__":
    asyncio.run(main())