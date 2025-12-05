"""
Streaming JSON-to-CSV transformer for TinkerTools database import.

This module eliminates the 189-second Python dict iteration overhead by:
1. Streaming JSON parsing with ijson (no full load into memory)
2. Direct CSV writing (no intermediate dict structures)
3. Deduplication for singleton entities (stat_values, criteria)
4. Sequential ID generation

Performance target: <20 seconds for 120K items
"""

import ijson
import csv
import logging
from pathlib import Path
from typing import Dict, Set, Tuple, Optional, Any, List
import time
from collections import defaultdict

logger = logging.getLogger(__name__)


class StreamingCSVTransformer:
    """Transform JSON game data to CSV files using streaming parsing."""

    def __init__(self, output_dir: str = "/tmp/tinkertools_import"):
        """
        Initialize CSV transformer.

        Args:
            output_dir: Directory for CSV output files
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True, parents=True)

        # Singleton deduplication maps: (key_tuple) -> id
        self.stat_values_map: Dict[Tuple[int, int], int] = {}  # (stat, value) -> id
        self.criteria_map: Dict[Tuple[int, int, int], int] = {}  # (value1, value2, operator) -> id
        self.mob_map: Dict[Tuple[str, str], int] = {}  # (name, playfield) -> mob_id
        self.source_map: Dict[int, int] = {}  # mob_id -> source_id

        # ID counters (sequential generation)
        self.next_stat_value_id = 1
        self.next_criteria_id = 1
        self.next_item_id = 1
        self.next_attack_defense_id = 1
        self.next_animation_mesh_id = 1
        self.next_action_id = 1
        self.next_spell_data_id = 1
        self.next_spell_id = 1
        self.next_mob_id = 1
        self.next_source_id = 1

        # Statistics
        self.stats = {
            'items': 0,
            'stat_values': 0,
            'criteria': 0,
            'item_stats': 0,
            'attack_defense': 0,
            'attack_defense_attack': 0,
            'attack_defense_defense': 0,
            'animation_mesh': 0,
            'actions': 0,
            'action_criteria': 0,
            'spell_data': 0,
            'spells': 0,
            'spell_data_spells': 0,
            'spell_criteria': 0,
            'item_spell_data': 0,
            'perks': 0,
            'mobs': 0,
            'sources': 0,
            'item_sources': 0,
        }

    def _get_or_create_stat_value(self, stat: int, value: int) -> Tuple[int, bool]:
        """Get existing or create new StatValue ID."""
        key = (stat, value)
        if key not in self.stat_values_map:
            self.stat_values_map[key] = self.next_stat_value_id
            self.next_stat_value_id += 1
            self.stats['stat_values'] += 1
            return self.stat_values_map[key], True  # True = newly created
        return self.stat_values_map[key], False  # False = existing

    def _get_or_create_criterion(self, value1: int, value2: int, operator: int) -> Tuple[int, bool]:
        """Get existing or create new Criterion ID."""
        key = (value1, value2, operator)
        if key not in self.criteria_map:
            self.criteria_map[key] = self.next_criteria_id
            self.next_criteria_id += 1
            self.stats['criteria'] += 1
            return self.criteria_map[key], True  # True = newly created
        return self.criteria_map[key], False  # False = existing

    def _csv_escape(self, value: Any) -> str:
        """Escape value for PostgreSQL COPY format (tab-delimited)."""
        if value is None:
            return '\\N'  # PostgreSQL NULL
        if isinstance(value, bool):
            return 't' if value else 'f'  # PostgreSQL boolean
        if isinstance(value, list):
            # PostgreSQL array format: {val1,val2,val3}
            if not value:
                return '{}'
            return '{' + ','.join(str(v) for v in value) + '}'
        if isinstance(value, dict):
            # For JSON columns, use proper JSON escaping
            import json
            json_str = json.dumps(value)
            # Escape for COPY format
            return json_str.replace('\\', '\\\\').replace('\n', '\\n').replace('\t', '\\t').replace('\r', '\\r')
        # String escaping for COPY format
        s = str(value)
        s = s.replace('\\', '\\\\')  # Backslash must be first
        s = s.replace('\n', '\\n')
        s = s.replace('\r', '\\r')
        s = s.replace('\t', '\\t')
        return s

    def _write_csv_row(self, writer, row: List[Any]):
        """Write a row to tab-delimited file (PostgreSQL COPY TEXT format)."""
        escaped_row = [self._csv_escape(v) for v in row]
        # Write directly as tab-delimited text (don't use csv.writer - it double-escapes \N)
        writer.write('\t'.join(escaped_row) + '\n')

    def transform_items(self, json_file: str, is_nano: bool = False, perk_metadata: Optional[Dict[int, Dict]] = None) -> Dict[str, Any]:
        """
        Stream JSON items to multiple CSV files.

        Args:
            json_file: Path to JSON file
            is_nano: Whether these are nano programs
            perk_metadata: Optional perk metadata dict {aoid: {...}}

        Returns:
            Statistics dictionary
        """
        logger.info(f"Starting CSV transformation: {json_file}")
        start_time = time.time()

        # Open all CSV files
        csv_files = {}
        csv_writers = {}

        try:
            # Items table
            csv_files['items'] = open(self.output_dir / 'items.csv', 'w', newline='', encoding='utf-8')
            csv_writers['items'] = csv_files['items']  # Raw file handle for direct writing

            # StatValues table
            csv_files['stat_values'] = open(self.output_dir / 'stat_values.csv', 'w', newline='', encoding='utf-8')
            csv_writers['stat_values'] = csv_files['stat_values']

            # Criteria table
            csv_files['criteria'] = open(self.output_dir / 'criteria.csv', 'w', newline='', encoding='utf-8')
            csv_writers['criteria'] = csv_files['criteria']

            # Junction tables
            csv_files['item_stats'] = open(self.output_dir / 'item_stats.csv', 'w', newline='', encoding='utf-8')
            csv_writers['item_stats'] = csv_files['item_stats']

            # AttackDefense tables
            csv_files['attack_defense'] = open(self.output_dir / 'attack_defense.csv', 'w', newline='', encoding='utf-8')
            csv_writers['attack_defense'] = csv_files['attack_defense']

            csv_files['attack_defense_attack'] = open(self.output_dir / 'attack_defense_attack.csv', 'w', newline='', encoding='utf-8')
            csv_writers['attack_defense_attack'] = csv_files['attack_defense_attack']

            csv_files['attack_defense_defense'] = open(self.output_dir / 'attack_defense_defense.csv', 'w', newline='', encoding='utf-8')
            csv_writers['attack_defense_defense'] = csv_files['attack_defense_defense']

            # AnimationMesh table
            csv_files['animation_mesh'] = open(self.output_dir / 'animation_mesh.csv', 'w', newline='', encoding='utf-8')
            csv_writers['animation_mesh'] = csv_files['animation_mesh']

            # Action tables
            csv_files['actions'] = open(self.output_dir / 'actions.csv', 'w', newline='', encoding='utf-8')
            csv_writers['actions'] = csv_files['actions']

            csv_files['action_criteria'] = open(self.output_dir / 'action_criteria.csv', 'w', newline='', encoding='utf-8')
            csv_writers['action_criteria'] = csv_files['action_criteria']

            # SpellData and Spell tables
            csv_files['spell_data'] = open(self.output_dir / 'spell_data.csv', 'w', newline='', encoding='utf-8')
            csv_writers['spell_data'] = csv_files['spell_data']

            csv_files['spells'] = open(self.output_dir / 'spells.csv', 'w', newline='', encoding='utf-8')
            csv_writers['spells'] = csv_files['spells']

            csv_files['spell_data_spells'] = open(self.output_dir / 'spell_data_spells.csv', 'w', newline='', encoding='utf-8')
            csv_writers['spell_data_spells'] = csv_files['spell_data_spells']

            csv_files['spell_criteria'] = open(self.output_dir / 'spell_criteria.csv', 'w', newline='', encoding='utf-8')
            csv_writers['spell_criteria'] = csv_files['spell_criteria']

            csv_files['item_spell_data'] = open(self.output_dir / 'item_spell_data.csv', 'w', newline='', encoding='utf-8')
            csv_writers['item_spell_data'] = csv_files['item_spell_data']

            # Perks table
            csv_files['perks'] = open(self.output_dir / 'perks.csv', 'w', newline='', encoding='utf-8')
            csv_writers['perks'] = csv_files['perks']

            # Stream parse JSON
            logger.info("Parsing JSON stream...")
            with open(json_file, 'rb') as f:
                # ijson.items returns an iterator of top-level array items
                items = ijson.items(f, 'item')

                item_count = 0
                for item_data in items:
                    item_count += 1
                    if item_count % 10000 == 0:
                        logger.info(f"Processed {item_count} items...")

                    self._process_item(item_data, is_nano, perk_metadata, csv_writers)

            logger.info(f"Processed {item_count} items from JSON stream")

        finally:
            # Close all CSV files
            for f in csv_files.values():
                f.close()

        elapsed = time.time() - start_time
        logger.info(f"CSV transformation complete in {elapsed:.2f}s")

        # Return statistics
        self.stats['total_time'] = elapsed
        self.stats['items_per_second'] = self.stats['items'] / elapsed if elapsed > 0 else 0

        return self.stats

    def _process_item(self, item_data: Dict, is_nano: bool, perk_metadata: Optional[Dict], csv_writers: Dict):
        """Process a single item and write to CSV files."""
        aoid = item_data.get('AOID')
        if not aoid:
            return

        # Check for per-item is_nano flag (used when processing merged items+nanos)
        item_is_nano = item_data.get('__is_nano__', is_nano)

        # Generate item ID
        item_id = self.next_item_id
        self.next_item_id += 1
        self.stats['items'] += 1

        # Extract ql and item_class from StatValues
        ql = 1  # default
        item_class = 0  # default

        for sv_data in item_data.get('StatValues', []):
            stat = sv_data.get('Stat')
            value = sv_data.get('RawValue')
            if stat == 76:  # Item class
                item_class = value
            elif stat == 54 and not item_is_nano:  # Quality level - only for regular items
                ql = value

        # Process AttackDefense FIRST to get ID
        atkdef_id = None
        atkdef_data = item_data.get('AttackDefenseData')
        if atkdef_data:
            atkdef_id = self._process_attack_defense(atkdef_data, csv_writers)
            self.stats['attack_defense'] += 1

        # Process AnimationMesh FIRST to get ID
        animesh_id = None
        animesh_data = item_data.get('AnimationMesh')
        if animesh_data:
            animesh_id = self._process_animation_mesh(animesh_data, csv_writers)
            self.stats['animation_mesh'] += 1

        # Write item row WITH foreign keys
        # items: id, aoid, name, ql, item_class, description, is_nano, animation_mesh_id, atkdef_id
        item_row = [
            item_id,
            aoid,
            item_data.get('Name', ''),
            ql,
            item_class,
            item_data.get('Description', ''),
            item_is_nano,
            animesh_id,
            atkdef_id
        ]
        self._write_csv_row(csv_writers['items'], item_row)

        # Process StatValues and item_stats
        seen_stat_values = set()
        for sv_data in item_data.get('StatValues', []):
            stat = sv_data.get('Stat')
            value = sv_data.get('RawValue')

            sv_id, is_new = self._get_or_create_stat_value(stat, value)

            # Write to stat_values.csv if new
            if is_new:
                self._write_csv_row(csv_writers['stat_values'], [sv_id, stat, value])

            # Write to item_stats junction (deduplicate per item)
            if sv_id not in seen_stat_values:
                self._write_csv_row(csv_writers['item_stats'], [item_id, sv_id])
                self.stats['item_stats'] += 1
                seen_stat_values.add(sv_id)

        # Process Actions
        action_data = item_data.get('ActionData')
        if action_data and action_data.get('Actions'):
            for action_info in action_data['Actions']:
                self._process_action(action_info, item_id, csv_writers)

        # Process SpellData
        for spell_data_info in item_data.get('SpellData', []):
            self._process_spell_data(spell_data_info, item_id, csv_writers)

        # Process Perks
        if not item_is_nano and perk_metadata and aoid in perk_metadata:
            self._process_perk(item_id, aoid, perk_metadata[aoid], csv_writers)

    def _process_attack_defense(self, atkdef_data: Dict, csv_writers: Dict) -> int:
        """Process AttackDefense entity and return its ID."""
        atkdef_id = self.next_attack_defense_id
        self.next_attack_defense_id += 1

        # Write AttackDefense row (just ID)
        self._write_csv_row(csv_writers['attack_defense'], [atkdef_id])

        # Process Attack stats
        seen_attack = set()
        for atk_data in atkdef_data.get('Attack', []):
            stat = atk_data.get('Stat')
            value = atk_data.get('RawValue')

            sv_id, is_new = self._get_or_create_stat_value(stat, value)

            if is_new:
                self._write_csv_row(csv_writers['stat_values'], [sv_id, stat, value])

            if sv_id not in seen_attack:
                self._write_csv_row(csv_writers['attack_defense_attack'], [atkdef_id, sv_id])
                self.stats['attack_defense_attack'] += 1
                seen_attack.add(sv_id)

        # Process Defense stats
        seen_defense = set()
        for def_data in atkdef_data.get('Defense', []):
            stat = def_data.get('Stat')
            value = def_data.get('RawValue')

            sv_id, is_new = self._get_or_create_stat_value(stat, value)

            if is_new:
                self._write_csv_row(csv_writers['stat_values'], [sv_id, stat, value])

            if sv_id not in seen_defense:
                self._write_csv_row(csv_writers['attack_defense_defense'], [atkdef_id, sv_id])
                self.stats['attack_defense_defense'] += 1
                seen_defense.add(sv_id)

        return atkdef_id

    def _process_animation_mesh(self, animesh_data: Dict, csv_writers: Dict) -> int:
        """Process AnimationMesh entity and return its ID."""
        animesh_id = self.next_animation_mesh_id
        self.next_animation_mesh_id += 1

        animation_id = None
        mesh_id = None

        # Process Animation
        animation_data = animesh_data.get('Animation')
        if animation_data:
            stat = animation_data.get('Stat')
            value = animation_data.get('RawValue')

            sv_id, is_new = self._get_or_create_stat_value(stat, value)

            if is_new:
                self._write_csv_row(csv_writers['stat_values'], [sv_id, stat, value])

            animation_id = sv_id

        # Process Mesh
        mesh_data = animesh_data.get('Mesh')
        if mesh_data:
            stat = mesh_data.get('Stat')
            value = mesh_data.get('RawValue')

            sv_id, is_new = self._get_or_create_stat_value(stat, value)

            if is_new:
                self._write_csv_row(csv_writers['stat_values'], [sv_id, stat, value])

            mesh_id = sv_id

        # Write AnimationMesh row
        self._write_csv_row(csv_writers['animation_mesh'], [animesh_id, animation_id, mesh_id])

        return animesh_id

    def _process_action(self, action_info: Dict, item_id: int, csv_writers: Dict):
        """Process Action entity."""
        action_id = self.next_action_id
        self.next_action_id += 1
        self.stats['actions'] += 1

        # Write Action row
        self._write_csv_row(csv_writers['actions'], [action_id, action_info.get('Action'), item_id])

        # Process Criteria
        order_index = 0
        for crit_data in action_info.get('Criteria', []):
            value1 = crit_data['Value1']
            value2 = crit_data['Value2']
            operator = crit_data['Operator']

            crit_id, is_new = self._get_or_create_criterion(value1, value2, operator)

            if is_new:
                self._write_csv_row(csv_writers['criteria'], [crit_id, value1, value2, operator])

            # Write ActionCriteria junction (with auto-increment ID)
            # Note: action_criteria has its own auto-increment ID column
            # We'll let PostgreSQL generate it, so we don't include ID in CSV
            self._write_csv_row(csv_writers['action_criteria'], [action_id, crit_id, order_index])
            self.stats['action_criteria'] += 1
            order_index += 1

    def _process_spell_data(self, spell_data_info: Dict, item_id: int, csv_writers: Dict):
        """Process SpellData and associated Spells."""
        spell_data_id = self.next_spell_data_id
        self.next_spell_data_id += 1
        self.stats['spell_data'] += 1

        # Write SpellData row
        self._write_csv_row(csv_writers['spell_data'], [spell_data_id, spell_data_info.get('Event')])

        # Write item_spell_data junction
        self._write_csv_row(csv_writers['item_spell_data'], [item_id, spell_data_id])
        self.stats['item_spell_data'] += 1

        # Process Spells
        for spell_info in spell_data_info.get('Items', []):
            spell_id = self._process_spell(spell_info, csv_writers)

            # Write spell_data_spells junction
            self._write_csv_row(csv_writers['spell_data_spells'], [spell_data_id, spell_id])
            self.stats['spell_data_spells'] += 1

    def _process_spell(self, spell_info: Dict, csv_writers: Dict) -> int:
        """Process Spell entity and return its ID."""
        spell_id = self.next_spell_id
        self.next_spell_id += 1
        self.stats['spells'] += 1

        # Extract spell params (everything except specific fields)
        spell_params = {k: v for k, v in spell_info.items()
                       if k not in ['SpellID', 'Target', 'TickCount', 'TickInterval', 'SpellFormat', 'Criteria']}

        # Write Spell row
        # spells: id, target, tick_count, tick_interval, spell_id, spell_format, spell_params
        self._write_csv_row(csv_writers['spells'], [
            spell_id,
            spell_info.get('Target'),
            spell_info.get('TickCount'),
            spell_info.get('TickInterval'),
            spell_info.get('SpellID'),
            spell_info.get('SpellFormat'),
            spell_params  # JSON column
        ])

        # Process Criteria
        seen_criteria = set()
        for crit_data in spell_info.get('Criteria', []):
            value1 = crit_data['Value1']
            value2 = crit_data['Value2']
            operator = crit_data['Operator']

            crit_id, is_new = self._get_or_create_criterion(value1, value2, operator)

            if is_new:
                self._write_csv_row(csv_writers['criteria'], [crit_id, value1, value2, operator])

            if crit_id not in seen_criteria:
                self._write_csv_row(csv_writers['spell_criteria'], [spell_id, crit_id])
                self.stats['spell_criteria'] += 1
                seen_criteria.add(crit_id)

        return spell_id

    def _process_perk(self, item_id: int, aoid: int, perk_data: Dict, csv_writers: Dict):
        """Process Perk entity."""
        from app.core import perk_validator

        # Map professions and breeds to IDs
        profession_ids = []
        for prof_name in perk_data.get('professions', []):
            try:
                profession_ids.append(perk_validator.map_profession_to_id(prof_name))
            except ValueError:
                pass  # Skip invalid professions

        breed_ids = []
        for breed_name in perk_data.get('breeds', []):
            try:
                breed_ids.append(perk_validator.map_breed_to_id(breed_name))
            except ValueError:
                pass  # Skip invalid breeds

        # Parse level requirements
        level_required = perk_validator.parse_level_requirement(perk_data.get('level'))
        ai_level_required = perk_validator.parse_level_requirement(perk_data.get('aiTitle'))

        # perks: item_id, name, perk_series, counter, type, level_required, ai_level_required, professions, breeds
        self._write_csv_row(csv_writers['perks'], [
            item_id,
            perk_data['name'],
            perk_data['name'],  # perk_series
            perk_validator.validate_counter(perk_data['counter']),
            perk_validator.validate_perk_type(perk_data['type']),
            level_required,
            ai_level_required,
            profession_ids,  # ARRAY column
            breed_ids  # ARRAY column
        ])
        self.stats['perks'] += 1

    def transform_symbiants(self, csv_file: str, source_type_id: int = 1) -> Dict[str, Any]:
        """
        Stream symbiant CSV to mobs/sources/item_sources CSV files.

        CSV Format (semicolon-delimited, no header):
        QL;Slot;Family;BossName;Playfield;Location;Mobs;Level;...;ItemLink

        Args:
            csv_file: Path to symbiants.csv
            source_type_id: ID of 'mob' source_type (default 1)

        Returns:
            Statistics dictionary
        """
        import re

        logger.info(f"Starting symbiant CSV transformation: {csv_file}")
        start_time = time.time()

        csv_files = {}
        csv_writers = {}

        try:
            # Open output CSV files
            csv_files['mobs'] = open(self.output_dir / 'mobs.csv', 'w', newline='', encoding='utf-8')
            csv_writers['mobs'] = csv_files['mobs']

            csv_files['sources'] = open(self.output_dir / 'sources.csv', 'w', newline='', encoding='utf-8')
            csv_writers['sources'] = csv_files['sources']

            csv_files['item_sources'] = open(self.output_dir / 'item_sources.csv', 'w', newline='', encoding='utf-8')
            csv_writers['item_sources'] = csv_files['item_sources']

            # Parse symbiant CSV
            symbiant_drops = []

            with open(csv_file, 'r', encoding='utf-8') as f:
                reader = csv.reader(f, delimiter=';')

                for row_count, row in enumerate(reader, 1):
                    if len(row) < 12:
                        logger.warning(f"Skipping malformed row {row_count}")
                        continue

                    # Parse columns (indices based on observed CSV format)
                    boss_name = row[3].strip()
                    playfield = row[4].strip()
                    location = row[5].strip()
                    mobs = row[6].strip()
                    level = row[7].strip()
                    item_link = row[-2].strip() if len(row) >= 11 else row[-1].strip()

                    # Extract AOID
                    aoid = self._extract_aoid_from_link(item_link)
                    if not aoid:
                        logger.warning(f"Could not extract AOID from row {row_count}: {item_link}")
                        continue

                    # Get or create mob
                    mob_id = self._get_or_create_mob(
                        boss_name, playfield, location, mobs, level, csv_writers
                    )

                    # Track drop relationship
                    symbiant_drops.append({'aoid': aoid, 'mob_id': mob_id})

            logger.info(f"Processed {row_count} symbiant rows")

            # Create sources for all mobs (one per mob)
            for mob_key, mob_id in self.mob_map.items():
                source_id = self._create_source(mob_id, mob_key[0], source_type_id, csv_writers)
                self.source_map[mob_id] = source_id

            # Create item_sources (deduplicate)
            seen_pairs = set()
            for drop in symbiant_drops:
                pair = (drop['aoid'], drop['mob_id'])
                if pair in seen_pairs:
                    continue
                seen_pairs.add(pair)

                source_id = self.source_map.get(drop['mob_id'])
                if not source_id:
                    continue

                # Write AOID (will be resolved to item_id by loader)
                # item_sources: aoid, source_id, drop_rate, min_ql, max_ql, conditions, metadata
                self._write_csv_row(csv_writers['item_sources'], [
                    drop['aoid'],
                    source_id,
                    None,  # drop_rate
                    None,  # min_ql
                    None,  # max_ql
                    None,  # conditions
                    '{}'   # metadata
                ])
                self.stats['item_sources'] += 1

        finally:
            for f in csv_files.values():
                f.close()

        elapsed = time.time() - start_time
        self.stats['symbiant_time'] = elapsed
        logger.info(f"Symbiant transformation complete in {elapsed:.2f}s")
        logger.info(f"  Mobs: {self.stats['mobs']}, Sources: {self.stats['sources']}, ItemSources: {self.stats['item_sources']}")

        return self.stats

    def _get_or_create_mob(self, name: str, playfield: str, location: str,
                           mobs_str: str, level_str: str, csv_writers: Dict) -> int:
        """Get existing or create new Mob ID with deduplication."""
        mob_key = (name, playfield)

        if mob_key not in self.mob_map:
            mob_id = self.next_mob_id
            self.next_mob_id += 1
            self.mob_map[mob_key] = mob_id

            # Parse mob_names array
            mob_names = [m.strip() for m in mobs_str.split(',') if m.strip()]
            level = int(level_str) if level_str.isdigit() else None

            # mobs: id, name, level, playfield, location, mob_names, is_pocket_boss, metadata
            self._write_csv_row(csv_writers['mobs'], [
                mob_id,
                name,
                level,
                playfield,
                location,
                mob_names,  # PostgreSQL array
                True,  # is_pocket_boss
                '{}'   # metadata JSONB
            ])
            self.stats['mobs'] += 1

        return self.mob_map[mob_key]

    def _create_source(self, mob_id: int, mob_name: str, source_type_id: int,
                       csv_writers: Dict) -> int:
        """Create Source record for a mob."""
        source_id = self.next_source_id
        self.next_source_id += 1

        # sources: id, source_type_id, source_id, name, metadata
        self._write_csv_row(csv_writers['sources'], [
            source_id,
            source_type_id,
            mob_id,
            mob_name,
            '{}'
        ])
        self.stats['sources'] += 1

        return source_id

    def _extract_aoid_from_link(self, link: str) -> Optional[int]:
        """Extract AOID from HTML link."""
        import re
        # <a href=http://aomainframe.info/showitem.asp?AOID=219135>Name</a>
        match = re.search(r'AOID=(\d+)', link, re.IGNORECASE)
        if match:
            return int(match.group(1))
        # Fallback: any number
        match = re.search(r'(\d+)', link)
        return int(match.group(1)) if match else None

    def get_csv_files(self) -> List[str]:
        """Return list of generated CSV file paths."""
        base_files = [
            str(self.output_dir / 'items.csv'),
            str(self.output_dir / 'stat_values.csv'),
            str(self.output_dir / 'criteria.csv'),
            str(self.output_dir / 'item_stats.csv'),
            str(self.output_dir / 'attack_defense.csv'),
            str(self.output_dir / 'attack_defense_attack.csv'),
            str(self.output_dir / 'attack_defense_defense.csv'),
            str(self.output_dir / 'animation_mesh.csv'),
            str(self.output_dir / 'actions.csv'),
            str(self.output_dir / 'action_criteria.csv'),
            str(self.output_dir / 'spell_data.csv'),
            str(self.output_dir / 'spells.csv'),
            str(self.output_dir / 'spell_data_spells.csv'),
            str(self.output_dir / 'spell_criteria.csv'),
            str(self.output_dir / 'item_spell_data.csv'),
            str(self.output_dir / 'perks.csv'),
        ]

        # Add symbiant files if they exist
        for filename in ['mobs.csv', 'sources.csv', 'item_sources.csv']:
            path = self.output_dir / filename
            if path.exists():
                base_files.append(str(path))

        return base_files


def load_perk_metadata(perks_file: str) -> Dict[int, Dict]:
    """
    Load perk metadata from JSON file.

    Args:
        perks_file: Path to perks.json

    Returns:
        Dictionary mapping AOID to perk metadata
    """
    import json

    with open(perks_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    perk_cache = {}
    columns = data["columns"]
    indices = {col: columns.index(col) for col in columns}

    for row in data["values"]:
        aoid = row[indices["aoid"]]
        perk_cache[aoid] = {
            "name": row[indices["name"]],
            "counter": row[indices["counter"]],
            "type": row[indices["type"]],
            "professions": row[indices.get("professions", -1)] or [],
            "breeds": row[indices.get("breeds", -1)] or [],
            "level": row[indices.get("level", -1)],
            "aiTitle": row[indices.get("aiTitle", -1)]
        }

    return perk_cache
