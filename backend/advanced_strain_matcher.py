#!/usr/bin/env python3
"""
Advanced Strain Matcher

Uses sophisticated pattern matching to infer nano strains:
1. Exact name matching with existing CSV data
2. Keyword-based strain inference
3. Spell effect analysis
4. Profession-specific patterns
5. Machine learning-like pattern recognition
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


class AdvancedStrainMatcher:
    def __init__(self):
        self.conn = None
        self.existing_csv_data = {}
        self.strain_keywords = defaultdict(list)
        self.profession_patterns = defaultdict(list)
        self.name_strain_map = {}
        
    async def connect_db(self):
        self.conn = await asyncpg.connect(DATABASE_URL)
        
    async def close_db(self):
        if self.conn:
            await self.conn.close()
    
    def load_existing_csv(self, csv_path: str):
        """Load existing CSV and build comprehensive pattern maps"""
        print(f"Loading existing CSV data from {csv_path}...")
        df = pd.read_csv(csv_path)
        
        for _, row in df.iterrows():
            nano_id = row['nano_id']
            crystal_id = row['crystal_id']
            strain_id = row['strain_id'] if pd.notna(row['strain_id']) and row['strain_id'] != 0 else None
            strain_name = str(row['strain']) if pd.notna(row['strain']) else ''
            
            data = {
                'crystal_id': crystal_id,
                'nano_name': str(row['nano_name']),
                'crystal_name': str(row['crystal_name']),
                'strain': strain_name,
                'strain_id': strain_id,
                'school': str(row['school']),
                'professions': str(row['professions']),
                'location': str(row['location']),
            }
            
            self.existing_csv_data[nano_id] = data
            
            # Build pattern maps if strain is known
            if strain_id and strain_name:
                # Keywords from nano names
                words = re.findall(r'\b\w+\b', data['nano_name'].lower())
                for word in words:
                    if len(word) > 3:  # Ignore short words
                        self.strain_keywords[strain_id].append(word)
                
                # Store exact name mappings
                self.name_strain_map[data['nano_name'].lower()] = strain_id
                
                # Profession patterns
                if data['professions'] != 'nan':
                    self.profession_patterns[data['professions']].append({
                        'strain_id': strain_id,
                        'strain_name': strain_name,
                        'school': data['school'],
                        'keywords': words
                    })
        
        # Process keyword frequencies
        for strain_id, words in self.strain_keywords.items():
            word_counts = Counter(words)
            # Keep only words that appear frequently for this strain
            self.strain_keywords[strain_id] = [word for word, count in word_counts.items() if count >= 2]
        
        print(f"Loaded {len(df)} nano entries")
        print(f"Built keyword patterns for {len(self.strain_keywords)} strains")
        print(f"Built profession patterns for {len(self.profession_patterns)} professions")
    
    async def extract_all_nanos(self) -> List[Dict]:
        """Extract all player-castable nanos"""
        query = """
        SELECT DISTINCT 
            i.id as crystal_id,
            i.name as crystal_name,
            i.ql,
            ARRAY_AGG(s.id) as spell_ids,
            ARRAY_AGG(s.spell_params::text) as spell_params_list
        FROM items i
        JOIN actions a ON i.id = a.item_id
        JOIN spell_data sd ON i.id = sd.id
        JOIN spell_data_spells sds ON sd.id = sds.spell_data_id  
        JOIN spells s ON sds.spell_id = s.id
        WHERE i.is_nano = true
        GROUP BY i.id, i.name, i.ql
        ORDER BY i.id;
        """
        
        rows = await self.conn.fetch(query)
        
        crystals = []
        for row in rows:
            spell_params_list = []
            for params_text in row['spell_params_list']:
                try:
                    params = json.loads(params_text) if params_text else {}
                    spell_params_list.append(params)
                except (json.JSONDecodeError, TypeError):
                    spell_params_list.append({})
            
            crystals.append({
                'crystal_id': row['crystal_id'],
                'crystal_name': row['crystal_name'],
                'ql': row['ql'],
                'spell_ids': list(row['spell_ids']),
                'spell_params_list': spell_params_list
            })
        
        print(f"Found {len(crystals)} unique player-castable nano crystals")
        return crystals
    
    def infer_strain_advanced(self, crystal: Dict) -> Tuple[Optional[int], str, str]:
        """Advanced strain inference using multiple sophisticated methods"""
        crystal_name = crystal['crystal_name']
        nano_name = self._extract_nano_name(crystal_name)
        
        # Method 1: Exact nano name match
        exact_match = self.name_strain_map.get(nano_name.lower())
        if exact_match:
            strain_name = self._get_strain_name_by_id(exact_match)
            return exact_match, "exact_name_match", strain_name
        
        # Method 2: Fuzzy name matching
        best_match, similarity = self._find_best_name_match(nano_name)
        if similarity > 0.8:  # High similarity threshold
            strain_id = self.name_strain_map[best_match]
            strain_name = self._get_strain_name_by_id(strain_id)
            return strain_id, f"fuzzy_name_match_{similarity:.2f}", strain_name
        
        # Method 3: Keyword-based inference
        strain_id = self._infer_from_keywords(nano_name, crystal_name)
        if strain_id:
            strain_name = self._get_strain_name_by_id(strain_id)
            return strain_id, "keyword_pattern_match", strain_name
        
        # Method 4: Spell effect analysis
        strain_id = self._infer_from_spell_effects(crystal['spell_params_list'], crystal_name)
        if strain_id:
            strain_name = self._get_strain_name_by_id(strain_id)
            return strain_id, "spell_effect_analysis", strain_name
        
        # Method 5: Crystal name pattern matching
        strain_id = self._infer_from_crystal_patterns(crystal_name)
        if strain_id:
            strain_name = self._get_strain_name_by_id(strain_id)
            return strain_id, "crystal_pattern_match", strain_name
        
        return None, "no_advanced_inference", ""
    
    def _extract_nano_name(self, crystal_name: str) -> str:
        """Extract nano name from crystal name"""
        name = crystal_name
        
        # Remove common crystal prefixes/suffixes
        removals = [
            r'^Nano Crystal \(',
            r'^NanoCrystal \(',
            r'^Alien Matrix [A-Za-z]+ Box \(',
            r'^[A-Za-z\-]+:\s*Startup Crystal\s*-\s*',
            r'\)$'
        ]
        
        for pattern in removals:
            name = re.sub(pattern, '', name)
        
        return name.strip()
    
    def _find_best_name_match(self, nano_name: str) -> Tuple[str, float]:
        """Find best fuzzy match for nano name"""
        best_match = ""
        best_similarity = 0.0
        
        nano_lower = nano_name.lower()
        
        for existing_name in self.name_strain_map.keys():
            similarity = SequenceMatcher(None, nano_lower, existing_name).ratio()
            if similarity > best_similarity:
                best_similarity = similarity
                best_match = existing_name
        
        return best_match, best_similarity
    
    def _infer_from_keywords(self, nano_name: str, crystal_name: str) -> Optional[int]:
        """Infer strain from keyword analysis"""
        combined_text = f"{nano_name} {crystal_name}".lower()
        words = re.findall(r'\b\w+\b', combined_text)
        
        # Score each strain based on keyword matches
        strain_scores = defaultdict(int)
        
        for strain_id, keywords in self.strain_keywords.items():
            for keyword in keywords:
                if keyword in words:
                    strain_scores[strain_id] += 1
        
        if strain_scores:
            # Return strain with highest score
            best_strain = max(strain_scores.items(), key=lambda x: x[1])
            if best_strain[1] >= 2:  # Require at least 2 keyword matches
                return best_strain[0]
        
        return None
    
    def _infer_from_spell_effects(self, spell_params_list: List[Dict], crystal_name: str) -> Optional[int]:
        """Infer strain from spell effects"""
        # Collect all spell descriptions
        descriptions = []
        modified_stats = []
        
        for params in spell_params_list:
            desc = params.get('SpellDescription', '') or ''
            descriptions.append(desc.lower())
            
            stat = params.get('Stat')
            if stat:
                try:
                    modified_stats.append(int(stat))
                except (ValueError, TypeError):
                    pass
        
        combined_desc = ' '.join(descriptions)
        
        # Analyze modified stats for patterns
        if modified_stats:
            # Check for weapon skills
            weapon_stats = {
                123: 16,  # 1H Blunt
                124: 21,  # 1H Edged  
                125: 23,  # 2H Blunt
                126: 25,  # 2H Edged
                127: 27,  # Bow -> Bow Buffs
                132: 33,  # Full Auto -> Full Auto Buffs
                133: 35,  # Assault Rifle -> Assault Rifle Buffs
            }
            
            for stat_id in modified_stats:
                if stat_id in weapon_stats:
                    base_strain = weapon_stats[stat_id]
                    # Check if it's a debuff
                    if any(word in crystal_name.lower() for word in ['incompetence', 'inexperience']):
                        return base_strain + 1, "weapon_debuff_from_stat"
                    else:
                        return base_strain, "weapon_buff_from_stat"
        
        # Pattern match descriptions
        effect_patterns = {
            r'damage.*\d+': 1,    # Damage spells -> General Nuke
            r'heal.*\d+': 951,    # Healing -> Single Target Healing
            r'modify.*health': 951, # Health modification -> Healing
            r'reflect.*damage': 694, # Reflect -> Reflect Shield  
            r'summon.*pet': 6,    # Pet summon -> Attack Pet
            r'root.*target': 146, # Root effects -> Root
            r'snare.*target': 145, # Snare effects -> Snare
            r'mezmerize|charm': 147, # Mezz effects -> Mezz
        }
        
        for pattern, strain_id in effect_patterns.items():
            if re.search(pattern, combined_desc, re.IGNORECASE):
                return strain_id
        
        return None
    
    def _infer_from_crystal_patterns(self, crystal_name: str) -> Optional[int]:
        """Infer strain from crystal name patterns"""
        name_lower = crystal_name.lower()
        
        # Advanced pattern matching
        patterns = {
            # Weapon patterns
            r'1h?\s*blunt.*expertise|proficiency': 16,
            r'1h?\s*blunt.*incompetence|inexperience': 17,
            r'1h?\s*edged.*expertise|proficiency': 21,
            r'1h?\s*edged.*incompetence|inexperience': 22,
            r'2h?\s*blunt.*expertise|proficiency': 23,
            r'2h?\s*blunt.*incompetence|inexperience': 24,
            r'2h?\s*edged.*expertise|proficiency': 25,
            r'2h?\s*edged.*incompetence|inexperience': 26,
            
            # Combat patterns
            r'damage\s*shield': 1,
            r'reflect.*shield': 694,
            r'armor.*buff': 3,
            
            # Control patterns  
            r'root|entangle': 146,
            r'snare|slow': 145,
            r'mezz|charm|hypnosis': 147,
            r'calm|pacify': 202,
            
            # Healing patterns
            r'heal.*single|target.*heal': 951,
            r'heal.*team|group.*heal': 5,
            r'cure|antidote': 951,
            
            # Pet patterns
            r'creation:\s*|summon.*': 0,  # Creation school
            r'attack.*pet': 6,
            r'defensive.*pet': 7,
            
            # Profession specific
            r'keeper.*edge|blade': 153,
            r'soldier.*targeting': 836,
            r'trader.*bureaucrat': 999,  # Special trader strain
        }
        
        for pattern, strain_id in patterns.items():
            if re.search(pattern, name_lower):
                return strain_id
        
        return None
    
    async def extract_all_nanos(self) -> List[Dict]:
        """Extract all player-castable nanos"""
        query = """
        SELECT DISTINCT 
            i.id as crystal_id,
            i.name as crystal_name,
            i.ql,
            ARRAY_AGG(s.id ORDER BY s.id) as spell_ids,
            ARRAY_AGG(s.spell_params::text ORDER BY s.id) as spell_params_list
        FROM items i
        JOIN actions a ON i.id = a.item_id
        JOIN spell_data sd ON i.id = sd.id
        JOIN spell_data_spells sds ON sd.id = sds.spell_data_id  
        JOIN spells s ON sds.spell_id = s.id
        WHERE i.is_nano = true
        GROUP BY i.id, i.name, i.ql
        ORDER BY i.id;
        """
        
        rows = await self.conn.fetch(query)
        
        crystals = []
        for row in rows:
            spell_params_list = []
            for params_text in row['spell_params_list']:
                try:
                    params = json.loads(params_text) if params_text else {}
                    spell_params_list.append(params)
                except (json.JSONDecodeError, TypeError):
                    spell_params_list.append({})
            
            crystals.append({
                'crystal_id': row['crystal_id'],
                'crystal_name': row['crystal_name'],
                'ql': row['ql'],
                'spell_ids': list(row['spell_ids']),
                'spell_params_list': spell_params_list
            })
        
        return crystals
    
    def _get_strain_name_by_id(self, strain_id: int) -> str:
        """Get strain name by ID"""
        for data in self.existing_csv_data.values():
            if data.get('strain_id') == strain_id:
                return data.get('strain', '')
        return f"Strain_{strain_id}"
    
    async def get_nano_requirements(self, crystal_id: int) -> Dict:
        """Get nano casting requirements"""
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
    
    async def generate_final_csv(self, output_path: str):
        """Generate the final comprehensive nano CSV"""
        print("Generating final comprehensive nano CSV...")
        
        crystals = await self.extract_all_nanos()
        
        results = []
        stats = {
            'total': len(crystals),
            'with_strains': 0,
            'methods': defaultdict(int)
        }
        
        for crystal in crystals:
            crystal_id = crystal['crystal_id']
            
            # Get requirements
            requirements = await self.get_nano_requirements(crystal_id)
            
            # Advanced strain inference
            strain_id, method, strain_name = self.infer_strain_advanced(crystal)
            
            if strain_id:
                stats['with_strains'] += 1
            stats['methods'][method] += 1
            
            # Get existing data for reference
            primary_spell_id = crystal['spell_ids'][0]
            existing = self.existing_csv_data.get(primary_spell_id, {})
            
            # Extract nano name
            nano_name = self._extract_nano_name(crystal['crystal_name'])
            
            result = {
                'crystal_id': crystal_id,
                'nano_id': primary_spell_id,
                'ql': crystal['ql'],
                'crystal_name': crystal['crystal_name'],
                'nano_name': nano_name,
                'school': existing.get('school', self._infer_school_from_name(nano_name)),
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
                'confidence': self._calculate_confidence(method),
                'num_spell_effects': len(crystal['spell_ids']),
            }
            
            results.append(result)
        
        # Write CSV
        fieldnames = [
            'crystal_id', 'nano_id', 'ql', 'crystal_name', 'nano_name', 
            'school', 'strain', 'strain_id', 'sub_strain', 'professions',
            'location', 'nano_cost', 'froob_friendly', 'sort_order', 
            'nano_deck', 'spec', 'min_level', 'mm', 'bm', 'pm', 'si', 'ts', 'mc',
            'inference_method', 'confidence', 'num_spell_effects'
        ]
        
        with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(results)
        
        self._print_final_report(stats, results)
        
        # Also generate a summary of missing strains for manual review
        self._generate_missing_strains_report(results)
    
    def _infer_school_from_name(self, nano_name: str) -> str:
        """Infer school from nano name"""
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
    
    def _infer_profession_from_name(self, crystal_name: str) -> str:
        """Infer profession from crystal name"""
        name_lower = crystal_name.lower()
        
        # Direct profession mentions
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
    
    def _calculate_nano_cost(self, requirements: Dict) -> int:
        """Calculate nano cost from requirements"""
        skills = ['mm', 'bm', 'pm', 'si', 'ts', 'mc']
        max_req = 0
        
        for skill in skills:
            value = requirements.get(skill)
            if value and isinstance(value, (int, float)):
                max_req = max(max_req, int(value))
        
        return max(int(max_req * 0.7), 10) if max_req > 0 else 40
    
    def _calculate_confidence(self, method: str) -> float:
        """Calculate confidence score for inference method"""
        confidence_scores = {
            'exact_name_match': 1.0,
            'fuzzy_name_match_0.90': 0.9,
            'fuzzy_name_match_0.85': 0.85,
            'fuzzy_name_match_0.80': 0.8,
            'keyword_pattern_match': 0.7,
            'spell_effect_analysis': 0.6,
            'crystal_pattern_match': 0.5,
            'no_advanced_inference': 0.0,
        }
        
        # Handle fuzzy match methods
        if method.startswith('fuzzy_name_match_'):
            try:
                score = float(method.split('_')[-1])
                return score
            except ValueError:
                pass
        
        return confidence_scores.get(method, 0.3)
    
    def _print_final_report(self, stats: Dict, results: List[Dict]):
        """Print comprehensive final report"""
        print(f"\n{'='*70}")
        print("FINAL COMPREHENSIVE NANO STRAIN ANALYSIS")
        print(f"{'='*70}")
        
        total = stats['total']
        with_strains = stats['with_strains']
        coverage = (with_strains / total * 100) if total > 0 else 0
        
        print(f"📊 Total player-castable nano crystals: {total:,}")
        print(f"✅ Crystals with strain assignments: {with_strains:,}")
        print(f"❌ Crystals missing strains: {total - with_strains:,}")
        print(f"📈 Overall coverage: {coverage:.1f}%")
        
        print(f"\n🔍 Inference methods used:")
        for method, count in sorted(stats['methods'].items(), key=lambda x: x[1], reverse=True):
            percentage = (count / total * 100) if total > 0 else 0
            print(f"  {method}: {count:,} ({percentage:.1f}%)")
        
        # High confidence assignments
        high_conf = sum(1 for r in results if r['confidence'] >= 0.8)
        medium_conf = sum(1 for r in results if 0.5 <= r['confidence'] < 0.8)
        low_conf = sum(1 for r in results if 0 < r['confidence'] < 0.5)
        
        print(f"\n🎯 Confidence distribution:")
        print(f"  High confidence (≥0.8): {high_conf:,}")
        print(f"  Medium confidence (0.5-0.8): {medium_conf:,}")
        print(f"  Low confidence (<0.5): {low_conf:,}")
        print(f"  No assignment: {total - with_strains:,}")
    
    def _generate_missing_strains_report(self, results: List[Dict]):
        """Generate report of nanos missing strain assignments"""
        missing = [r for r in results if r['strain_id'] == 0]
        
        if not missing:
            return
        
        print(f"\n📋 Generating report for {len(missing)} nanos missing strain assignments...")
        
        # Group by profession for easier manual review
        by_profession = defaultdict(list)
        for nano in missing:
            by_profession[nano['professions']].append(nano)
        
        with open('/home/quigley/projects/Tinkertools/backend/missing_strains_report.csv', 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['crystal_id', 'nano_name', 'school', 'professions', 'num_spell_effects'])
            writer.writeheader()
            
            for profession, nanos in sorted(by_profession.items()):
                for nano in sorted(nanos, key=lambda x: x['nano_name']):
                    writer.writerow({
                        'crystal_id': nano['crystal_id'],
                        'nano_name': nano['nano_name'],
                        'school': nano['school'],
                        'professions': nano['professions'],
                        'num_spell_effects': nano['num_spell_effects']
                    })
        
        print("📁 Missing strains report: /home/quigley/projects/Tinkertools/backend/missing_strains_report.csv")


async def main():
    analyzer = AdvancedStrainMatcher()
    
    try:
        await analyzer.connect_db()
        
        # Load existing data and build patterns
        analyzer.load_existing_csv('/home/quigley/projects/Tinkertools/backend/nanos.csv')
        
        # Generate final comprehensive CSV
        await analyzer.generate_final_csv('/home/quigley/projects/Tinkertools/backend/final_nanos.csv')
        
        print(f"\n🎉 Final nano CSV generated successfully!")
        print(f"📁 Main output: /home/quigley/projects/Tinkertools/backend/final_nanos.csv")
        print(f"📋 Missing report: /home/quigley/projects/Tinkertools/backend/missing_strains_report.csv")
        
    finally:
        await analyzer.close_db()


if __name__ == "__main__":
    asyncio.run(main())