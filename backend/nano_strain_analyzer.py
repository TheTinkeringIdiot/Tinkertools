#!/usr/bin/env python3
"""
Nano Strain Analyzer

This script analyzes the nano program data to:
1. Extract all player-castable nanos from the database
2. Infer missing strain IDs based on spell effects
3. Generate a comprehensive CSV with all nano data
"""

import asyncio
import csv
import json
import re
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

import asyncpg
import pandas as pd


# Database connection
DATABASE_URL = "postgresql://aodbuser:password@localhost:5432/tinkertools"

# Known strain mappings from existing CSV data for inference
STRAIN_PATTERNS = {
    # Weapon skills
    123: "1H Blunt",  # 1H Blunt skill
    124: "1H Edged",  # 1H Edged skill
    125: "2H Blunt",  # 2H Blunt skill
    126: "2H Edged",  # 2H Edged skill
    127: "Bow",       # Bow skill
    128: "Crossbow",  # Crossbow skill
    129: "Fling Shot", # Fling Shot skill
    130: "Aimed Shot", # Aimed Shot skill
    131: "Burst",     # Burst skill
    132: "Full Auto", # Full Auto skill
    133: "Assault Rifle", # Assault Rifle skill
    134: "SMG",       # SMG skill
    135: "Shotgun",   # Shotgun skill
    136: "Pistol",    # Pistol skill
    137: "Rifle",     # Rifle skill
    138: "MG/Heavy Weapons", # MG/Heavy Weapons skill
    139: "Grenade",   # Grenade skill
    140: "Heavy Weapons", # Heavy Weapons skill
    
    # Nano skills
    160: "Matter Metamorphosis", # MM
    161: "Biological Metamorphosis", # BM
    162: "Psychological Modifications", # PM
    163: "Sensory Improvement", # SI
    164: "Time and Space", # TS
    165: "Matter Creation", # MC
    
    # Other common stats
    16: "Strength",
    17: "Agility", 
    18: "Stamina",
    19: "Intelligence",
    20: "Sense",
    21: "Psychic",
}


