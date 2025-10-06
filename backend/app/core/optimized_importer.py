"""
Optimized data import utilities for TinkerTools.

Key optimizations while maintaining data accuracy:
1. Batch operations with explicit transaction control
2. Bulk inserts using COPY for PostgreSQL
3. Singleton caching with proper validation
4. Reduced flush frequency
"""

import json
import csv
import logging
import os
from typing import Dict, List, Any, Optional, Set
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.dialects.postgresql import insert as pg_insert
import time
from collections import defaultdict

# Import models directly
import sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from app.models import (
    Item, StatValue, Criterion, Spell, SpellData, AttackDefense,
    AnimationMesh, Action, ActionCriteria, SpellCriterion,
    ItemStats, AttackDefenseAttack, AttackDefenseDefense,
    SpellDataSpells, ItemSpellData, Perk
)
from app.core import perk_validator

logger = logging.getLogger(__name__)


class OptimizedImporter:
    """Optimized data importer with batch operations."""

    # Class-level cache for perk data (loaded once per process)
    _perk_data_cache: Optional[Dict[int, Dict]] = None
    _perk_cache_loaded = False

    def __init__(self, db_url: str = None, batch_size: int = 1000):
        """
        Initialize optimized importer.

        Args:
            db_url: Database URL
            batch_size: Number of items to process before committing
        """
        self.batch_size = batch_size
        self.db_url = db_url or os.getenv("DATABASE_URL")

        if not self.db_url:
            raise ValueError("DATABASE_URL required")

        # Create engine with optimized pool settings
        self.engine = create_engine(
            self.db_url,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,
            # Note: executemany optimizations are psycopg2-specific
            # They'll be applied automatically if using PostgreSQL
        )

        self.SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,  # Manual flush control
            bind=self.engine
        )

        # Initialize caches
        self._stat_value_cache: Dict[tuple, StatValue] = {}
        self._criterion_cache: Dict[tuple, Criterion] = {}

        # Batch insert buffers
        self._item_stats_buffer = []
        self._spell_criteria_buffer = []
        self._action_criteria_buffer = []

        # Load perk metadata once (class-level)
        self._load_perk_cache()

        # Statistics
        self.stats = {
            'items_created': 0,
            'items_updated': 0,
            'errors': 0,
            'start_time': time.time()
        }

    @classmethod
    def _load_perk_cache(cls):
        """Load perk metadata once at class level."""
        if cls._perk_cache_loaded:
            return

        try:
            backend_dir = Path(__file__).parent.parent.parent
            perks_file = backend_dir / "database" / "perks.json"

            with open(perks_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            cls._perk_data_cache = {}
            columns = data["columns"]
            indices = {col: columns.index(col) for col in columns}

            for row in data["values"]:
                aoid = row[indices["aoid"]]
                cls._perk_data_cache[aoid] = {
                    "name": row[indices["name"]],
                    "counter": row[indices["counter"]],
                    "type": row[indices["type"]],
                    "professions": row[indices.get("professions", -1)] or [],
                    "breeds": row[indices.get("breeds", -1)] or [],
                    "level": row[indices.get("level", -1)],
                    "aiTitle": row[indices.get("aiTitle", -1)]
                }

            cls._perk_cache_loaded = True
            logger.info(f"Loaded {len(cls._perk_data_cache)} perk metadata entries (cached)")

        except Exception as e:
            logger.error(f"Failed to load perk cache: {e}")
            cls._perk_data_cache = {}

    def preload_singletons(self, db: Session, data: List[Dict]):
        """
        Preload all singleton objects and create missing ones in batch.
        This ensures we have all StatValues and Criteria before processing items.
        """
        logger.info("Preloading singleton objects...")

        # Collect all unique values
        stat_values_needed = set()
        criteria_needed = set()

        for item in data:
            # StatValues from main item
            for sv in item.get('StatValues', []):
                stat_values_needed.add((sv.get('Stat'), sv.get('RawValue')))

            # StatValues from AttackDefense
            atkdef = item.get('AttackDefenseData')
            if atkdef:
                for atk in atkdef.get('Attack', []):
                    stat_values_needed.add((atk.get('Stat'), atk.get('RawValue')))
                for def_stat in atkdef.get('Defense', []):
                    stat_values_needed.add((def_stat.get('Stat'), def_stat.get('RawValue')))

            # StatValues from AnimationMesh
            animesh = item.get('AnimationMesh')
            if animesh:
                if animesh.get('Animation'):
                    stat_values_needed.add((
                        animesh['Animation'].get('Stat'),
                        animesh['Animation'].get('RawValue')
                    ))
                if animesh.get('Mesh'):
                    stat_values_needed.add((
                        animesh['Mesh'].get('Stat'),
                        animesh['Mesh'].get('RawValue')
                    ))

            # Criteria from Actions
            action_data = item.get('ActionData')
            if action_data and action_data.get('Actions'):
                for action in action_data['Actions']:
                    for criterion in action.get('Criteria', []):
                        criteria_needed.add((
                            criterion['Value1'],
                            criterion['Value2'],
                            criterion['Operator']
                        ))

            # Criteria from SpellData
            for spell_data in item.get('SpellData', []):
                for spell in spell_data.get('Items', []):
                    for criterion in spell.get('Criteria', []):
                        criteria_needed.add((
                            criterion['Value1'],
                            criterion['Value2'],
                            criterion['Operator']
                        ))

        # Load existing StatValues in batch
        existing_sv = db.query(StatValue).all()
        for sv in existing_sv:
            self._stat_value_cache[(sv.stat, sv.value)] = sv

        # Find missing StatValues
        missing_sv = []
        for stat, value in stat_values_needed:
            if (stat, value) not in self._stat_value_cache:
                missing_sv.append({'stat': stat, 'value': value})

        # Bulk insert missing StatValues
        if missing_sv:
            logger.info(f"Creating {len(missing_sv)} new StatValues...")
            db.bulk_insert_mappings(StatValue, missing_sv)
            db.commit()

            # Reload to get IDs
            for sv in db.query(StatValue).filter(
                StatValue.stat.in_([s['stat'] for s in missing_sv])
            ).all():
                self._stat_value_cache[(sv.stat, sv.value)] = sv

        # Load existing Criteria in batch
        existing_crit = db.query(Criterion).all()
        for crit in existing_crit:
            self._criterion_cache[(crit.value1, crit.value2, crit.operator)] = crit

        # Find missing Criteria
        missing_crit = []
        for v1, v2, op in criteria_needed:
            if (v1, v2, op) not in self._criterion_cache:
                missing_crit.append({'value1': v1, 'value2': v2, 'operator': op})

        # Bulk insert missing Criteria
        if missing_crit:
            logger.info(f"Creating {len(missing_crit)} new Criteria...")
            db.bulk_insert_mappings(Criterion, missing_crit)
            db.commit()

            # Reload to get IDs
            for crit in db.query(Criterion).filter(
                Criterion.value1.in_([c['value1'] for c in missing_crit])
            ).all():
                self._criterion_cache[(crit.value1, crit.value2, crit.operator)] = crit

        logger.info(f"Singleton preload complete: {len(self._stat_value_cache)} StatValues, "
                   f"{len(self._criterion_cache)} Criteria")

    def import_batch(self, db: Session, items_data: List[Dict], is_nano: bool = False):
        """
        Import a batch of items with optimized operations.

        Returns:
            Number of items successfully imported
        """
        success_count = 0

        # Process items but don't flush after each one
        created_items = []

        for item_data in items_data:
            try:
                aoid = item_data.get('AOID')
                if not aoid:
                    continue

                # Check for existing item
                existing = db.query(Item).filter(Item.aoid == aoid).first()

                if existing:
                    item = existing
                    self.stats['items_updated'] += 1
                else:
                    item = Item(
                        aoid=aoid,
                        name=item_data.get('Name', ''),
                        description=item_data.get('Description', ''),
                        is_nano=is_nano
                    )
                    created_items.append(item)
                    self.stats['items_created'] += 1

                # Extract ql and item_class from StatValues
                for sv_data in item_data.get('StatValues', []):
                    stat = sv_data.get('Stat')
                    value = sv_data.get('RawValue')
                    if stat == 76:  # Item class
                        item.item_class = value
                    elif stat == 54 and not is_nano:  # Quality level - only for regular items
                        item.ql = value

                # Set defaults
                item.ql = item.ql or 1
                item.item_class = item.item_class or 0

                if not existing:
                    db.add(item)

                success_count += 1

            except Exception as e:
                logger.error(f"Error processing item {item_data.get('Name', 'Unknown')}: {e}")
                self.stats['errors'] += 1

        # Bulk flush new items to get IDs
        if created_items:
            db.flush()

        # Now process relationships for all items in batch
        for item_data in items_data:
            aoid = item_data.get('AOID')
            if not aoid:
                continue

            item = db.query(Item).filter(Item.aoid == aoid).first()
            if not item:
                continue

            # Create perk if applicable
            if not is_nano and aoid in self._perk_data_cache:
                self._create_perk_batch(db, item, aoid)

            # Process relationships (these will be batched)
            self._process_item_stats_batch(item, item_data)
            self._process_attack_defense_batch(db, item, item_data)
            self._process_actions_batch(db, item, item_data)
            self._process_spell_data_batch(db, item, item_data)
            self._process_animation_mesh_batch(db, item, item_data)

        # Flush relationship buffers
        self._flush_buffers(db)

        return success_count

    def _create_perk_batch(self, db: Session, item: Item, aoid: int):
        """Create perk record using cached metadata."""
        try:
            perk_data = self._perk_data_cache.get(aoid)
            if not perk_data:
                return

            # Map professions and breeds
            profession_ids = []
            for prof_name in perk_data["professions"]:
                try:
                    profession_ids.append(perk_validator.map_profession_to_id(prof_name))
                except ValueError:
                    pass

            breed_ids = []
            for breed_name in perk_data["breeds"]:
                try:
                    breed_ids.append(perk_validator.map_breed_to_id(breed_name))
                except ValueError:
                    pass

            # perk_name = f"{perk_data['name']} {perk_data['counter']}"

            perk = Perk(
                item_id=item.id,
                name=perk_data['name'],
                perk_series=perk_data["name"],
                counter=perk_validator.validate_counter(perk_data["counter"]),
                type=perk_validator.validate_perk_type(perk_data["type"]),
                level_required=perk_validator.parse_level_requirement(perk_data["level"]),
                ai_level_required=perk_validator.parse_level_requirement(perk_data["aiTitle"]),
                professions=profession_ids,
                breeds=breed_ids
            )
            db.add(perk)

        except Exception as e:
            logger.warning(f"Failed to create perk for AOID {aoid}: {e}")

    def _process_item_stats_batch(self, item: Item, item_data: Dict):
        """Buffer item stats for batch insert."""
        seen = set()
        for sv_data in item_data.get('StatValues', []):
            stat_value = self._stat_value_cache.get((
                sv_data.get('Stat'),
                sv_data.get('RawValue')
            ))
            if stat_value and stat_value.id not in seen:
                self._item_stats_buffer.append({
                    'item_id': item.id,
                    'stat_value_id': stat_value.id
                })
                seen.add(stat_value.id)

    def _process_attack_defense_batch(self, db: Session, item: Item, item_data: Dict):
        """Process AttackDefense data with batching."""
        atkdef_data = item_data.get('AttackDefenseData')
        if not atkdef_data:
            return

        atkdef = AttackDefense()
        db.add(atkdef)
        db.flush()  # Need ID immediately

        # Process attack stats
        seen = set()
        for atk_data in atkdef_data.get('Attack', []):
            stat_value = self._stat_value_cache.get((
                atk_data.get('Stat'),
                atk_data.get('RawValue')
            ))
            if stat_value and stat_value.id not in seen:
                attack = AttackDefenseAttack(
                    attack_defense_id=atkdef.id,
                    stat_value_id=stat_value.id
                )
                db.add(attack)
                seen.add(stat_value.id)

        # Process defense stats
        seen = set()
        for def_data in atkdef_data.get('Defense', []):
            stat_value = self._stat_value_cache.get((
                def_data.get('Stat'),
                def_data.get('RawValue')
            ))
            if stat_value and stat_value.id not in seen:
                defense = AttackDefenseDefense(
                    attack_defense_id=atkdef.id,
                    stat_value_id=stat_value.id
                )
                db.add(defense)
                seen.add(stat_value.id)

        item.atkdef_id = atkdef.id

    def _process_actions_batch(self, db: Session, item: Item, item_data: Dict):
        """Process actions with batching."""
        action_data = item_data.get('ActionData')
        if not action_data or not action_data.get('Actions'):
            return

        for action_info in action_data['Actions']:
            action = Action(
                action=action_info.get('Action'),
                item_id=item.id
            )
            db.add(action)
            db.flush()  # Need ID

            # Buffer criteria
            order = 0
            for crit_data in action_info.get('Criteria', []):
                criterion = self._criterion_cache.get((
                    crit_data['Value1'],
                    crit_data['Value2'],
                    crit_data['Operator']
                ))
                if criterion:
                    self._action_criteria_buffer.append({
                        'action_id': action.id,
                        'criterion_id': criterion.id,
                        'order_index': order
                    })
                    order += 1

    def _process_spell_data_batch(self, db: Session, item: Item, item_data: Dict):
        """Process spell data with batching."""
        for spell_data in item_data.get('SpellData', []):
            spell_data_obj = SpellData(event=spell_data.get('Event'))
            db.add(spell_data_obj)
            db.flush()  # Need ID

            # Link to item
            item_spell = ItemSpellData(
                item_id=item.id,
                spell_data_id=spell_data_obj.id
            )
            db.add(item_spell)

            for spell_info in spell_data.get('Items', []):
                spell = Spell(
                    spell_id=spell_info.get('SpellID'),
                    target=spell_info.get('Target'),
                    tick_count=spell_info.get('TickCount'),
                    tick_interval=spell_info.get('TickInterval'),
                    spell_format=spell_info.get('SpellFormat'),
                    spell_params={k: v for k, v in spell_info.items()
                                 if k not in ['SpellID', 'Target', 'TickCount',
                                            'TickInterval', 'SpellFormat', 'Criteria']}
                )
                db.add(spell)
                db.flush()  # Need ID

                # Link spell to spell_data
                spell_data_spell = SpellDataSpells(
                    spell_data_id=spell_data_obj.id,
                    spell_id=spell.id
                )
                db.add(spell_data_spell)

                # Buffer criteria
                seen = set()
                for crit_data in spell_info.get('Criteria', []):
                    criterion = self._criterion_cache.get((
                        crit_data['Value1'],
                        crit_data['Value2'],
                        crit_data['Operator']
                    ))
                    if criterion and criterion.id not in seen:
                        self._spell_criteria_buffer.append({
                            'spell_id': spell.id,
                            'criterion_id': criterion.id
                        })
                        seen.add(criterion.id)

    def _process_animation_mesh_batch(self, db: Session, item: Item, item_data: Dict):
        """Process animation mesh data."""
        animesh_data = item_data.get('AnimationMesh')
        if not animesh_data:
            return

        animesh = AnimationMesh()

        # Set animation
        animation_data = animesh_data.get('Animation')
        if animation_data:
            stat_value = self._stat_value_cache.get((
                animation_data.get('Stat'),
                animation_data.get('RawValue')
            ))
            if stat_value:
                animesh.animation_id = stat_value.id

        # Set mesh
        mesh_data = animesh_data.get('Mesh')
        if mesh_data:
            stat_value = self._stat_value_cache.get((
                mesh_data.get('Stat'),
                mesh_data.get('RawValue')
            ))
            if stat_value:
                animesh.mesh_id = stat_value.id

        db.add(animesh)
        db.flush()
        item.animation_mesh_id = animesh.id

    def _flush_buffers(self, db: Session):
        """Flush all buffered relationship data."""
        # Bulk insert item_stats
        if self._item_stats_buffer:
            db.bulk_insert_mappings(ItemStats, self._item_stats_buffer)
            self._item_stats_buffer = []

        # Bulk insert spell_criteria
        if self._spell_criteria_buffer:
            db.bulk_insert_mappings(SpellCriterion, self._spell_criteria_buffer)
            self._spell_criteria_buffer = []

        # Bulk insert action_criteria
        if self._action_criteria_buffer:
            db.bulk_insert_mappings(ActionCriteria, self._action_criteria_buffer)
            self._action_criteria_buffer = []

    def import_items_from_json(self, file_path: str, is_nano: bool = False,
                              clear_existing: bool = False) -> Dict[str, Any]:
        """
        Main import method with optimizations.

        Returns:
            Import statistics
        """
        logger.info(f"Starting optimized import from {file_path}")
        self.stats['start_time'] = time.time()

        # Load data
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        logger.info(f"Loaded {len(data)} items")

        with self.SessionLocal() as db:
            if clear_existing:
                logger.info("Clearing existing data...")
                db.execute(text("TRUNCATE items CASCADE"))
                db.execute(text("TRUNCATE stat_values CASCADE"))
                db.execute(text("TRUNCATE criteria CASCADE"))
                db.execute(text("TRUNCATE perks CASCADE"))
                db.commit()

                # Clear caches
                self._stat_value_cache.clear()
                self._criterion_cache.clear()

            # Preload all singletons
            self.preload_singletons(db, data)

            # Process in batches
            total_items = len(data)
            processed = 0

            for i in range(0, total_items, self.batch_size):
                batch = data[i:i + self.batch_size]
                success = self.import_batch(db, batch, is_nano)
                processed += success

                # Commit batch
                db.commit()

                # Log progress
                elapsed = time.time() - self.stats['start_time']
                rate = processed / elapsed if elapsed > 0 else 0
                logger.info(f"Progress: {processed}/{total_items} items "
                          f"({rate:.1f} items/sec)")

            # Final statistics
            elapsed = time.time() - self.stats['start_time']
            self.stats['total_time'] = elapsed
            self.stats['items_per_second'] = processed / elapsed if elapsed > 0 else 0

            logger.info(f"Import complete: {processed} items in {elapsed:.1f}s "
                       f"({self.stats['items_per_second']:.1f} items/sec)")

        return self.stats