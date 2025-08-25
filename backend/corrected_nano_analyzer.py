#!/usr/bin/env python3
"""
Corrected Nano Analyzer

Fixed version that uses proper Anarchy Online AOIDs:
- crystal_id: AOID of the uploadable nano crystal item
- nano_id: AOID of the actual nano program
"""

import asyncio
import csv
import json
import re
from collections import defaultdict, Counter
from typing import Dict, List, Optional, Tuple
from difflib import SequenceMatcher

import asyncpg
import pandas as pd


DATABASE_URL = "postgresql://aodbuser:password@localhost:5432/tinkertools"


class CorrectedNanoAnalyzer:
    def __init__(self):
        self.conn = None
        self.existing_csv_data = {}
        self.crystal_to_nano_map = {}
        self.nano_to_crystal_map = {}
        self.strain_patterns = {}
        
    async def connect_db(self):
        self.conn = await asyncpg.connect(DATABASE_URL)
        
    async def close_db(self):
        if self.conn:
            await self.conn.close()
    
    def load_existing_csv(self, csv_path: str):
        """Load existing CSV and build AOID mappings"""
        print(f"Loading existing CSV data from {csv_path}...")
        df = pd.read_csv(csv_path)
        
        for _, row in df.iterrows():
            crystal_aoid = row['crystal_id'] 
            nano_aoid = row['nano_id']
            strain_id = row['strain_id'] if pd.notna(row['strain_id']) and row['strain_id'] != 0 else None
            
            # Store complete nano data indexed by nano AOID
            self.existing_csv_data[nano_aoid] = {
                'crystal_aoid': crystal_aoid,
                'nano_aoid': nano_aoid,
                'nano_name': str(row['nano_name']),
                'crystal_name': str(row['crystal_name']),
                'strain': str(row['strain']) if pd.notna(row['strain']) else '',
                'strain_id': strain_id,
                'school': str(row['school']),
                'professions': str(row['professions']),
                'location': str(row['location']),
                'sub_strain': str(row['sub_strain']) if pd.notna(row['sub_strain']) else '',
                'ql': row['ql'],
                'mm': row['mm'] if pd.notna(row['mm']) else None,
                'bm': row['bm'] if pd.notna(row['bm']) else None,
                'pm': row['pm'] if pd.notna(row['pm']) else None,
                'si': row['si'] if pd.notna(row['si']) else None,
                'ts': row['ts'] if pd.notna(row['ts']) else None,
                'mc': row['mc'] if pd.notna(row['mc']) else None,
            }
            
            # Build crystal ↔ nano mappings
            self.crystal_to_nano_map[crystal_aoid] = nano_aoid
            self.nano_to_crystal_map[nano_aoid] = crystal_aoid
            
            # Build strain patterns for inference
            if strain_id:
                nano_words = re.findall(r'\b\w+\b', str(row['nano_name']).lower())
                self.strain_patterns[strain_id] = self.strain_patterns.get(strain_id, []) + nano_words
        
        print(f"Loaded {len(df)} nano entries")
        print(f"Built crystal↔nano mappings for {len(self.crystal_to_nano_map)} pairs")
        print(f"Found strain patterns for {len(self.strain_patterns)} strains")
    
    async def extract_all_player_nanos(self) -> List[Dict]:
        """Extract all player-castable nanos using proper AOIDs"""
        print("Extracting all player-castable nanos with AOIDs...")
        
        # Query for nano programs that have actions (player-castable)
        query = """
        SELECT DISTINCT 
            i.aoid as nano_aoid,
            i.name as nano_name,
            i.ql,
            ARRAY_AGG(s.id ORDER BY s.id) as spell_ids,
            ARRAY_AGG(s.spell_params::text ORDER BY s.id) as spell_params_list
        FROM items i
        JOIN actions a ON i.id = a.item_id
        JOIN spell_data sd ON i.id = sd.id
        JOIN spell_data_spells sds ON sd.id = sds.spell_data_id  
        JOIN spells s ON sds.spell_id = s.id
        WHERE i.is_nano = true
        GROUP BY i.aoid, i.name, i.ql
        ORDER BY i.aoid;
        """
        
        rows = await self.conn.fetch(query)
        
        nanos = []
        for row in rows:
            nano_aoid = row['nano_aoid']
            
            # Parse spell parameters
            spell_params_list = []
            for params_text in row['spell_params_list']:
                try:
                    params = json.loads(params_text) if params_text else {}
                    spell_params_list.append(params)
                except (json.JSONDecodeError, TypeError):
                    spell_params_list.append({})
            
            # Get crystal AOID from existing mapping or try to find it
            crystal_aoid = self.nano_to_crystal_map.get(nano_aoid)
            if not crystal_aoid:
                # Try to find crystal by matching name patterns
                crystal_aoid = await self._find_crystal_for_nano(nano_aoid, row['nano_name'])
            
            nano_data = {
                'nano_aoid': nano_aoid,
                'crystal_aoid': crystal_aoid,
                'nano_name': row['nano_name'],
                'ql': row['ql'],
                'spell_ids': list(row['spell_ids']),
                'spell_params_list': spell_params_list
            }
            
            nanos.append(nano_data)
        
        print(f"Found {len(nanos)} player-castable nano programs")
        
        # Report crystal mapping success
        with_crystals = sum(1 for n in nanos if n['crystal_aoid'])
        print(f"Found crystal mappings for {with_crystals}/{len(nanos)} nanos ({with_crystals/len(nanos)*100:.1f}%)")
        
        return nanos
    
    async def _find_crystal_for_nano(self, nano_aoid: int, nano_name: str) -> Optional[int]:
        """Try to find the crystal AOID for a nano program"""
        
        # Look for crystals with names that match the nano
        possible_crystal_names = [
            f'Nano Crystal ({nano_name})',
            f'NanoCrystal ({nano_name})', 
            f'Crystal ({nano_name})',
        ]
        
        for crystal_name in possible_crystal_names:
            query = "SELECT aoid FROM items WHERE name = $1 AND is_nano = false;"
            result = await self.conn.fetchrow(query, crystal_name)
            if result:
                return result['aoid']
        
        # Try fuzzy matching for crystals
        query = "SELECT aoid, name FROM items WHERE name ILIKE $1 AND is_nano = false;"
        rows = await self.conn.fetch(query, f'%{nano_name}%')
        
        for row in rows:
            # Check if this looks like a nano crystal
            if any(word in row['name'].lower() for word in ['crystal', 'matrix', 'box']):
                return row['aoid']
        
        return None
    
    def infer_strain_from_existing_data(self, nano_aoid: int) -> Tuple[Optional[int], str, str]:
        """Get strain from existing CSV data or infer it"""
        
        # Check existing data first
        existing = self.existing_csv_data.get(nano_aoid)
        if existing and existing.get('strain_id'):
            return existing['strain_id'], "existing_csv_data", existing['strain']
        
        # If we have the nano but no strain, try inference
        if existing:
            strain_id = self._infer_strain_from_patterns(
                existing['nano_name'], 
                existing['school'],
                existing['professions']
            )
            if strain_id:
                strain_name = self._get_strain_name_by_id(strain_id)
                return strain_id, "pattern_inference", strain_name
        
        return None, "no_strain_available", ""
    
    def _infer_strain_from_patterns(self, nano_name: str, school: str, professions: str) -> Optional[int]:
        """Infer strain from nano patterns"""
        name_lower = nano_name.lower()
        
        # Weapon skill patterns
        weapon_patterns = {
            r'1h?\s*blunt.*expertise|proficiency': 16,
            r'1h?\s*blunt.*incompetence|inexperience': 17,
            r'1h?\s*edged.*expertise|proficiency': 21,
            r'1h?\s*edged.*incompetence|inexperience': 22,
            r'2h?\s*blunt.*expertise|proficiency': 23,
            r'2h?\s*blunt.*incompetence|inexperience': 24,
            r'2h?\s*edged.*expertise|proficiency': 25,
            r'2h?\s*edged.*incompetence|inexperience': 26,
            r'bow.*expertise|proficiency': 27,
            r'crossbow.*expertise|proficiency': 29,
            r'burst.*expertise|proficiency': 31,
            r'full\s*auto.*expertise|proficiency': 33,
        }
        
        for pattern, strain_id in weapon_patterns.items():
            if re.search(pattern, name_lower):
                return strain_id
        
        # School-based patterns
        if school == 'Treatment' or any(word in name_lower for word in ['heal', 'cure']):
            if 'team' in name_lower or 'group' in name_lower:
                return 5  # Team Healing
            else:
                return 951  # Single Target Healing
        
        elif school == 'Offensive' or any(word in name_lower for word in ['nuke', 'blast', 'damage']):
            return 1  # General Nuke
            
        elif any(word in name_lower for word in ['root', 'entangle']):
            return 146  # Root
            
        elif any(word in name_lower for word in ['snare', 'slow']):
            return 145  # Snare
            
        elif any(word in name_lower for word in ['mezz', 'charm', 'hypnosis']):
            return 147  # Mezz
        
        return None
    
    def _get_strain_name_by_id(self, strain_id: int) -> str:
        """Get strain name by ID from existing data"""
        for data in self.existing_csv_data.values():
            if data.get('strain_id') == strain_id:
                return data.get('strain', '')
        return f"Strain_{strain_id}"
    
    async def get_nano_requirements_by_aoid(self, nano_aoid: int) -> Dict:
        """Get casting requirements using nano AOID"""
        
        # Find the database ID for this AOID first
        id_query = "SELECT id FROM items WHERE aoid = $1;"
        id_result = await self.conn.fetchrow(id_query, nano_aoid)
        
        if not id_result:
            return {}
        
        db_id = id_result['id']
        
        query = """
        SELECT c.value1, c.value2, c.operator
        FROM criteria c
        JOIN spell_criteria sc ON c.id = sc.criterion_id
        JOIN spells s ON sc.spell_id = s.id
        JOIN spell_data_spells sds ON s.id = sds.spell_id
        JOIN spell_data sd ON sds.spell_data_id = sd.id
        WHERE sd.id = $1;
        """
        
        rows = await self.conn.fetch(query, db_id)
        
        requirements = {
            'mm': None, 'bm': None, 'pm': None, 
            'si': None, 'ts': None, 'mc': None,
            'level': None
        }
        
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
            stat_id = row['value1']
            if stat_id in skill_mapping:
                requirements[skill_mapping[stat_id]] = row['value2']
                
        return requirements
    
    async def generate_corrected_csv(self, output_path: str):
        """Generate CSV with correct AOIDs"""
        print("Generating corrected nano CSV with proper AOIDs...")
        
        # Extract all player-castable nanos
        nanos = await self.extract_all_player_nanos()
        
        results = []
        stats = {
            'total': len(nanos),
            'with_crystals': 0,
            'with_strains': 0,
            'from_existing': 0,
            'inferred': 0
        }
        
        for nano in nanos:
            nano_aoid = nano['nano_aoid']
            crystal_aoid = nano['crystal_aoid']
            
            if crystal_aoid:
                stats['with_crystals'] += 1
            
            # Get requirements
            requirements = await self.get_nano_requirements_by_aoid(nano_aoid)
            
            # Get strain information
            strain_id, method, strain_name = self.infer_strain_from_existing_data(nano_aoid)
            
            if strain_id:
                stats['with_strains'] += 1
                if method == "existing_csv_data":
                    stats['from_existing'] += 1
                else:
                    stats['inferred'] += 1
            
            # Get existing data for other fields
            existing = self.existing_csv_data.get(nano_aoid, {})
            
            result = {
                'crystal_id': crystal_aoid or 0,  # Use 0 if no crystal found
                'nano_id': nano_aoid,
                'ql': nano['ql'],
                'crystal_name': existing.get('crystal_name', f"Unknown Crystal for {nano['nano_name']}"),
                'nano_name': nano['nano_name'],
                'school': existing.get('school', self._infer_school_from_name(nano['nano_name'])),
                'strain': strain_name,
                'strain_id': strain_id or 0,
                'sub_strain': existing.get('sub_strain', ''),
                'professions': existing.get('professions', self._infer_profession_from_name(nano['nano_name'])),
                'location': existing.get('location', ''),
                'nano_cost': self._calculate_nano_cost(requirements, existing),
                'froob_friendly': 1,
                'sort_order': 1,
                'nano_deck': 0,
                'spec': '',
                'min_level': requirements.get('level', ''),
                'mm': requirements.get('mm') or existing.get('mm', ''),
                'bm': requirements.get('bm') or existing.get('bm', ''),
                'pm': requirements.get('pm') or existing.get('pm', ''),
                'si': requirements.get('si') or existing.get('si', ''),
                'ts': requirements.get('ts') or existing.get('ts', ''),
                'mc': requirements.get('mc') or existing.get('mc', ''),
                'inference_method': method,
                'in_original_csv': nano_aoid in self.existing_csv_data,
                'has_crystal_mapping': crystal_aoid is not None,
            }
            
            results.append(result)
        
        # Write CSV
        fieldnames = [
            'crystal_id', 'nano_id', 'ql', 'crystal_name', 'nano_name', 
            'school', 'strain', 'strain_id', 'sub_strain', 'professions',
            'location', 'nano_cost', 'froob_friendly', 'sort_order', 
            'nano_deck', 'spec', 'min_level', 'mm', 'bm', 'pm', 'si', 'ts', 'mc',
            'inference_method', 'in_original_csv', 'has_crystal_mapping'
        ]
        
        with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(results)
        
        self._print_corrected_report(stats, results)
        self._generate_crystal_mapping_report(results)
        
    def _infer_school_from_name(self, nano_name: str) -> str:
        """Infer school from nano name"""
        name_lower = nano_name.lower()
        
        if any(word in name_lower for word in ['heal', 'cure', 'mend', 'restoration']):
            return 'Treatment'
        elif any(word in name_lower for word in ['nuke', 'blast', 'burn', 'damage']):
            return 'Offensive'
        elif any(word in name_lower for word in ['expertise', 'proficiency', 'enhance', 'buff']):
            return 'Buffs'
        elif any(word in name_lower for word in ['incompetence', 'inexperience', 'weaken', 'debuff']):
            return 'Debuffs'
        elif any(word in name_lower for word in ['creation:', 'summon', 'manifest']):
            return 'Creation'
        elif any(word in name_lower for word in ['root', 'snare', 'mezz', 'charm', 'calm']):
            return 'Crowd Control'
        else:
            return 'Unknown'
    
    def _infer_profession_from_name(self, nano_name: str) -> str:
        """Infer profession from nano name"""
        name_lower = nano_name.lower()
        
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
    
    def _calculate_nano_cost(self, requirements: Dict, existing: Dict) -> int:
        """Calculate nano cost from requirements or existing data"""
        # Use existing nano cost if available
        if existing and existing.get('nano_cost'):
            try:
                return int(existing['nano_cost'])
            except (ValueError, TypeError):
                pass
        
        # Calculate from skill requirements
        skills = ['mm', 'bm', 'pm', 'si', 'ts', 'mc']
        max_req = 0
        
        for skill in skills:
            # Check requirements first, then existing data
            value = requirements.get(skill) or existing.get(skill)
            if value and isinstance(value, (int, float)):
                max_req = max(max_req, int(value))
        
        return max(int(max_req * 0.7), 10) if max_req > 0 else 40
    
    def _print_corrected_report(self, stats: Dict, results: List[Dict]):
        """Print report for corrected analysis"""
        print(f"\n{'='*70}")
        print("CORRECTED NANO ANALYSIS WITH PROPER AOIDs")
        print(f"{'='*70}")
        
        total = stats['total']
        
        print(f"📊 Total player-castable nanos in database: {total:,}")
        print(f"🔗 Nanos with crystal mappings: {stats['with_crystals']:,} ({stats['with_crystals']/total*100:.1f}%)")
        print(f"🏷️  Nanos with strain assignments: {stats['with_strains']:,} ({stats['with_strains']/total*100:.1f}%)")
        print(f"📚 From existing CSV: {stats['from_existing']:,}")
        print(f"🧠 Inferred strains: {stats['inferred']:,}")
        
        # Analyze coverage by data source
        in_csv = sum(1 for r in results if r['in_original_csv'])
        new_nanos = total - in_csv
        
        print(f"\n📈 Data source breakdown:")
        print(f"  Nanos in original CSV: {in_csv:,}")
        print(f"  New nanos from database: {new_nanos:,}")
        
        # Crystal mapping success
        print(f"\n🔍 Crystal mapping status:")
        no_crystal = sum(1 for r in results if not r['has_crystal_mapping'])
        print(f"  Missing crystal mappings: {no_crystal:,}")
        
    def _generate_crystal_mapping_report(self, results: List[Dict]):
        """Generate report of nanos missing crystal mappings"""
        missing_crystals = [r for r in results if not r['has_crystal_mapping']]
        
        if missing_crystals:
            print(f"\n📋 Generating crystal mapping report for {len(missing_crystals)} nanos...")
            
            with open('/home/quigley/projects/Tinkertools/backend/missing_crystals_report.csv', 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=['nano_id', 'nano_name', 'professions', 'school'])
                writer.writeheader()
                
                for nano in sorted(missing_crystals, key=lambda x: x['nano_name']):
                    writer.writerow({
                        'nano_id': nano['nano_id'],
                        'nano_name': nano['nano_name'],
                        'professions': nano['professions'],
                        'school': nano['school']
                    })
            
            print("📁 Missing crystals: /home/quigley/projects/Tinkertools/backend/missing_crystals_report.csv")


async def main():
    analyzer = CorrectedNanoAnalyzer()
    
    try:
        await analyzer.connect_db()
        
        # Load existing CSV for reference and mappings
        analyzer.load_existing_csv('/home/quigley/projects/Tinkertools/backend/nanos.csv')
        
        # Generate corrected CSV with proper AOIDs
        await analyzer.generate_corrected_csv('/home/quigley/projects/Tinkertools/backend/corrected_nanos_aoid.csv')
        
        print(f"\n🎉 Corrected nano CSV generated!")
        print(f"📁 Output: /home/quigley/projects/Tinkertools/backend/corrected_nanos_aoid.csv")
        
    finally:
        await analyzer.close_db()


if __name__ == "__main__":
    asyncio.run(main())