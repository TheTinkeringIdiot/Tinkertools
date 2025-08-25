#!/usr/bin/env python3
"""
Comprehensive Nano Extractor

Extracts ALL player-usable nano programs by:
1. Finding all nano crystals (items with upload nano spells)
2. Getting the nano program details from the NanoID parameter
3. Extracting nanostrain (stat 75) where available
4. Merging with existing CSV data
5. Inferring missing strain assignments
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

# Load NANO_STRAIN mapping from frontend file
NANO_STRAIN = {}


class ComprehensiveNanoExtractor:
    def __init__(self):
        self.conn = None
        self.existing_csv_data = {}
        self.nano_strain_map = {}
        self.stats = {
            'total_crystals': 0,
            'total_nanos': 0,
            'with_stat75': 0,
            'from_existing_csv': 0,
            'inferred_strains': 0,
            'missing_strains': 0
        }
        
    async def connect_db(self):
        self.conn = await asyncpg.connect(DATABASE_URL)
        
    async def close_db(self):
        if self.conn:
            await self.conn.close()
    
    def load_nano_strain_mapping(self):
        """Load NANO_STRAIN mapping from frontend game-data.ts"""
        print("Loading NANO_STRAIN mapping from frontend...")
        
        try:
            with open('/home/quigley/projects/Tinkertools/frontend/src/services/game-data.ts', 'r') as f:
                content = f.read()
            
            # Extract NANO_STRAIN object
            start = content.find('export const NANO_STRAIN = {')
            if start == -1:
                print("Warning: Could not find NANO_STRAIN in game-data.ts")
                return
                
            brace_count = 0
            i = start
            while i < len(content):
                if content[i] == '{':
                    brace_count += 1
                elif content[i] == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        break
                i += 1
            
            nano_strain_text = content[start:i+1]
            
            # Parse the NANO_STRAIN entries
            lines = nano_strain_text.split('\n')
            for line in lines:
                line = line.strip()
                if ':' in line and not line.startswith('export'):
                    try:
                        # Parse lines like: 123: "Strain Name",
                        parts = line.split(':', 1)
                        if len(parts) == 2:
                            strain_id = int(parts[0].strip())
                            strain_name = parts[1].strip().strip(',').strip('"\'')
                            if strain_name:
                                self.nano_strain_map[strain_id] = strain_name
                    except (ValueError, IndexError):
                        continue
            
            print(f"Loaded {len(self.nano_strain_map)} strain mappings")
            
        except Exception as e:
            print(f"Warning: Could not load NANO_STRAIN mapping: {e}")
    
    def load_existing_csv(self, csv_path: str):
        """Load existing CSV data for merging"""
        print(f"Loading existing CSV data from {csv_path}...")
        
        df = pd.read_csv(csv_path)
        
        for _, row in df.iterrows():
            nano_aoid = row['nano_id']
            
            self.existing_csv_data[nano_aoid] = {
                'crystal_aoid': row['crystal_id'],
                'nano_aoid': nano_aoid,
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
    
    async def extract_all_nano_crystals(self) -> List[Dict]:
        """Extract all nano crystals with their upload nano spells and nano details in one query"""
        print("Extracting all nano crystals from database...")
        
        # Enhanced query with subquery to avoid duplicates from multiple stats
        query = """
        SELECT DISTINCT
            crystal.aoid as crystal_aoid,
            crystal.name as crystal_name,
            crystal.ql as crystal_ql,
            (s.spell_params::json->>'NanoID')::int as nano_aoid,
            nano.name as nano_name,
            nano.description as nano_description,
            nano.ql as nano_ql,
            nanostrain_data.nanostrain
        FROM items crystal
        JOIN item_spell_data isd ON crystal.id = isd.item_id
        JOIN spell_data sd ON isd.spell_data_id = sd.id
        JOIN spell_data_spells sds ON sd.id = sds.spell_data_id
        JOIN spells s ON sds.spell_id = s.id
        LEFT JOIN items nano ON nano.aoid = (s.spell_params::json->>'NanoID')::int
        LEFT JOIN LATERAL (
            SELECT sv.value as nanostrain
            FROM item_stats ns
            JOIN stat_values sv ON ns.stat_value_id = sv.id
            WHERE ns.item_id = nano.id AND sv.stat = 75
            LIMIT 1
        ) nanostrain_data ON true
        WHERE s.spell_id = 53019
          AND s.spell_params::json->>'NanoID' IS NOT NULL
        ORDER BY crystal.aoid;
        """
        
        rows = await self.conn.fetch(query)
        
        # Keep ALL crystal-nano relationships (no deduplication)
        crystals = []
        unique_nanos = set()
        unique_crystals = set()
        
        for row in rows:
            crystal_data = {
                'crystal_aoid': row['crystal_aoid'],
                'crystal_name': row['crystal_name'],
                'crystal_ql': row['crystal_ql'],
                'nano_aoid': row['nano_aoid'],
                'nano_name': row['nano_name'] or f'Unknown Nano {row["nano_aoid"]}',
                'nano_description': row['nano_description'] or '',
                'nano_ql': row['nano_ql'] or 1,
                'nanostrain': row['nanostrain']
            }
            crystals.append(crystal_data)
            unique_nanos.add(row['nano_aoid'])
            unique_crystals.add(row['crystal_aoid'])
        
        self.stats['total_mappings'] = len(crystals)
        self.stats['unique_nanos'] = len(unique_nanos)
        self.stats['unique_crystals'] = len(unique_crystals)
        self.stats['with_stat75'] = sum(1 for c in crystals if c['nanostrain'])
        
        print(f"Found {len(crystals)} total crystal→nano mappings")
        print(f"Unique nano programs: {len(unique_nanos)}")
        print(f"Unique crystals: {len(unique_crystals)}")
        print(f"With nanostrain (stat 75): {self.stats['with_stat75']}")
        
        return crystals
    
    async def get_nano_program_details(self, nano_aoid: int) -> Dict:
        """Get details for a nano program including stat 75 (nanostrain)"""
        
        # Get nano program basic info
        nano_query = "SELECT aoid, name, ql FROM items WHERE aoid = $1;"
        nano_result = await self.conn.fetchrow(nano_query, nano_aoid)
        
        if not nano_result:
            return {'aoid': nano_aoid, 'name': f'Unknown Nano {nano_aoid}', 'ql': 1}
        
        nano_details = {
            'aoid': nano_result['aoid'],
            'name': nano_result['name'],
            'ql': nano_result['ql'],
            'nanostrain': None
        }
        
        # Get nanostrain (stat 75) if present
        strain_query = """
        SELECT sv.value 
        FROM item_stats its 
        JOIN stat_values sv ON its.stat_value_id = sv.id 
        WHERE its.item_id = (SELECT id FROM items WHERE aoid = $1)
          AND sv.stat = 75;
        """
        
        strain_result = await self.conn.fetchrow(strain_query, nano_aoid)
        if strain_result:
            nano_details['nanostrain'] = strain_result['value']
            self.stats['with_stat75'] += 1
        
        # Get casting requirements
        requirements = await self.get_nano_requirements(nano_aoid)
        nano_details.update(requirements)
        
        return nano_details
    
    async def get_skill_requirements_bulk(self, nano_aoids: List[int]) -> Dict[int, Dict]:
        """Get skill requirements for all nanos in bulk"""
        print(f"Getting skill requirements for {len(set(nano_aoids))} unique nanos...")
        
        if not nano_aoids:
            return {}
        
        unique_aoids = list(set(nano_aoids))
        aoid_placeholders = ','.join(['$' + str(i+1) for i in range(len(unique_aoids))])
        
        query = f"""
        SELECT 
            nano.aoid,
            c.value1 as stat_id,
            c.value2 as stat_value
        FROM items nano
        JOIN item_spell_data isd ON nano.id = isd.item_id
        JOIN spell_data sd ON isd.spell_data_id = sd.id
        JOIN spell_data_spells sds ON sd.id = sds.spell_data_id
        JOIN spells s ON sds.spell_id = s.id
        JOIN spell_criteria sc ON s.id = sc.spell_id
        JOIN criteria c ON sc.criterion_id = c.id
        WHERE nano.aoid IN ({aoid_placeholders})
          AND c.value1 IN (54, 160, 161, 162, 163, 164, 165);
        """
        
        rows = await self.conn.fetch(query, *unique_aoids)
        
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
        
        return dict(requirements)
    
    def determine_strain_info(self, crystal_data: Dict, nano_details: Dict) -> Tuple[Optional[int], str, str]:
        """Determine strain ID and name using multiple sources"""
        
        nano_aoid = nano_details['aoid']
        
        # Method 1: Use existing CSV data
        if nano_aoid in self.existing_csv_data:
            existing = self.existing_csv_data[nano_aoid]
            if existing.get('strain_id'):
                self.stats['from_existing_csv'] += 1
                return existing['strain_id'], existing['strain'], "existing_csv"
        
        # Method 2: Use nanostrain (stat 75) from database
        if nano_details.get('nanostrain'):
            strain_id = nano_details['nanostrain']
            strain_name = self.nano_strain_map.get(strain_id, f"Strain_{strain_id}")
            return strain_id, strain_name, "database_stat75"
        
        # Method 3: Infer from patterns
        strain_id, strain_name = self.infer_strain_from_patterns(
            crystal_data['crystal_name'],
            nano_details['name']
        )
        
        if strain_id:
            self.stats['inferred_strains'] += 1
            return strain_id, strain_name, "pattern_inference"
        
        # No strain found
        self.stats['missing_strains'] += 1
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
            r'bow.*incompetence|inexperience': (28, "Bow Debuffs"),
            r'crossbow.*expertise|proficiency': (29, "Crossbow Buffs"),
            r'crossbow.*incompetence|inexperience': (30, "Crossbow Debuffs"),
            r'burst.*expertise|proficiency': (31, "Burst Buffs"),
            r'burst.*incompetence|inexperience': (32, "Burst Debuffs"),
            r'full\s*auto.*expertise|proficiency': (33, "Full Auto Buffs"),
            r'full\s*auto.*incompetence|inexperience': (34, "Full Auto Debuffs"),
        }
        
        for pattern, (strain_id, strain_name) in weapon_patterns.items():
            if re.search(pattern, combined_name):
                return strain_id, strain_name
        
        # Other common patterns
        healing_patterns = {
            r'heal.*single|target.*heal': (951, "Single Target Healing"),
            r'heal.*team|group.*heal': (5, "Team Healing"),
            r'cure|antidote': (951, "Single Target Healing"),
        }
        
        for pattern, (strain_id, strain_name) in healing_patterns.items():
            if re.search(pattern, combined_name):
                return strain_id, strain_name
        
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
    
    def merge_data_sources(self, crystal_data: Dict, nano_details: Dict, strain_info: Tuple) -> Dict:
        """Merge all data sources into final nano record"""
        
        nano_aoid = nano_details['aoid']
        strain_id, strain_name, source = strain_info
        
        # Get existing CSV data if available
        existing = self.existing_csv_data.get(nano_aoid, {})
        
        # Use QL from crystal, not nano program
        ql = crystal_data['crystal_ql']
        
        record = {
            'crystal_id': crystal_data['crystal_aoid'],
            'nano_id': nano_aoid,
            'ql': ql,
            'crystal_name': crystal_data['crystal_name'],
            'nano_name': nano_details['name'],
            'nano_description': crystal_data.get('nano_description', ''),
            'school': existing.get('school', self._infer_school(nano_details['name'])),
            'strain': strain_name,
            'strain_id': strain_id or 0,
            'sub_strain': existing.get('sub_strain', ''),
            'professions': existing.get('professions', self._infer_profession(crystal_data['crystal_name'])),
            'location': existing.get('location', ''),
            'nano_cost': existing.get('nano_cost', self._calculate_nano_cost(nano_details)),
            'froob_friendly': existing.get('froob_friendly', 1),
            'sort_order': existing.get('sort_order', 1),
            'nano_deck': 0,
            'spec': '',
            'min_level': nano_details.get('level', ''),
            'mm': nano_details.get('mm') or existing.get('mm', ''),
            'bm': nano_details.get('bm') or existing.get('bm', ''),
            'pm': nano_details.get('pm') or existing.get('pm', ''),
            'si': nano_details.get('si') or existing.get('si', ''),
            'ts': nano_details.get('ts') or existing.get('ts', ''),
            'mc': nano_details.get('mc') or existing.get('mc', ''),
            'source': source,
            'has_nanostrain_stat': nano_details.get('nanostrain') is not None,
            'nanostrain_value': nano_details.get('nanostrain', '')
        }
        
        return record
    
    def _infer_school(self, nano_name: str) -> str:
        """Infer nano school from name"""
        name_lower = nano_name.lower()
        
        school_patterns = {
            'Treatment': ['heal', 'cure', 'mend', 'restoration', 'antidote'],
            'Offensive': ['nuke', 'blast', 'burn', 'freeze', 'shock', 'damage'],
            'Buffs': ['expertise', 'proficiency', 'enhance', 'improve', 'boost'],
            'Debuffs': ['incompetence', 'inexperience', 'weaken', 'reduce'],
            'Creation': ['creation:', 'summon', 'manifest'],
            'Crowd Control': ['root', 'snare', 'mezz', 'charm', 'calm'],
        }
        
        for school, keywords in school_patterns.items():
            if any(keyword in name_lower for keyword in keywords):
                return school
        
        return 'Unknown'
    
    def _infer_profession(self, crystal_name: str) -> str:
        """Infer profession from crystal name"""
        name_lower = crystal_name.lower()
        
        profession_patterns = {
            r'doctor': 'Doctor',
            r'trader': 'Trader',
            r'nano-?technician': 'Nano-Technician',
            r'meta-?physicist': 'Meta-Physicist',
            r'bureaucrat': 'Bureaucrat',
            r'enforcer': 'Enforcer',
            r'soldier': 'Soldier',
            r'martial\s+artist': 'Martial Artist',
            r'engineer': 'Engineer',
            r'fixer': 'Fixer',
            r'adventurer': 'Adventurer',
            r'keeper': 'Keeper',
            r'shade': 'Shade',
        }
        
        for pattern, profession in profession_patterns.items():
            if re.search(pattern, name_lower):
                return profession
        
        return 'General'
    
    def _calculate_nano_cost(self, nano_details: Dict) -> int:
        """Calculate NCU cost from requirements"""
        skills = ['mm', 'bm', 'pm', 'si', 'ts', 'mc']
        max_req = 0
        
        for skill in skills:
            value = nano_details.get(skill)
            if value and isinstance(value, (int, float)):
                max_req = max(max_req, int(value))
        
        return max(int(max_req * 0.7), 10) if max_req > 0 else 40
    
    async def generate_comprehensive_csv(self, output_path: str):
        """Generate the comprehensive nano CSV"""
        print("Generating comprehensive nano CSV...")
        
        # Extract all nano crystals
        crystals = await self.extract_all_nano_crystals()
        
        # Get skill requirements for all unique nanos in bulk
        all_nano_aoids = [c['nano_aoid'] for c in crystals]
        bulk_requirements = await self.get_skill_requirements_bulk(all_nano_aoids)
        
        results = []
        processed = 0
        
        for crystal_data in crystals:
            processed += 1
            if processed % 2000 == 0:
                print(f"Processed {processed}/{len(crystals)} crystal→nano mappings...")
            
            # Crystal data now includes nano details from the comprehensive query
            nano_details = {
                'aoid': crystal_data['nano_aoid'],
                'name': crystal_data['nano_name'],
                'ql': crystal_data['nano_ql'],
                'nanostrain': crystal_data['nanostrain']
            }
            
            # Add skill requirements from bulk query
            nano_aoid = crystal_data['nano_aoid']
            if nano_aoid in bulk_requirements:
                nano_details.update(bulk_requirements[nano_aoid])
            
            # Determine strain information
            strain_info = self.determine_strain_info(crystal_data, nano_details)
            
            # Merge all data
            record = self.merge_data_sources(crystal_data, nano_details, strain_info)
            
            results.append(record)
        
        self.stats['total_nanos'] = len(results)
        
        # Write CSV
        fieldnames = [
            'crystal_id', 'nano_id', 'ql', 'crystal_name', 'nano_name', 'nano_description',
            'school', 'strain', 'strain_id', 'sub_strain', 'professions',
            'location', 'nano_cost', 'froob_friendly', 'sort_order',
            'nano_deck', 'spec', 'min_level', 'mm', 'bm', 'pm', 'si', 'ts', 'mc',
            'source', 'has_nanostrain_stat', 'nanostrain_value'
        ]
        
        with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(results)
        
        self._print_comprehensive_report()
        
    def _print_comprehensive_report(self):
        """Print final comprehensive report"""
        print(f"\n{'='*70}")
        print("COMPREHENSIVE NANO EXTRACTION COMPLETE")
        print(f"{'='*70}")
        
        print(f"📊 Extraction Results:")
        print(f"  Total crystal→nano mappings: {self.stats.get('total_mappings', self.stats['total_nanos']):,}")
        print(f"  Unique nano programs: {self.stats.get('unique_nanos', 'N/A'):,}")
        print(f"  Unique crystals: {self.stats.get('unique_crystals', 'N/A'):,}")
        
        if self.stats.get('unique_crystals') and self.stats.get('unique_nanos'):
            avg_crystals = self.stats['unique_crystals'] / self.stats['unique_nanos']
            print(f"  Average crystals per nano: {avg_crystals:.1f}")
        
        print(f"\n🏷️  Strain Assignment Sources:")
        print(f"  From existing CSV: {self.stats['from_existing_csv']:,}")
        print(f"  From database stat 75: {self.stats['with_stat75']:,}")
        print(f"  Pattern inference: {self.stats['inferred_strains']:,}")
        print(f"  Missing strains: {self.stats['missing_strains']:,}")
        
        total_with_strains = (self.stats['from_existing_csv'] + 
                             self.stats['with_stat75'] + 
                             self.stats['inferred_strains'])
        
        coverage = (total_with_strains / self.stats['total_nanos'] * 100) if self.stats['total_nanos'] > 0 else 0
        print(f"  Overall strain coverage: {total_with_strains:,}/{self.stats['total_nanos']:,} ({coverage:.1f}%)")
        
        print(f"\n💎 Crystal Variety:")
        print(f"  Total mappings show all crystal variants for each nano")
        print(f"  Preserves QL differences, names, and availability")


async def main():
    extractor = ComprehensiveNanoExtractor()
    
    try:
        await extractor.connect_db()
        
        # Load reference data
        extractor.load_nano_strain_mapping()
        extractor.load_existing_csv('/home/quigley/projects/Tinkertools/backend/nanos.csv')
        
        # Generate comprehensive CSV
        await extractor.generate_comprehensive_csv('/home/quigley/projects/Tinkertools/backend/all_nanos_comprehensive.csv')
        
        print(f"\n🎉 Comprehensive nano extraction complete!")
        print(f"📁 Output: /home/quigley/projects/Tinkertools/backend/all_nanos_comprehensive.csv")
        
    finally:
        await extractor.close_db()


if __name__ == "__main__":
    asyncio.run(main())