class NanoStrainAnalyzer:
    def __init__(self):
        self.conn = None
        self.existing_csv_data = {}
        self.strain_inference_rules = {}
        
    async def connect_db(self):
        """Connect to the database"""
        self.conn = await asyncpg.connect(DATABASE_URL)
        
    async def close_db(self):
        """Close database connection"""
        if self.conn:
            await self.conn.close()
    
    def load_existing_csv(self, csv_path: str):
        """Load existing CSV data for reference"""
        print(f"Loading existing CSV data from {csv_path}...")
        df = pd.read_csv(csv_path)
        
        # Create lookup by nano_id and crystal_id
        for _, row in df.iterrows():
            nano_id = row['nano_id']
            crystal_id = row['crystal_id']
            
            self.existing_csv_data[nano_id] = {
                'crystal_id': crystal_id,
                'strain': row['strain'],
                'strain_id': row['strain_id'] if pd.notna(row['strain_id']) and row['strain_id'] != 0 else None,
                'school': row['school'],
                'professions': row['professions'],
                'location': row['location'],
                'sub_strain': row['sub_strain'],
            }
            
            # Also index by crystal_id for reverse lookup
            self.existing_csv_data[f"crystal_{crystal_id}"] = self.existing_csv_data[nano_id]
        
        print(f"Loaded {len(df)} existing nano entries")
        
    def build_strain_inference_rules(self):
        """Build inference rules from existing CSV data"""
        print("Building strain inference rules...")
        
        # Group by strain patterns
        strain_patterns = defaultdict(list)
        effect_patterns = defaultdict(list)
        
        for nano_id, data in self.existing_csv_data.items():
            if isinstance(nano_id, str):  # Skip crystal_ entries
                continue
                
            strain_id = data.get('strain_id')
            if strain_id:
                strain_patterns[strain_id].append({
                    'nano_id': nano_id,
                    'strain': data['strain'],
                    'school': data['school'],
                    'professions': data['professions']
                })
        
        self.strain_inference_rules = strain_patterns
        print(f"Created inference rules for {len(strain_patterns)} strain IDs")
    
    async def extract_player_castable_nanos(self) -> List[Dict]:
        """Extract all player-castable nanos (those with actions)"""
        print("Extracting all player-castable nanos from database...")
        
        query = """
        SELECT DISTINCT 
            i.id as crystal_id,
            i.name as crystal_name,
            i.ql,
            sd.id as spell_data_id,
            s.id as spell_id,
            s.spell_params::text as spell_params_text
        FROM items i
        JOIN actions a ON i.id = a.item_id
        JOIN spell_data sd ON i.id = sd.id
        JOIN spell_data_spells sds ON sd.id = sds.spell_data_id  
        JOIN spells s ON sds.spell_id = s.id
        WHERE i.is_nano = true
        ORDER BY i.id;
        """
        
        rows = await self.conn.fetch(query)
        
        nanos = []
        for row in rows:
            try:
                spell_params = json.loads(row['spell_params_text']) if row['spell_params_text'] else {}
            except (json.JSONDecodeError, TypeError):
                spell_params = {}
                
            nano_data = {
                'crystal_id': row['crystal_id'],
                'crystal_name': row['crystal_name'],
                'ql': row['ql'],
                'spell_data_id': row['spell_data_id'],
                'spell_id': row['spell_id'],
                'spell_params': spell_params
            }
            nanos.append(nano_data)
            
        print(f"Found {len(nanos)} player-castable nano spells")
        return nanos
    
    def infer_strain_from_spell_effects(self, spell_params: Dict, crystal_name: str, professions: str = "") -> Tuple[Optional[int], str]:
        """Infer strain ID from spell effects"""
        
        # Extract key information
        stat_modified = spell_params.get('Stat')
        description = spell_params.get('SpellDescription', '') or ''
        crystal_name = crystal_name or ''
        professions = professions or ''
        
        # Check for weapon skill modifications
        if stat_modified:
            try:
                stat_id = int(stat_modified)
                if stat_id in [123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140]:
                    # Weapon skill buff/debuff
                    if "Incompetence" in crystal_name or "Inexperience" in crystal_name:
                        return self._get_weapon_debuff_strain(stat_id), "weapon_debuff_pattern"
                    else:
                        return self._get_weapon_buff_strain(stat_id), "weapon_buff_pattern"
            except (ValueError, TypeError):
                pass
        
        # Check for healing patterns
        if any(word in description.lower() for word in ['heal', 'health', 'restoration']):
            if 'team' in description.lower() or 'group' in description.lower():
                return 5, "team_healing_pattern"  # Team Healing
            else:
                return 4, "target_healing_pattern"  # Target Healing
        
        # Check for damage patterns  
        if any(word in description.lower() for word in ['damage', 'nuke', 'blast']):
            if any(word in professions.lower() for word in ['nano-technician', 'nanotechnician']):
                return 1, "general_nuke_pattern"  # General Nuke
            
        # Check for pet patterns
        if any(word in description.lower() for word in ['summon', 'pet', 'creation']):
            if 'attack' in description.lower():
                return 6, "attack_pet_pattern"  # Attack Pet
            else:
                return 7, "mezz_pet_pattern"   # Mezz Pet
        
        # Check for buff patterns by profession
        if any(word in professions.lower() for word in ['keeper', 'enforcer', 'soldier']):
            if any(word in description.lower() for word in ['weapon', 'damage', 'accuracy']):
                return 8, "profession_combat_buff"
        
        return None, "no_pattern_matched"
    
    def _get_weapon_buff_strain(self, stat_id: int) -> Optional[int]:
        """Map weapon skill stat to buff strain ID"""
        weapon_buff_strains = {
            123: 16,  # 1H Blunt Buffs
            124: 21,  # 1H Edged Buffs  
            125: 23,  # 2H Blunt Buffs
            126: 25,  # 2H Edged Buffs
            127: 27,  # Bow Buffs
            128: 29,  # Crossbow Buffs
            131: 31,  # Burst Buffs
            132: 33,  # Full Auto Buffs
        }
        return weapon_buff_strains.get(stat_id)
    
    def _get_weapon_debuff_strain(self, stat_id: int) -> Optional[int]:
        """Map weapon skill stat to debuff strain ID"""
        weapon_debuff_strains = {
            123: 17,  # 1H Blunt Debuffs
            124: 22,  # 1H Edged Debuffs
            125: 24,  # 2H Blunt Debuffs
            126: 26,  # 2H Edged Debuffs
            127: 28,  # Bow Debuffs
            128: 30,  # Crossbow Debuffs
        }
        return weapon_debuff_strains.get(stat_id)
    
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
            'si': None, 'ts': None, 'mc': None
        }
        
        # Map stat IDs to skill names
        skill_mapping = {
            160: 'mm',  # Matter Metamorphosis
            161: 'bm',  # Biological Metamorphosis  
            162: 'pm',  # Psychological Modifications
            163: 'si',  # Sensory Improvement
            164: 'ts',  # Time and Space
            165: 'mc',  # Matter Creation
        }
        
        for row in rows:
            stat_id = row['value1']
            if stat_id in skill_mapping:
                requirements[skill_mapping[stat_id]] = row['value2']
                
        return requirements
    
    async def generate_comprehensive_csv(self, output_path: str):
        """Generate the comprehensive nano CSV"""
        print("Generating comprehensive nano CSV...")
        
        # Get all player-castable nanos
        nanos = await self.extract_player_castable_nanos()
        
        # Process each nano
        results = []
        processed_crystals = set()
        
        for nano in nanos:
            crystal_id = nano['crystal_id']
            
            # Skip duplicates (same crystal might have multiple spells)
            if crystal_id in processed_crystals:
                continue
            processed_crystals.add(crystal_id)
            
            # Get requirements
            requirements = await self.get_nano_requirements(crystal_id)
            
            # Check if we have existing data
            existing_data = self.existing_csv_data.get(crystal_id, {})
            
            # Infer strain if missing
            strain_id = existing_data.get('strain_id')
            inference_method = "existing_data"
            
            if not strain_id:
                # Try to find by spell_id in existing data
                for existing_nano_id, data in self.existing_csv_data.items():
                    if isinstance(existing_nano_id, int) and data.get('crystal_id') == crystal_id:
                        strain_id = data.get('strain_id')
                        inference_method = "crystal_id_match"
                        break
                
                if not strain_id:
                    # Infer from spell effects
                    professions = existing_data.get('professions', '')
                    strain_id, inference_method = self.infer_strain_from_spell_effects(
                        nano['spell_params'], 
                        nano['crystal_name'],
                        professions
                    )
            
            # Build result row
            result = {
                'crystal_id': crystal_id,
                'nano_id': nano['spell_id'],  # Use actual spell ID as nano ID
                'ql': nano['ql'],
                'crystal_name': nano['crystal_name'],
                'nano_name': existing_data.get('nano_name', nano['crystal_name']),
                'school': existing_data.get('school', self._infer_school_from_name(nano['crystal_name'])),
                'strain': existing_data.get('strain', ''),
                'strain_id': strain_id or 0,
                'sub_strain': existing_data.get('sub_strain', ''),
                'professions': existing_data.get('professions', self._infer_profession_from_name(nano['crystal_name'])),
                'location': existing_data.get('location', ''),
                'nano_cost': self._calculate_nano_cost(requirements),
                'froob_friendly': 1,  # Default to froob friendly
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
                'inference_method': inference_method,
                'spell_description': nano['spell_params'].get('SpellDescription', ''),
            }
            
            results.append(result)
        
        # Write to CSV
        print(f"Writing {len(results)} nanos to {output_path}")
        
        fieldnames = [
            'crystal_id', 'nano_id', 'ql', 'crystal_name', 'nano_name', 
            'school', 'strain', 'strain_id', 'sub_strain', 'professions',
            'location', 'nano_cost', 'froob_friendly', 'sort_order', 
            'nano_deck', 'spec', 'min_level', 'mm', 'bm', 'pm', 'si', 'ts', 'mc',
            'inference_method', 'spell_description'
        ]
        
        with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(results)
            
        # Generate analysis report
        self._generate_analysis_report(results)
        
    def _infer_school_from_name(self, name: str) -> str:
        """Infer school from crystal name"""
        name_lower = name.lower()
        
        if any(word in name_lower for word in ['heal', 'cure', 'restoration']):
            return 'Treatment'
        elif any(word in name_lower for word in ['damage', 'nuke', 'blast', 'fire', 'ice']):
            return 'Offensive'
        elif any(word in name_lower for word in ['buff', 'enhance', 'improve']):
            return 'Buffs'
        elif any(word in name_lower for word in ['debuff', 'weaken', 'reduce']):
            return 'Debuffs'
        elif any(word in name_lower for word in ['creation', 'summon', 'manifest']):
            return 'Creation'
        elif any(word in name_lower for word in ['calm', 'root', 'snare', 'blind']):
            return 'Crowd Control'
        else:
            return 'Unknown'
    
    def _infer_profession_from_name(self, name: str) -> str:
        """Infer profession from crystal name"""
        name_lower = name.lower()
        
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
        
        for keyword, profession in profession_keywords.items():
            if keyword in name_lower:
                return profession
                
        return 'General'
    
    def _calculate_nano_cost(self, requirements: Dict) -> int:
        """Calculate approximate nano cost based on requirements"""
        # Simple heuristic based on highest skill requirement
        max_req = 0
        for skill, value in requirements.items():
            if value and isinstance(value, (int, float)):
                max_req = max(max_req, int(value))
        
        # Rough formula: nano cost ≈ max_requirement * 0.8
        return max(int(max_req * 0.8), 10) if max_req > 0 else 40
    
    def _generate_analysis_report(self, results: List[Dict]):
        """Generate analysis report"""
        print("\n" + "="*60)
        print("NANO STRAIN ANALYSIS REPORT")
        print("="*60)
        
        total_nanos = len(results)
        strain_counts = defaultdict(int)
        inference_methods = defaultdict(int)
        missing_strains = 0
        
        for nano in results:
            strain_id = nano['strain_id']
            method = nano['inference_method']
            
            if strain_id == 0:
                missing_strains += 1
            else:
                strain_counts[strain_id] += 1
                
            inference_methods[method] += 1
        
        print(f"Total player-castable nanos: {total_nanos}")
        print(f"Nanos with strain assignments: {total_nanos - missing_strains}")
        print(f"Nanos missing strain assignments: {missing_strains}")
        print(f"Coverage: {((total_nanos - missing_strains) / total_nanos * 100):.1f}%")
        
        print("\nInference methods used:")
        for method, count in inference_methods.items():
            print(f"  {method}: {count}")
        
        print(f"\nTop 10 strain assignments:")
        for strain_id, count in sorted(strain_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
            print(f"  Strain {strain_id}: {count} nanos")


async def main():
    analyzer = NanoStrainAnalyzer()
    
    try:
        # Connect to database
        await analyzer.connect_db()
        
        # Load existing CSV data for reference
        analyzer.load_existing_csv('/home/quigley/projects/Tinkertools/backend/nanos.csv')
        
        # Build inference rules
        analyzer.build_strain_inference_rules()
        
        # Generate comprehensive CSV
        await analyzer.generate_comprehensive_csv('/home/quigley/projects/Tinkertools/backend/complete_nanos.csv')
        
        print("\n✅ Complete nano CSV generated successfully!")
        print("📁 Output: /home/quigley/projects/Tinkertools/backend/complete_nanos.csv")
        
    finally:
        await analyzer.close_db()


if __name__ == "__main__":
    asyncio.run(main())