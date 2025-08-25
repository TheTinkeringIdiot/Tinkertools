#!/usr/bin/env python3
"""
Improved Nano Strain Analyzer

Enhanced version that uses multiple data sources to infer strain assignments:
1. Spell effect analysis
2. Crystal name pattern matching  
3. Existing CSV strain patterns
4. Profession-based categorization
"""

import asyncio
import csv
import json
import re
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

import asyncpg
import pandas as pd


DATABASE_URL = "postgresql://aodbuser:password@localhost:5432/tinkertools"


class ImprovedNanoAnalyzer:
    def __init__(self):
        self.conn = None
        self.existing_csv_data = {}
        self.strain_name_to_id = {}
        self.profession_strain_patterns = defaultdict(list)
        
    async def connect_db(self):
        """Connect to the database"""
        self.conn = await asyncpg.connect(DATABASE_URL)
        
    async def close_db(self):
        """Close database connection"""
        if self.conn:
            await self.conn.close()
    
    def load_existing_csv(self, csv_path: str):
        """Load existing CSV data and build pattern maps"""
        print(f"Loading existing CSV data from {csv_path}...")
        df = pd.read_csv(csv_path)
        
        # Create lookup maps
        for _, row in df.iterrows():
            nano_id = row['nano_id']
            crystal_id = row['crystal_id']
            strain_id = row['strain_id'] if pd.notna(row['strain_id']) and row['strain_id'] != 0 else None
            strain_name = row['strain'] if pd.notna(row['strain']) else ''
            
            # Store nano data
            self.existing_csv_data[nano_id] = {
                'crystal_id': crystal_id,
                'strain': strain_name,
                'strain_id': strain_id,
                'school': row['school'],
                'professions': row['professions'],
                'location': row['location'],
                'sub_strain': row['sub_strain'],
            }
            
            # Build strain name to ID mapping
            if strain_id and strain_name:
                self.strain_name_to_id[strain_name] = strain_id
                
            # Build profession-strain patterns
            if strain_id and row['professions']:
                self.profession_strain_patterns[row['professions']].append({
                    'strain_id': strain_id,
                    'strain_name': strain_name,
                    'school': row['school'],
                    'crystal_name': row['crystal_name']
                })
        
        print(f"Loaded {len(df)} existing nano entries")
        print(f"Found {len(self.strain_name_to_id)} strain name->ID mappings")
        print(f"Found profession patterns for {len(self.profession_strain_patterns)} professions")
        
    def analyze_strain_patterns(self):
        """Analyze patterns in existing strain assignments"""
        print("\nStrain pattern analysis:")
        
        # Most common strains
        strain_counts = defaultdict(int)
        for data in self.existing_csv_data.values():
            if data.get('strain_id'):
                strain_counts[data['strain_id']] += 1
        
        print("Top strain IDs in existing data:")
        for strain_id, count in sorted(strain_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
            strain_name = next((data['strain'] for data in self.existing_csv_data.values() 
                              if data.get('strain_id') == strain_id), 'Unknown')
            print(f"  {strain_id}: {strain_name} ({count} nanos)")
            
        # Profession patterns
        print(f"\nProfession patterns:")
        for prof, patterns in list(self.profession_strain_patterns.items())[:5]:
            strain_ids = [p['strain_id'] for p in patterns]
            unique_strains = len(set(strain_ids))
            print(f"  {prof}: {len(patterns)} nanos, {unique_strains} unique strains")
    
    async def extract_all_player_nanos(self) -> List[Dict]:
        """Extract all player-castable nanos with their spell effects"""
        print("\nExtracting player-castable nanos from database...")
        
        query = """
        SELECT DISTINCT 
            i.id as crystal_id,
            i.name as crystal_name,
            i.ql,
            s.id as spell_id,
            s.spell_params::text as spell_params_text
        FROM items i
        JOIN actions a ON i.id = a.item_id
        JOIN spell_data sd ON i.id = sd.id
        JOIN spell_data_spells sds ON sd.id = sds.spell_data_id  
        JOIN spells s ON sds.spell_id = s.id
        WHERE i.is_nano = true
        ORDER BY i.id, s.id;
        """
        
        rows = await self.conn.fetch(query)
        
        # Group by crystal_id to handle multiple spells per crystal
        crystals = {}
        for row in rows:
            crystal_id = row['crystal_id']
            
            try:
                spell_params = json.loads(row['spell_params_text']) if row['spell_params_text'] else {}
            except (json.JSONDecodeError, TypeError):
                spell_params = {}
            
            if crystal_id not in crystals:
                crystals[crystal_id] = {
                    'crystal_id': crystal_id,
                    'crystal_name': row['crystal_name'],
                    'ql': row['ql'],
                    'spells': []
                }
            
            crystals[crystal_id]['spells'].append({
                'spell_id': row['spell_id'],
                'spell_params': spell_params
            })
        
        print(f"Found {len(crystals)} unique player-castable nano crystals")
        print(f"Total spell effects: {len(rows)}")
        
        return list(crystals.values())
    
    def infer_strain_comprehensive(self, crystal: Dict) -> Tuple[Optional[int], str, str]:
        """Comprehensive strain inference using multiple methods"""
        crystal_id = crystal['crystal_id']
        crystal_name = crystal['crystal_name']
        spells = crystal['spells']
        
        # Method 1: Check existing CSV data by crystal name exact match
        existing_by_name = None
        for data in self.existing_csv_data.values():
            if data.get('crystal_id') == crystal_id:
                if data.get('strain_id'):
                    return data['strain_id'], "existing_csv_exact_match", data['strain']
                existing_by_name = data
                break
        
        # Method 2: Pattern match crystal name
        strain_id, method = self._infer_from_crystal_name(crystal_name)
        if strain_id:
            strain_name = self._get_strain_name_by_id(strain_id)
            return strain_id, method, strain_name
        
        # Method 3: Analyze spell effects
        for spell in spells:
            strain_id, method = self._infer_from_spell_effects(spell['spell_params'], crystal_name)
            if strain_id:
                strain_name = self._get_strain_name_by_id(strain_id)
                return strain_id, method, strain_name
        
        # Method 4: Use existing profession data if available
        if existing_by_name:
            profession = existing_by_name.get('professions', '')
            school = existing_by_name.get('school', '')
            strain_id = self._infer_from_profession_school(profession, school, crystal_name)
            if strain_id:
                strain_name = self._get_strain_name_by_id(strain_id)
                return strain_id, "profession_school_pattern", strain_name
        
        return None, "no_inference_possible", ""
    
    def _infer_from_crystal_name(self, crystal_name: str) -> Tuple[Optional[int], str]:
        """Infer strain from crystal name patterns"""
        name_lower = crystal_name.lower()
        
        # Weapon skill patterns
        weapon_patterns = {
            '1h blunt': (16, 17),   # buff, debuff
            '1h edged': (21, 22),
            '2h blunt': (23, 24), 
            '2h edged': (25, 26),
            'bow': (27, 28),
            'crossbow': (29, 30),
            'burst': (31, 32),
            'full auto': (33, 34),
            'assault rifle': (35, 36),
            'shotgun': (37, 38),
            'pistol': (39, 40),
            'rifle': (41, 42),
        }
        
        for weapon, (buff_strain, debuff_strain) in weapon_patterns.items():
            if weapon in name_lower:
                if any(word in name_lower for word in ['incompetence', 'inexperience', 'weakness']):
                    return debuff_strain, "crystal_name_weapon_debuff"
                elif any(word in name_lower for word in ['expertise', 'proficiency', 'mastery']):
                    return buff_strain, "crystal_name_weapon_buff"
        
        # Healing patterns
        if any(word in name_lower for word in ['heal', 'cure', 'mend', 'restoration']):
            if any(word in name_lower for word in ['team', 'group', 'mass']):
                return 5, "crystal_name_team_healing"  
            else:
                return 4, "crystal_name_target_healing"
        
        # Damage patterns
        if any(word in name_lower for word in ['nuke', 'blast', 'burn', 'freeze', 'shock']):
            if any(word in name_lower for word in ['ice', 'cold', 'frost']):
                return 2, "crystal_name_ice_nuke"
            elif any(word in name_lower for word in ['fire', 'flame', 'burn']):
                return 3, "crystal_name_fire_nuke"  
            else:
                return 1, "crystal_name_general_nuke"
        
        # Pet/Creation patterns
        if any(word in name_lower for word in ['creation:', 'summon', 'manifest']):
            return 0, "crystal_name_creation"  # Creation school
            
        return None, "no_crystal_name_pattern"
    
    def _infer_from_spell_effects(self, spell_params: Dict, crystal_name: str) -> Tuple[Optional[int], str]:
        """Infer strain from spell effect parameters"""
        if not spell_params:
            return None, "no_spell_params"
            
        # Check modified stat
        stat_modified = spell_params.get('Stat')
        description = spell_params.get('SpellDescription', '') or ''
        
        if stat_modified:
            try:
                stat_id = int(stat_modified)
                
                # Map specific stats to strains based on existing patterns
                stat_to_strain = {
                    # Weapon skills -> weapon buff strains
                    123: 16,  # 1H Blunt -> 1H Blunt Buffs
                    124: 21,  # 1H Edged -> 1H Edged Buffs
                    125: 23,  # 2H Blunt -> 2H Blunt Buffs
                    126: 25,  # 2H Edged -> 2H Edged Buffs
                    
                    # Trade skills
                    127: 27,  # Bow
                    129: 29,  # Fling Shot
                    131: 31,  # Burst
                    132: 33,  # Full Auto
                    
                    # Nano skills - map to appropriate strains
                    160: 160,  # Matter Metamorphosis
                    161: 161,  # Biological Metamorphosis
                    162: 162,  # Psychological Modifications
                    163: 163,  # Sensory Improvement
                    164: 164,  # Time and Space
                    165: 165,  # Matter Creation
                }
                
                if stat_id in stat_to_strain:
                    # Check if it's a debuff based on crystal name
                    if any(word in crystal_name.lower() for word in ['incompetence', 'inexperience']):
                        # For weapon debuffs, add 1 to the buff strain
                        if stat_id in [123, 124, 125, 126]:
                            return stat_to_strain[stat_id] + 1, "spell_effect_weapon_debuff"
                    else:
                        return stat_to_strain[stat_id], "spell_effect_stat_modification"
                        
            except (ValueError, TypeError):
                pass
        
        # Pattern match spell descriptions
        if 'heal' in description.lower():
            return 4, "spell_description_healing"
        elif any(word in description.lower() for word in ['damage', 'harm']):
            return 1, "spell_description_damage"
        elif 'summon' in description.lower():
            return 6, "spell_description_summon"
            
        return None, "no_spell_effect_pattern"
    
    def _infer_from_profession_school(self, profession: str, school: str, crystal_name: str) -> Optional[int]:
        """Infer strain based on profession and school combination"""
        if not profession or not school:
            return None
            
        # Look for similar patterns in existing data
        for patterns in self.profession_strain_patterns[profession]:
            if patterns['school'] == school:
                # Check if crystal names are similar
                if self._names_similar(crystal_name, patterns['crystal_name']):
                    return patterns['strain_id']
        
        return None
    
    def _names_similar(self, name1: str, name2: str) -> bool:
        """Check if two nano names are similar"""
        # Simple similarity based on common words
        words1 = set(re.findall(r'\w+', name1.lower()))
        words2 = set(re.findall(r'\w+', name2.lower()))
        
        if not words1 or not words2:
            return False
            
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        # Jaccard similarity > 0.3
        return len(intersection) / len(union) > 0.3
    
    def _get_strain_name_by_id(self, strain_id: int) -> str:
        """Get strain name by ID from existing data"""
        for data in self.existing_csv_data.values():
            if data.get('strain_id') == strain_id:
                return data.get('strain', '')
        return f"Unknown Strain {strain_id}"
    
    async def generate_enhanced_csv(self, output_path: str):
        """Generate enhanced CSV with improved strain inference"""
        print("Generating enhanced nano CSV with improved inference...")
        
        # Extract all player-castable nanos
        crystals = await self.extract_all_player_nanos()
        
        results = []
        stats = {
            'total': len(crystals),
            'with_strains': 0,
            'inference_methods': defaultdict(int)
        }
        
        for crystal in crystals:
            crystal_id = crystal['crystal_id']
            
            # Get casting requirements
            requirements = await self.get_nano_requirements(crystal_id)
            
            # Infer strain
            strain_id, method, strain_name = self.infer_strain_comprehensive(crystal)
            
            if strain_id:
                stats['with_strains'] += 1
            stats['inference_methods'][method] += 1
            
            # Get existing data if available
            existing = self.existing_csv_data.get(crystal['spells'][0]['spell_id'], {})
            
            # Build enhanced result
            result = {
                'crystal_id': crystal_id,
                'nano_id': crystal['spells'][0]['spell_id'],  # Primary spell ID
                'ql': crystal['ql'],
                'crystal_name': crystal['crystal_name'],
                'nano_name': existing.get('nano_name', self._extract_nano_name(crystal['crystal_name'])),
                'school': existing.get('school', self._infer_school_from_effects(crystal['spells'])),
                'strain': strain_name,
                'strain_id': strain_id or 0,
                'sub_strain': existing.get('sub_strain', ''),
                'professions': existing.get('professions', self._infer_profession_from_name(crystal['crystal_name'])),
                'location': existing.get('location', ''),
                'nano_cost': self._calculate_nano_cost(requirements),
                'froob_friendly': 1,
                'sort_order': 1,
                'nano_deck': 0,
                'spec': '',
                'min_level': requirements.get('level', ''),
                'mm': requirements.get('mm', ''),
                'bm': requirements.get('bm', ''),
                'pm': requirements.get('pm', ''),
                'si': requirements.get('si', ''),
                'ts': requirements.get('ts', ''),
                'mc': requirements.get('mc', ''),
                'inference_method': method,
                'num_spells': len(crystal['spells']),
                'spell_effects': '; '.join([(sp['spell_params'].get('SpellDescription', '') or '')[:50] for sp in crystal['spells'][:3]])
            }
            
            results.append(result)
        
        # Write enhanced CSV
        fieldnames = [
            'crystal_id', 'nano_id', 'ql', 'crystal_name', 'nano_name', 
            'school', 'strain', 'strain_id', 'sub_strain', 'professions',
            'location', 'nano_cost', 'froob_friendly', 'sort_order', 
            'nano_deck', 'spec', 'min_level', 'mm', 'bm', 'pm', 'si', 'ts', 'mc',
            'inference_method', 'num_spells', 'spell_effects'
        ]
        
        with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(results)
        
        self._print_enhancement_report(stats, results)
        
    def _extract_nano_name(self, crystal_name: str) -> str:
        """Extract nano name from crystal name"""
        # Remove common prefixes
        name = crystal_name
        
        # Remove "Nano Crystal (" and ")"
        if name.startswith('Nano Crystal (') and name.endswith(')'):
            name = name[14:-1]
        elif name.startswith('NanoCrystal (') and name.endswith(')'):
            name = name[13:-1]
        
        # Remove profession prefixes
        patterns = [
            r'^[A-Za-z\s]+:\s*',  # "Doctor: " prefix
            r'^[A-Za-z\s]+\s*-\s*',  # "Startup Crystal - " prefix
        ]
        
        for pattern in patterns:
            name = re.sub(pattern, '', name)
        
        return name.strip()
    
    def _infer_school_from_effects(self, spells: List[Dict]) -> str:
        """Infer school from spell effects"""
        descriptions = []
        for spell in spells:
            desc = spell['spell_params'].get('SpellDescription', '') or ''
            descriptions.append(desc.lower())
        
        combined = ' '.join(descriptions)
        
        if any(word in combined for word in ['heal', 'cure', 'restoration']):
            return 'Treatment'
        elif any(word in combined for word in ['damage', 'harm', 'nuke']):
            return 'Offensive'
        elif any(word in combined for word in ['modify', 'enhance', 'improve']):
            return 'Buffs'
        elif any(word in combined for word in ['reduce', 'weaken']):
            return 'Debuffs'
        elif any(word in combined for word in ['summon', 'creation', 'manifest']):
            return 'Creation'
        else:
            return 'Unknown'
    
    def _infer_profession_from_name(self, crystal_name: str) -> str:
        """Infer profession from crystal name"""
        name_lower = crystal_name.lower()
        
        profession_keywords = {
            'doctor': 'Doctor',
            'trader': 'Trader', 
            'nano-technician': 'Nano-Technician',
            'nanotechnician': 'Nano-Technician',
            'meta-physicist': 'Meta-Physicist',
            'metaphysicist': 'Meta-Physicist',
            'bureaucrat': 'Bureaucrat',
            'enforcer': 'Enforcer',
            'soldier': 'Soldier',
            'martial artist': 'Martial Artist',
            'engineer': 'Engineer',
            'fixer': 'Fixer',
            'adventurer': 'Adventurer',
            'keeper': 'Keeper',
            'shade': 'Shade',
        }
        
        # Check for profession in crystal name
        for keyword, profession in profession_keywords.items():
            if keyword in name_lower:
                return profession
        
        # Check for startup crystals
        if 'startup crystal' in name_lower:
            # Extract profession from startup crystal name
            match = re.search(r'(\w+):\s*startup crystal', name_lower)
            if match:
                prof_name = match.group(1)
                return profession_keywords.get(prof_name, prof_name.title())
                
        return 'General'
    
    async def get_nano_requirements(self, crystal_id: int) -> Dict:
        """Get casting requirements for a nano crystal"""
        query = """
        SELECT c.value1, c.value2, c.operator
        FROM criteria c
        JOIN spell_criteria sc ON c.id = sc.criterion_id
        JOIN spells s ON sc.spell_id = s.id
        JOIN spell_data_spells sds ON s.id = sds.spell_id
        JOIN spell_data sd ON sds.spell_data_id = sd.id
        WHERE sd.id = $1;
        """
        
        rows = await self.conn.fetch(query, crystal_id)
        
        requirements = {
            'mm': None, 'bm': None, 'pm': None, 
            'si': None, 'ts': None, 'mc': None,
            'level': None
        }
        
        # Map stat IDs to skill names
        skill_mapping = {
            160: 'mm',  # Matter Metamorphosis
            161: 'bm',  # Biological Metamorphosis  
            162: 'pm',  # Psychological Modifications
            163: 'si',  # Sensory Improvement
            164: 'ts',  # Time and Space
            165: 'mc',  # Matter Creation
            54: 'level', # Level requirement
        }
        
        for row in rows:
            stat_id = row['value1']
            if stat_id in skill_mapping:
                requirements[skill_mapping[stat_id]] = row['value2']
                
        return requirements
    
    def _calculate_nano_cost(self, requirements: Dict) -> int:
        """Calculate nano cost based on requirements"""
        # Get highest skill requirement
        skills = ['mm', 'bm', 'pm', 'si', 'ts', 'mc']
        max_skill = 0
        
        for skill in skills:
            value = requirements.get(skill)
            if value and isinstance(value, (int, float)):
                max_skill = max(max_skill, int(value))
        
        # Nano cost formula approximation
        if max_skill > 0:
            return max(int(max_skill * 0.7), 10)
        else:
            return 40  # Default for unknown
    
    def _print_enhancement_report(self, stats: Dict, results: List[Dict]):
        """Print comprehensive analysis report"""
        print(f"\n{'='*60}")
        print("ENHANCED NANO STRAIN ANALYSIS REPORT")
        print(f"{'='*60}")
        
        total = stats['total']
        with_strains = stats['with_strains']
        coverage = (with_strains / total * 100) if total > 0 else 0
        
        print(f"Total player-castable nano crystals: {total}")
        print(f"Crystals with strain assignments: {with_strains}")
        print(f"Crystals missing strains: {total - with_strains}")
        print(f"Coverage: {coverage:.1f}%")
        
        print(f"\nInference methods:")
        for method, count in sorted(stats['inference_methods'].items(), key=lambda x: x[1], reverse=True):
            percentage = (count / total * 100) if total > 0 else 0
            print(f"  {method}: {count} ({percentage:.1f}%)")
        
        # Strain distribution
        strain_counts = defaultdict(int)
        for result in results:
            if result['strain_id']:
                strain_counts[result['strain_id']] += 1
        
        print(f"\nTop strain assignments:")
        for strain_id, count in sorted(strain_counts.items(), key=lambda x: x[1], reverse=True)[:15]:
            strain_name = next((r['strain'] for r in results if r['strain_id'] == strain_id), 'Unknown')
            print(f"  {strain_id}: {strain_name} ({count} nanos)")
    
    async def extract_all_player_nanos(self) -> List[Dict]:
        """Extract all player-castable nanos"""
        print("Extracting all player-castable nanos from database...")
        
        query = """
        SELECT DISTINCT 
            i.id as crystal_id,
            i.name as crystal_name,
            i.ql,
            s.id as spell_id,
            s.spell_params::text as spell_params_text
        FROM items i
        JOIN actions a ON i.id = a.item_id
        JOIN spell_data sd ON i.id = sd.id
        JOIN spell_data_spells sds ON sd.id = sds.spell_data_id  
        JOIN spells s ON sds.spell_id = s.id
        WHERE i.is_nano = true
        ORDER BY i.id, s.id;
        """
        
        rows = await self.conn.fetch(query)
        
        # Group by crystal_id
        crystals = {}
        for row in rows:
            crystal_id = row['crystal_id']
            
            try:
                spell_params = json.loads(row['spell_params_text']) if row['spell_params_text'] else {}
            except (json.JSONDecodeError, TypeError):
                spell_params = {}
            
            if crystal_id not in crystals:
                crystals[crystal_id] = {
                    'crystal_id': crystal_id,
                    'crystal_name': row['crystal_name'],
                    'ql': row['ql'],
                    'spells': []
                }
            
            crystals[crystal_id]['spells'].append({
                'spell_id': row['spell_id'],
                'spell_params': spell_params
            })
        
        print(f"Found {len(crystals)} unique player-castable nano crystals")
        return list(crystals.values())


async def main():
    analyzer = ImprovedNanoAnalyzer()
    
    try:
        await analyzer.connect_db()
        
        # Load and analyze existing CSV data
        analyzer.load_existing_csv('/home/quigley/projects/Tinkertools/backend/nanos.csv')
        analyzer.analyze_strain_patterns()
        
        # Generate enhanced CSV
        await analyzer.generate_enhanced_csv('/home/quigley/projects/Tinkertools/backend/enhanced_nanos.csv')
        
        print(f"\n✅ Enhanced nano CSV generated!")
        print(f"📁 Output: /home/quigley/projects/Tinkertools/backend/enhanced_nanos.csv")
        
    finally:
        await analyzer.close_db()


if __name__ == "__main__":
    asyncio.run(main())