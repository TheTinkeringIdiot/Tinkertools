#!/usr/bin/env python3
"""
Optimized Comprehensive Nano Extractor

High-performance version that extracts ALL player-usable nano programs using bulk operations.
"""

import asyncio
import csv
import json
import re
from collections import defaultdict, Counter
from typing import Dict, List, Optional, Tuple

import asyncpg
import pandas as pd


DATABASE_URL = "postgresql://aodbuser:password@localhost:5432/tinkertools"


class OptimizedNanoExtractor:
    def __init__(self):
        self.conn = None
        self.existing_csv_data = {}
        self.nano_strain_map = {}
        self.stats = defaultdict(int)
        
    async def connect_db(self):
        self.conn = await asyncpg.connect(DATABASE_URL)
        
    async def close_db(self):
        if self.conn:
            await self.conn.close()
    
    def load_nano_strain_mapping(self):
        """Load NANO_STRAIN mapping from frontend game-data.ts"""
        print("Loading NANO_STRAIN mapping...")
        
        try:
            with open('/home/quigley/projects/Tinkertools/frontend/src/services/game-data.ts', 'r') as f:
                content = f.read()
            
            # Extract NANO_STRAIN entries using regex
            pattern = r'(\d+):\s*["\']([^"\']+)["\']'
            matches = re.findall(pattern, content)
            
            for strain_id_str, strain_name in matches:
                try:
                    strain_id = int(strain_id_str)
                    if 0 <= strain_id <= 10000:  # Reasonable range for strain IDs
                        self.nano_strain_map[strain_id] = strain_name.strip()
                except ValueError:
                    continue
            
            print(f"Loaded {len(self.nano_strain_map)} strain mappings")
            
        except Exception as e:
            print(f"Warning: Could not load NANO_STRAIN mapping: {e}")
    
    def load_existing_csv(self, csv_path: str):
        """Load existing CSV data for merging"""
        print(f"Loading existing CSV data...")
        
        df = pd.read_csv(csv_path)
        
        for _, row in df.iterrows():
            nano_aoid = row['nano_id']
            
            self.existing_csv_data[nano_aoid] = {
                'crystal_aoid': row['crystal_id'],
                'ql': row['ql'],
                'crystal_name': str(row['crystal_name']),
                'nano_name': str(row['nano_name']),
                'school': str(row['school']),
                'strain': str(row['strain']) if pd.notna(row['strain']) else '',
                'strain_id': row['strain_id'] if pd.notna(row['strain_id']) and row['strain_id'] != 0 else None,
                'sub_strain': str(row['sub_strain']) if pd.notna(row['sub_strain']) else '',
                'professions': str(row['professions']),
                'location': str(row['location']) if pd.notna(row['location']) else '',
                'nano_cost': row['nano_cost'] if pd.notna(row['nano_cost']) else 40,
                'froob_friendly': row['froob_friendly'] if pd.notna(row['froob_friendly']) else 1,
                'sort_order': row['sort_order'] if pd.notna(row['sort_order']) else 1,
                'mm': row['mm'] if pd.notna(row['mm']) else None,
                'bm': row['bm'] if pd.notna(row['bm']) else None,
                'pm': row['pm'] if pd.notna(row['pm']) else None,
                'si': row['si'] if pd.notna(row['si']) else None,
                'ts': row['ts'] if pd.notna(row['ts']) else None,
                'mc': row['mc'] if pd.notna(row['mc']) else None,
            }
        
        print(f"Loaded {len(df)} existing nano entries")
    
    async def extract_all_nano_data_bulk(self):
        """Extract all nano data using proper spell_id 53019 query"""
        print("Extracting all nano crystal and program data via spell_id 53019...")
        
        query = """
        SELECT DISTINCT
            crystal.aoid as crystal_aoid,
            crystal.name as crystal_name,
            crystal.ql as crystal_ql,
            (s.spell_params::json->>'NanoID')::int as nano_aoid,
            nano.name as nano_name,
            nano.ql as nano_ql,
            nanostrain.value as nanostrain
        FROM items crystal
        JOIN item_spell_data isd ON crystal.id = isd.item_id
        JOIN spell_data sd ON isd.spell_data_id = sd.id
        JOIN spell_data_spells sds ON sd.id = sds.spell_data_id
        JOIN spells s ON sds.spell_id = s.id
        LEFT JOIN items nano ON nano.aoid = (s.spell_params::json->>'NanoID')::int
        LEFT JOIN item_stats ns ON nano.id = ns.item_id
        LEFT JOIN stat_values nanostrain ON ns.stat_value_id = nanostrain.id AND nanostrain.stat = 75
        WHERE s.spell_id = 53019
          AND s.spell_params::json->>'NanoID' IS NOT NULL
        ORDER BY crystal.aoid;
        """
        
        print("Running bulk extraction query...")
        rows = await self.conn.fetch(query)
        
        print(f"Found {len(rows)} nano crystal → program mappings")
        self.stats['total_raw_mappings'] = len(rows)
        
        # Process into unique records
        nano_records = {}
        
        for row in rows:
            crystal_aoid = row['crystal_aoid']
            nano_aoid = row['nano_aoid']
            
            # Use the first record for each nano (in case of duplicates)
            if nano_aoid not in nano_records:
                nano_records[nano_aoid] = {
                    'crystal_aoid': crystal_aoid,
                    'crystal_name': row['crystal_name'],
                    'crystal_ql': row['crystal_ql'],
                    'nano_aoid': nano_aoid,
                    'nano_name': row['nano_name'] or f'Unknown Nano {nano_aoid}',
                    'nano_ql': row['nano_ql'] or 1,
                    'nanostrain': row['nanostrain']
                }
        
        self.stats['unique_nanos'] = len(nano_records)
        self.stats['with_nanostrain'] = sum(1 for r in nano_records.values() if r['nanostrain'])
        
        print(f"Processed into {len(nano_records)} unique nano programs")
        print(f"Nanos with nanostrain (stat 75): {self.stats['with_nanostrain']}")
        
        return list(nano_records.values())
    
    async def get_skill_requirements_bulk(self, nano_aoids: List[int]) -> Dict[int, Dict]:
        """Get skill requirements for all nanos in bulk"""
        print(f"Getting skill requirements for {len(nano_aoids)} nanos...")
        
        if not nano_aoids:
            return {}
        
        # Convert AOIDs to database IDs
        aoid_placeholders = ','.join(['$' + str(i+1) for i in range(len(nano_aoids))])
        
        query = f"""
        SELECT 
            nano.aoid,
            c.value1 as stat_id,
            c.value2 as stat_value
        FROM items nano
        JOIN spell_data sd ON nano.id = sd.id
        JOIN spell_data_spells sds ON sd.id = sds.spell_data_id
        JOIN spells s ON sds.spell_id = s.id
        JOIN spell_criteria sc ON s.id = sc.spell_id
        JOIN criteria c ON sc.criterion_id = c.id
        WHERE nano.aoid IN ({aoid_placeholders})
          AND c.value1 IN (54, 160, 161, 162, 163, 164, 165);
        """
        
        rows = await self.conn.fetch(query, *nano_aoids)
        
        # Group by nano AOID
        requirements = defaultdict(dict)
        
        skill_mapping = {
            160: 'mm',   # Matter Metamorphosis
            161: 'bm',   # Biological Metamorphosis
            162: 'pm',   # Psychological Modifications
            163: 'si',   # Sensory Improvement
            164: 'ts',   # Time and Space
            165: 'mc',   # Matter Creation
            54: 'level', # Level requirement
        }
        
        for row in rows:
            nano_aoid = row['aoid']
            stat_id = row['stat_id']
            stat_value = row['stat_value']
            
            if stat_id in skill_mapping:
                skill_name = skill_mapping[stat_id]
                requirements[nano_aoid][skill_name] = stat_value
        
        print(f"Found skill requirements for {len(requirements)} nanos")
        return dict(requirements)
    
    def determine_strain_info(self, nano_record: Dict) -> Tuple[Optional[int], str, str]:
        """Determine strain ID and name using multiple sources"""
        
        nano_aoid = nano_record['nano_aoid']
        
        # Method 1: Use existing CSV data
        if nano_aoid in self.existing_csv_data:
            existing = self.existing_csv_data[nano_aoid]
            if existing.get('strain_id'):
                self.stats['from_existing_csv'] += 1
                return existing['strain_id'], existing['strain'], "existing_csv"
        
        # Method 2: Use nanostrain (stat 75) from database
        if nano_record.get('nanostrain'):
            strain_id = nano_record['nanostrain']
            strain_name = self.nano_strain_map.get(strain_id, f"Strain_{strain_id}")
            self.stats['from_stat75'] += 1
            return strain_id, strain_name, "database_stat75"
        
        # Method 3: Infer from patterns
        strain_id, strain_name = self.infer_strain_from_patterns(
            nano_record['crystal_name'],
            nano_record['nano_name']
        )
        
        if strain_id:
            self.stats['inferred'] += 1
            return strain_id, strain_name, "pattern_inference"
        
        # No strain found
        self.stats['no_strain'] += 1
        return None, "", "no_strain_found"
    
    def infer_strain_from_patterns(self, crystal_name: str, nano_name: str) -> Tuple[Optional[int], str]:
        """Infer strain from name patterns"""
        
        combined_name = f"{crystal_name} {nano_name}".lower()
        
        # Weapon skill patterns with their strain IDs
        weapon_patterns = {
            r'1h?\s*blunt.*expertise|proficiency': (16, "1H Blunt Buffs"),
            r'1h?\s*blunt.*incompetence|inexperience': (17, "1Hand Blunt Debuffs"),
            r'1h?\s*edged.*expertise|proficiency': (21, "1H Edged Buffs"),
            r'1h?\s*edged.*incompetence|inexperience': (22, "1H Edged Debuffs"),
            r'2h?\s*blunt.*expertise|proficiency': (23, "2H Blunt Buffs"),
            r'2h?\s*blunt.*incompetence|inexperience': (24, "2H Blunt Debuffs"),
            r'2h?\s*edged.*expertise|proficiency': (25, "2H Edged Buffs"),
            r'2h?\s*edged.*incompetence|inexperience': (26, "2H Edged Debuffs"),
            r'bow.*expertise|proficiency': (27, "Bow Buffs"),
            r'crossbow.*expertise|proficiency': (29, "Crossbow Buffs"),
            r'burst.*expertise|proficiency': (31, "Burst Buffs"),
            r'full\s*auto.*expertise|proficiency': (33, "Full Auto Buffs"),
        }
        
        for pattern, (strain_id, strain_name) in weapon_patterns.items():
            if re.search(pattern, combined_name):
                return strain_id, strain_name
        
        # Healing patterns
        if re.search(r'heal.*single|target.*heal|cure|antidote', combined_name):
            return 951, "Single Target Healing"
        elif re.search(r'heal.*team|group.*heal', combined_name):
            return 5, "Team Healing"
        
        # Damage patterns
        if any(word in combined_name for word in ['nuke', 'blast', 'damage']):
            return 1, "Damage Shields"
        
        # Control patterns
        if 'root' in combined_name or 'entangle' in combined_name:
            return 146, "Root"
        elif 'snare' in combined_name or 'slow' in combined_name:
            return 145, "Snare"
        elif any(word in combined_name for word in ['mezz', 'charm', 'hypnosis']):
            return 147, "Mezz"
        
        return None, ""
    
    def merge_data_sources(self, nano_record: Dict, requirements: Dict, strain_info: Tuple) -> Dict:
        """Merge all data sources into final nano record"""
        
        nano_aoid = nano_record['nano_aoid']
        strain_id, strain_name, source = strain_info
        
        # Get existing CSV data if available
        existing = self.existing_csv_data.get(nano_aoid, {})
        
        # Use QL from crystal, not nano program
        ql = nano_record['crystal_ql']
        
        record = {
            'crystal_id': nano_record['crystal_aoid'],
            'nano_id': nano_aoid,
            'ql': ql,
            'crystal_name': nano_record['crystal_name'],
            'nano_name': nano_record['nano_name'],
            'school': existing.get('school', self._infer_school(nano_record['nano_name'])),
            'strain': strain_name,
            'strain_id': strain_id or 0,
            'sub_strain': existing.get('sub_strain', ''),
            'professions': existing.get('professions', self._infer_profession(nano_record['crystal_name'])),
            'location': existing.get('location', ''),
            'nano_cost': existing.get('nano_cost', self._calculate_nano_cost(requirements)),
            'froob_friendly': existing.get('froob_friendly', 1),
            'sort_order': existing.get('sort_order', 1),
            'nano_deck': 0,
            'spec': '',
            'min_level': requirements.get('level', ''),
            'mm': requirements.get('mm') or existing.get('mm', ''),
            'bm': requirements.get('bm') or existing.get('bm', ''),
            'pm': requirements.get('pm') or existing.get('pm', ''),
            'si': requirements.get('si') or existing.get('si', ''),
            'ts': requirements.get('ts') or existing.get('ts', ''),
            'mc': requirements.get('mc') or existing.get('mc', ''),
            'source': source,
            'has_nanostrain_stat': nano_record.get('nanostrain') is not None,
            'nanostrain_value': nano_record.get('nanostrain') or '',
            'in_original_csv': nano_aoid in self.existing_csv_data
        }
        
        return record
    
    def _infer_school(self, nano_name: str) -> str:
        """Infer nano school from name"""
        name_lower = nano_name.lower()
        
        if any(word in name_lower for word in ['heal', 'cure', 'mend', 'restoration']):
            return 'Treatment'
        elif any(word in name_lower for word in ['nuke', 'blast', 'burn', 'damage']):
            return 'Offensive'
        elif any(word in name_lower for word in ['expertise', 'proficiency', 'enhance', 'boost']):
            return 'Buffs'
        elif any(word in name_lower for word in ['incompetence', 'inexperience', 'weaken']):
            return 'Debuffs'
        elif any(word in name_lower for word in ['creation:', 'summon', 'manifest']):
            return 'Creation'
        elif any(word in name_lower for word in ['root', 'snare', 'mezz', 'charm']):
            return 'Crowd Control'
        
        return 'Unknown'
    
    def _infer_profession(self, crystal_name: str) -> str:
        """Infer profession from crystal name"""
        name_lower = crystal_name.lower()
        
        profession_patterns = [
            (r'doctor', 'Doctor'),
            (r'trader', 'Trader'),
            (r'nano-?technician', 'Nano-Technician'),
            (r'meta-?physicist', 'Meta-Physicist'),
            (r'bureaucrat', 'Bureaucrat'),
            (r'enforcer', 'Enforcer'),
            (r'soldier', 'Soldier'),
            (r'martial\s+artist', 'Martial Artist'),
            (r'engineer', 'Engineer'),
            (r'fixer', 'Fixer'),
            (r'adventurer', 'Adventurer'),
            (r'keeper', 'Keeper'),
            (r'shade', 'Shade'),
        ]
        
        for pattern, profession in profession_patterns:
            if re.search(pattern, name_lower):
                return profession
        
        return 'General'
    
    def _calculate_nano_cost(self, requirements: Dict) -> int:
        """Calculate NCU cost from requirements"""
        skills = ['mm', 'bm', 'pm', 'si', 'ts', 'mc']
        max_req = 0
        
        for skill in skills:
            value = requirements.get(skill)
            if value and isinstance(value, (int, float)):
                max_req = max(max_req, int(value))
        
        return max(int(max_req * 0.7), 10) if max_req > 0 else 40
    
    async def generate_comprehensive_csv(self, output_path: str):
        """Generate the comprehensive nano CSV using optimized bulk operations"""
        print("=== COMPREHENSIVE NANO EXTRACTION ===")
        
        # Step 1: Extract all nano data in bulk
        nano_records = await self.extract_all_nano_data_bulk()
        
        # Step 2: Get skill requirements in bulk
        nano_aoids = [r['nano_aoid'] for r in nano_records]
        skill_requirements = await self.get_skill_requirements_bulk(nano_aoids)
        
        # Step 3: Process each nano
        print("Processing nano strain assignments...")
        results = []
        
        for nano_record in nano_records:
            nano_aoid = nano_record['nano_aoid']
            requirements = skill_requirements.get(nano_aoid, {})
            
            # Determine strain
            strain_info = self.determine_strain_info(nano_record)
            
            # Merge all data
            final_record = self.merge_data_sources(nano_record, requirements, strain_info)
            results.append(final_record)
        
        # Step 4: Write CSV
        print(f"Writing {len(results)} nano records to CSV...")
        
        fieldnames = [
            'crystal_id', 'nano_id', 'ql', 'crystal_name', 'nano_name',
            'school', 'strain', 'strain_id', 'sub_strain', 'professions',
            'location', 'nano_cost', 'froob_friendly', 'sort_order',
            'nano_deck', 'spec', 'min_level', 'mm', 'bm', 'pm', 'si', 'ts', 'mc',
            'source', 'has_nanostrain_stat', 'nanostrain_value', 'in_original_csv'
        ]
        
        with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(results)
        
        self._print_comprehensive_report(len(results))
        self._generate_analysis_files(results, output_path)
        
    def _print_comprehensive_report(self, total_records: int):
        """Print final comprehensive report"""
        print(f"\n{'='*70}")
        print("🎉 COMPREHENSIVE NANO EXTRACTION COMPLETE")
        print(f"{'='*70}")
        
        print(f"📊 Extraction Results:")
        print(f"  Total nano programs: {total_records:,}")
        print(f"  Raw crystal→nano mappings: {self.stats['total_raw_mappings']:,}")
        print(f"  Unique nanos processed: {self.stats['unique_nanos']:,}")
        print(f"  Nanos with nanostrain stat: {self.stats['with_nanostrain']:,}")
        
        print(f"\n🏷️  Strain Assignment Sources:")
        print(f"  From existing CSV: {self.stats['from_existing_csv']:,}")
        print(f"  From database stat 75: {self.stats['from_stat75']:,}")
        print(f"  Pattern inference: {self.stats['inferred']:,}")
        print(f"  No strain found: {self.stats['no_strain']:,}")
        
        total_with_strains = (self.stats['from_existing_csv'] + 
                             self.stats['from_stat75'] + 
                             self.stats['inferred'])
        
        coverage = (total_with_strains / total_records * 100) if total_records > 0 else 0
        print(f"  Overall strain coverage: {total_with_strains:,}/{total_records:,} ({coverage:.1f}%)")
        
        print(f"\n📈 Compared to original CSV:")
        original_count = len(self.existing_csv_data)
        new_nanos = total_records - original_count
        print(f"  Original CSV entries: {original_count:,}")
        print(f"  New nanos discovered: {new_nanos:,} ({(new_nanos/original_count)*100:.1f}% increase)")
    
    def _generate_analysis_files(self, results: List[Dict], output_path: str):
        """Generate additional analysis files"""
        base_path = output_path.replace('.csv', '')
        
        # Missing strains report
        missing_strains = [r for r in results if r['strain_id'] == 0]
        if missing_strains:
            missing_path = f"{base_path}_missing_strains.csv"
            with open(missing_path, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=['crystal_id', 'nano_id', 'nano_name', 'professions', 'school'])
                writer.writeheader()
                for nano in missing_strains:
                    writer.writerow({
                        'crystal_id': nano['crystal_id'],
                        'nano_id': nano['nano_id'], 
                        'nano_name': nano['nano_name'],
                        'professions': nano['professions'],
                        'school': nano['school']
                    })
            print(f"📋 Missing strains report: {missing_path}")
        
        # New nanos report  
        new_nanos = [r for r in results if not r['in_original_csv']]
        if new_nanos:
            new_path = f"{base_path}_new_nanos.csv"
            with open(new_path, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=['crystal_id', 'nano_id', 'nano_name', 'strain', 'source'])
                writer.writeheader()
                for nano in new_nanos:
                    writer.writerow({
                        'crystal_id': nano['crystal_id'],
                        'nano_id': nano['nano_id'],
                        'nano_name': nano['nano_name'], 
                        'strain': nano['strain'],
                        'source': nano['source']
                    })
            print(f"🆕 New nanos report: {new_path}")


async def main():
    extractor = OptimizedNanoExtractor()
    
    try:
        await extractor.connect_db()
        
        # Load reference data
        extractor.load_nano_strain_mapping()
        extractor.load_existing_csv('/home/quigley/projects/Tinkertools/backend/nanos.csv')
        
        # Generate comprehensive CSV
        await extractor.generate_comprehensive_csv('/home/quigley/projects/Tinkertools/backend/all_nanos_comprehensive.csv')
        
        print(f"\n🎉 Success!")
        print(f"📁 Main output: /home/quigley/projects/Tinkertools/backend/all_nanos_comprehensive.csv")
        
    finally:
        await extractor.close_db()


if __name__ == "__main__":
    asyncio.run(main())