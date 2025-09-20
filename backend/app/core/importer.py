"""
Data import utilities for TinkerTools.

Handles importing items, nanos, and symbiants from JSON/CSV files
with chunked processing for large datasets.
"""

import json
import csv
import logging
import os
from typing import Dict, List, Any, Optional, Tuple, Iterator
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
import time

# Import models directly
import sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from app.models import (
    Item, StatValue, Criterion, Spell, SpellData, AttackDefense,
    AnimationMesh, Action, ActionCriteria, SpellCriterion,
    ItemStats, Symbiant, AttackDefenseAttack, AttackDefenseDefense,
    SpellDataSpells, ItemSpellData, Perk
)
from app.core import perk_validator
from app.core.migration_runner import MigrationRunner

logger = logging.getLogger(__name__)


class ImportStats:
    """Track import statistics."""
    
    def __init__(self):
        self.items_created = 0
        self.items_updated = 0
        self.items_skipped = 0
        self.stat_values_created = 0
        self.criteria_created = 0
        self.errors = 0
        self.start_time = time.time()
    
    def log_progress(self, chunk_num: int, chunk_size: int):
        """Log current progress."""
        elapsed = time.time() - self.start_time
        total_processed = chunk_num * chunk_size
        rate = total_processed / elapsed if elapsed > 0 else 0
        
        logger.info(
            f"Chunk {chunk_num}: {total_processed} items processed, "
            f"Rate: {rate:.1f} items/sec, "
            f"Created: {self.items_created}, Updated: {self.items_updated}, "
            f"Errors: {self.errors}"
        )


class DataImporter:
    """Main data import class."""
    
    def __init__(self, db_url: str = None, chunk_size: int = 100):
        self.chunk_size = chunk_size
        self.stats = ImportStats()
        
        # Get database URL from environment or parameter
        self.db_url = db_url or os.getenv("DATABASE_URL")
        if not self.db_url:
            raise ValueError("DATABASE_URL environment variable must be set or db_url parameter provided")
        
        # Create engine and session factory
        self.engine = create_engine(self.db_url)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        
        # Store singleton objects to avoid repeated DB queries
        self._stat_value_cache: Dict[Tuple[int, int], StatValue] = {}
        self._criterion_cache: Dict[Tuple[int, int, int], Criterion] = {}
        self._perk_data: Dict[int, Dict] = {}

        # Load perk metadata during initialization
        self.load_perk_metadata()
    
    def get_db_session(self) -> Session:
        """Get database session."""
        return self.SessionLocal()

    def load_perk_metadata(self):
        """Load perk metadata from perks.json file for O(1) lookup during import."""
        try:
            # Get the path to perks.json relative to the backend directory
            backend_dir = Path(__file__).parent.parent.parent
            perks_file = backend_dir / "database" / "perks.json"

            logger.info(f"Loading perk metadata from {perks_file}")

            with open(perks_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # Parse columnar format to extract full metadata
            columns = data["columns"]
            expected_columns = ["aoid", "name", "counter", "type", "professions", "breeds", "level", "aiTitle"]

            # Validate expected columns are present
            for col in expected_columns:
                if col not in columns:
                    raise ValueError(f"Missing expected column '{col}' in perks.json")

            # Get column indices
            column_indices = {col: columns.index(col) for col in expected_columns}

            # Process each perk row
            for row in data["values"]:
                try:
                    aoid = row[column_indices["aoid"]]
                    name = row[column_indices["name"]]
                    counter = row[column_indices["counter"]]
                    perk_type = row[column_indices["type"]]
                    professions = row[column_indices["professions"]]
                    breeds = row[column_indices["breeds"]]
                    level = row[column_indices["level"]]
                    ai_title = row[column_indices["aiTitle"]]

                    # Store full metadata for this perk
                    self._perk_data[aoid] = {
                        "name": name,
                        "counter": counter,
                        "type": perk_type,
                        "professions": professions or [],
                        "breeds": breeds or [],
                        "level": level,
                        "aiTitle": ai_title
                    }

                except (IndexError, TypeError) as e:
                    logger.warning(f"Skipping malformed perk row: {row}. Error: {e}")
                    continue

            logger.info(f"Loaded {len(self._perk_data)} perk metadata entries")

        except FileNotFoundError:
            error_msg = f"Critical error: perks.json file not found at {perks_file}. This file is required for perk identification."
            logger.error(error_msg)
            raise ValueError(error_msg)
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            error_msg = f"Critical error: Invalid perks.json format: {e}"
            logger.error(error_msg)
            raise ValueError(error_msg)
    
    def clear_existing_data(self, db: Session, clear_items: bool = False, full_reset: bool = False):
        """
        Clear existing data for fresh import.

        Args:
            db: Database session
            clear_items: If True, clear item-related data
            full_reset: If True, drop all tables and recreate from migrations
        """
        logger.info(f"Clearing existing data (full_reset={full_reset})...")

        if full_reset:
            # Use migration runner to drop all tables and recreate schema
            logger.info("Performing full database reset with migrations...")

            # Close current session as we'll be dropping tables
            db.close()

            # Create migration runner and reset database
            runner = MigrationRunner(db_url=self.db_url)
            success = runner.reset_database()

            if not success:
                raise RuntimeError("Failed to reset database with migrations")

            # Clear caches since we dropped everything
            self._stat_value_cache.clear()
            self._criterion_cache.clear()

            logger.info("Full database reset completed successfully")

        elif clear_items:
            # Original behavior: just delete data without dropping tables
            logger.info("Clearing data without dropping tables...")

            # Clear in correct order to respect foreign keys
            db.execute(text("DELETE FROM spell_criteria"))
            db.execute(text("DELETE FROM action_criteria"))
            db.execute(text("DELETE FROM item_stats"))
            db.execute(text("DELETE FROM spells"))
            db.execute(text("DELETE FROM spell_data"))
            db.execute(text("DELETE FROM actions"))
            db.execute(text("DELETE FROM items"))
            db.execute(text("DELETE FROM attack_defense"))
            db.execute(text("DELETE FROM animation_mesh"))
            db.execute(text("DELETE FROM stat_values"))
            db.execute(text("DELETE FROM criteria"))
            db.execute(text("DELETE FROM perks"))  # Add perks table
            db.commit()

            logger.info("Data cleared successfully")
    
    def preprocess_singletons(self, data: List[Dict]) -> Tuple[List[Tuple[int, int]], List[Tuple[int, int, int]]]:
        """Extract all unique StatValues and Criteria from data for bulk creation."""
        stat_values = set()
        criteria = set()
        
        logger.info("Preprocessing singleton objects...")
        
        for idx, item in enumerate(data):
            if idx % 1000 == 0:
                logger.info(f"Preprocessing item {idx}/{len(data)}")
            
            # Extract StatValues
            for sv in item.get('StatValues', []):
                stat_values.add((sv.get('Stat'), sv.get('RawValue')))
            
            # Extract from AttackDefenseData
            atkdef = item.get('AttackDefenseData')
            if atkdef:
                for atk in atkdef.get('Attack', []):
                    stat_values.add((atk.get('Stat'), atk.get('RawValue')))
                for def_stat in atkdef.get('Defense', []):
                    stat_values.add((def_stat.get('Stat'), def_stat.get('RawValue')))
            
            # Extract from AnimationMesh
            animesh = item.get('AnimationMesh')
            if animesh:
                animation = animesh.get('Animation')
                if animation:
                    stat_values.add((animation.get('Stat'), animation.get('RawValue')))
                mesh = animesh.get('Mesh')
                if mesh:
                    stat_values.add((mesh.get('Stat'), mesh.get('RawValue')))
            
            # Extract Criteria from ActionData
            action_data = item.get('ActionData')
            if action_data and action_data.get('Actions'):
                for action in action_data['Actions']:
                    for criterion in action.get('Criteria', []):
                        criteria.add((
                            criterion['Value1'],
                            criterion['Value2'],
                            criterion['Operator']
                        ))
            
            # Extract Criteria from SpellData
            for spell_data in item.get('SpellData', []):
                for spell in spell_data.get('Items', []):
                    for criterion in spell.get('Criteria', []):
                        criteria.add((
                            criterion['Value1'],
                            criterion['Value2'],
                            criterion['Operator']
                        ))
        
        return list(stat_values), list(criteria)
    
    def bulk_create_singletons(self, db: Session, stat_values: List[Tuple[int, int]], 
                             criteria: List[Tuple[int, int, int]]):
        """Bulk create or get existing StatValues and Criteria."""
        logger.info(f"Creating/getting {len(stat_values)} StatValues and {len(criteria)} Criteria...")
        
        # Get or create StatValues
        created_count = 0
        for stat, value in stat_values:
            # Check if already in cache
            if (stat, value) in self._stat_value_cache:
                continue
                
            # Check if exists in database
            existing = db.query(StatValue).filter(
                StatValue.stat == stat,
                StatValue.value == value
            ).first()
            
            if existing:
                self._stat_value_cache[(stat, value)] = existing
            else:
                # Create new one
                sv = StatValue(stat=stat, value=value)
                db.add(sv)
                self._stat_value_cache[(stat, value)] = sv
                created_count += 1
        
        # Commit StatValues first
        db.commit()
        
        # Get or create Criteria
        criteria_created = 0
        for value1, value2, operator in criteria:
            # Check if already in cache
            if (value1, value2, operator) in self._criterion_cache:
                continue
                
            # Check if exists in database
            existing = db.query(Criterion).filter(
                Criterion.value1 == value1,
                Criterion.value2 == value2,
                Criterion.operator == operator
            ).first()
            
            if existing:
                self._criterion_cache[(value1, value2, operator)] = existing
            else:
                # Create new one
                crit = Criterion(value1=value1, value2=value2, operator=operator)
                db.add(crit)
                self._criterion_cache[(value1, value2, operator)] = crit
                criteria_created += 1
        
        # Commit Criteria
        db.commit()
        
        self.stats.stat_values_created = created_count
        self.stats.criteria_created = criteria_created
        
        logger.info(f"Created {created_count} new StatValues and {criteria_created} new Criteria")
    
    def _update_singleton_cache(self, db: Session):
        """Update singleton cache with database IDs."""
        # Update StatValue cache
        for sv in db.query(StatValue).all():
            if (sv.stat, sv.value) in self._stat_value_cache:
                self._stat_value_cache[(sv.stat, sv.value)] = sv
        
        # Update Criterion cache
        for crit in db.query(Criterion).all():
            if (crit.value1, crit.value2, crit.operator) in self._criterion_cache:
                self._criterion_cache[(crit.value1, crit.value2, crit.operator)] = crit
    
    def import_item(self, db: Session, item_data: Dict, is_nano: bool = False) -> Optional[Item]:
        """Import a single item."""
        try:
            aoid = item_data.get('AOID')
            if not aoid:
                logger.warning(f"Item missing AOID: {item_data.get('Name', 'Unknown')}")
                self.stats.items_skipped += 1
                return None
            
            # Get or create item
            item = db.query(Item).filter(Item.aoid == aoid).first()
            if item:
                logger.debug(f"Updating existing item: {item.name}")
                self.stats.items_updated += 1
            else:
                item = Item(aoid=aoid)
                self.stats.items_created += 1
            
            # Set basic properties
            item.name = item_data.get('Name', '')
            item.description = item_data.get('Description', '')
            item.is_nano = is_nano

            
            # Process StatValues to extract item_class and ql
            for sv_data in item_data.get('StatValues', []):
                stat = sv_data.get('Stat')
                value = sv_data.get('RawValue')
                
                if stat == 76:  # Item class
                    item.item_class = value
                elif stat == 54:  # Quality level
                    item.ql = value
            
            # Set defaults if not found
            if item.ql is None:
                item.ql = 1
            if item.item_class is None:
                item.item_class = 0
            
            db.add(item)
            db.flush()  # Get the ID

            # Create perk record if this item is a perk
            if not is_nano and aoid in self._perk_data:
                self._create_perk_record(db, item, aoid)

            # Process StatValues relationships
            self._process_item_stats(db, item, item_data)
            
            # Process AttackDefenseData
            self._process_attack_defense(db, item, item_data)
            
            # Process ActionData
            self._process_actions(db, item, item_data)
            
            # Process SpellData
            self._process_spell_data(db, item, item_data)
            
            # Process AnimationMesh
            self._process_animation_mesh(db, item, item_data)
            
            return item
            
        except Exception as e:
            logger.error(f"Error importing item {item_data.get('Name', 'Unknown')}: {e}")
            self.stats.errors += 1
            return None

    def _create_perk_record(self, db: Session, item: Item, aoid: int):
        """Create a perk record for the given item using metadata from perks.json."""
        try:
            perk_data = self._perk_data[aoid]

            # Extract base perk series name (name without counter)
            perk_series = perk_data["name"]

            # Validate and map profession strings to IDs
            profession_ids = []
            for prof_name in perk_data["professions"]:
                try:
                    profession_ids.append(perk_validator.map_profession_to_id(prof_name))
                except ValueError as e:
                    logger.warning(f"Failed to map profession '{prof_name}' for perk AOID {aoid}: {e}")

            # Validate and map breed strings to IDs
            breed_ids = []
            for breed_name in perk_data["breeds"]:
                try:
                    breed_ids.append(perk_validator.map_breed_to_id(breed_name))
                except ValueError as e:
                    logger.warning(f"Failed to map breed '{breed_name}' for perk AOID {aoid}: {e}")

            # Validate and parse other fields
            try:
                counter = perk_validator.validate_counter(perk_data["counter"])
                perk_type = perk_validator.validate_perk_type(perk_data["type"])
                level_required = perk_validator.parse_level_requirement(perk_data["level"])
                ai_level_required = perk_validator.parse_level_requirement(perk_data["aiTitle"])
            except ValueError as e:
                logger.warning(f"Validation failed for perk AOID {aoid}: {e}")
                return

            # Format full perk name (e.g., "Accumulator 1")
            perk_name = f"{perk_series} {counter}"

            # Create perk record
            perk = Perk(
                item_id=item.id,
                name=perk_name,
                perk_series=perk_series,
                counter=counter,
                type=perk_type,
                level_required=level_required,
                ai_level_required=ai_level_required,
                professions=profession_ids,
                breeds=breed_ids
            )

            db.add(perk)
            logger.debug(f"Created perk record: {perk_name}")

        except Exception as e:
            logger.warning(f"Failed to create perk record for AOID {aoid}: {e}")

    def _process_item_stats(self, db: Session, item: Item, item_data: Dict):
        """Process item stats relationships, handling duplicates."""
        # First, clear existing stats for this item (in case of update)
        db.query(ItemStats).filter(ItemStats.item_id == item.id).delete()
        
        # Use a set to track unique stat_value_ids for this item
        processed_stat_values = set()
        
        for sv_data in item_data.get('StatValues', []):
            stat = sv_data.get('Stat')
            value = sv_data.get('RawValue')
            
            stat_value = self._stat_value_cache.get((stat, value))
            if stat_value and stat_value.id not in processed_stat_values:
                # Create ItemStats relationship only if not already processed
                item_stat = ItemStats(item_id=item.id, stat_value_id=stat_value.id)
                db.add(item_stat)
                processed_stat_values.add(stat_value.id)
    
    def _process_attack_defense(self, db: Session, item: Item, item_data: Dict):
        """Process AttackDefenseData."""
        atkdef_data = item_data.get('AttackDefenseData')
        if not atkdef_data:
            return
        
        atkdef = AttackDefense()
        db.add(atkdef)
        db.flush()
        
        # Process attack stats (with deduplication)
        processed_attack_stats = set()
        for atk_data in atkdef_data.get('Attack', []):
            stat = atk_data.get('Stat')
            value = atk_data.get('RawValue')
            stat_value = self._stat_value_cache.get((stat, value))
            if stat_value and stat_value.id not in processed_attack_stats:
                attack_stat = AttackDefenseAttack(
                    attack_defense_id=atkdef.id,
                    stat_value_id=stat_value.id
                )
                db.add(attack_stat)
                processed_attack_stats.add(stat_value.id)
        
        # Process defense stats (with deduplication)
        processed_defense_stats = set()
        for def_data in atkdef_data.get('Defense', []):
            stat = def_data.get('Stat')
            value = def_data.get('RawValue')
            stat_value = self._stat_value_cache.get((stat, value))
            if stat_value and stat_value.id not in processed_defense_stats:
                defense_stat = AttackDefenseDefense(
                    attack_defense_id=atkdef.id,
                    stat_value_id=stat_value.id
                )
                db.add(defense_stat)
                processed_defense_stats.add(stat_value.id)
        
        item.atkdef_id = atkdef.id
    
    def _process_actions(self, db: Session, item: Item, item_data: Dict):
        """Process ActionData."""
        action_data = item_data.get('ActionData')
        if not action_data or not action_data.get('Actions'):
            return
        
        # First, clear existing actions for this item (in case of update)
        db.query(Action).filter(Action.item_id == item.id).delete()
        
        for action_data in action_data['Actions']:
            action = Action(
                action=action_data.get('Action'),
                item_id=item.id
            )
            db.add(action)
            db.flush()
            
            # Process criteria (allowing duplicates)
            current_order = 0
            
            for crit_data in action_data.get('Criteria', []):
                criterion = self._criterion_cache.get((
                    crit_data['Value1'],
                    crit_data['Value2'],
                    crit_data['Operator']
                ))
                if criterion:
                    action_criterion = ActionCriteria(
                        action_id=action.id,
                        criterion_id=criterion.id,
                        order_index=current_order
                    )
                    db.add(action_criterion)
                    current_order += 1
    
    def _process_spell_data(self, db: Session, item: Item, item_data: Dict):
        """Process SpellData."""
        # First, clear existing spell_data relationships for this item (in case of update)
        db.query(ItemSpellData).filter(ItemSpellData.item_id == item.id).delete()
        
        for spell_data in item_data.get('SpellData', []):
            spell_data_obj = SpellData(
                event=spell_data.get('Event')
            )
            db.add(spell_data_obj)
            db.flush()
            
            # Create the item-spelldata relationship
            item_spell_data = ItemSpellData(
                item_id=item.id,
                spell_data_id=spell_data_obj.id
            )
            db.add(item_spell_data)
            
            for spell_info in spell_data.get('Items', []):
                spell = Spell(
                    spell_id=spell_info.get('SpellID'),
                    target=spell_info.get('Target'),
                    tick_count=spell_info.get('TickCount'),
                    tick_interval=spell_info.get('TickInterval'),
                    spell_format=spell_info.get('SpellFormat'),
                    spell_params=spell_info.copy()  # Store full params as JSON
                )
                
                # Clean spell_params of fields we store separately
                for field in ['SpellID', 'Target', 'TickCount', 'TickInterval', 'SpellFormat', 'Criteria']:
                    spell.spell_params.pop(field, None)
                
                db.add(spell)
                db.flush()
                
                # Create the spelldata-spell relationship
                spell_data_spell = SpellDataSpells(
                    spell_data_id=spell_data_obj.id,
                    spell_id=spell.id
                )
                db.add(spell_data_spell)
                
                # Process spell criteria (with deduplication)
                processed_spell_criteria = set()
                for crit_data in spell_info.get('Criteria', []):
                    criterion = self._criterion_cache.get((
                        crit_data['Value1'],
                        crit_data['Value2'],
                        crit_data['Operator']
                    ))
                    if criterion and criterion.id not in processed_spell_criteria:
                        spell_criterion = SpellCriterion(
                            spell_id=spell.id,
                            criterion_id=criterion.id
                        )
                        db.add(spell_criterion)
                        processed_spell_criteria.add(criterion.id)
    
    def _process_animation_mesh(self, db: Session, item: Item, item_data: Dict):
        """Process AnimationMesh."""
        animesh_data = item_data.get('AnimationMesh')
        if not animesh_data:
            return
        
        animesh = AnimationMesh()
        db.add(animesh)
        db.flush()
        
        # Process animation
        animation_data = animesh_data.get('Animation')
        if animation_data:
            stat_value = self._stat_value_cache.get((
                animation_data.get('Stat'),
                animation_data.get('RawValue')
            ))
            if stat_value:
                animesh.animation_id = stat_value.id
        
        # Process mesh
        mesh_data = animesh_data.get('Mesh')
        if mesh_data:
            stat_value = self._stat_value_cache.get((
                mesh_data.get('Stat'),
                mesh_data.get('RawValue')
            ))
            if stat_value:
                animesh.mesh_id = stat_value.id
        
        item.animation_mesh_id = animesh.id
    
    def import_items_from_json(self, file_path: str, is_nano: bool = False,
                              clear_existing: bool = False, full_reset: bool = False) -> ImportStats:
        """
        Import items from JSON file with chunked processing.

        Args:
            file_path: Path to JSON file to import
            is_nano: Whether importing nano programs
            clear_existing: Clear existing data before import
            full_reset: Drop all tables and recreate from migrations before import
        """
        logger.info(f"Starting import from {file_path} (is_nano={is_nano}, full_reset={full_reset})")

        # Handle full reset if requested
        if full_reset:
            # Do the full reset outside of session context
            runner = MigrationRunner(db_url=self.db_url)
            success = runner.reset_database()
            if not success:
                raise RuntimeError("Failed to reset database with migrations")
            # Clear caches
            self._stat_value_cache.clear()
            self._criterion_cache.clear()

        with self.get_db_session() as db:
            if clear_existing and not full_reset:
                # Only clear data if not doing full reset (which already cleared everything)
                self.clear_existing_data(db, clear_items=True, full_reset=False)
            
            # Load and process data
            logger.info("Loading JSON data...")
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            logger.info(f"Loaded {len(data)} items")
            
            # Preprocess singletons
            stat_values, criteria = self.preprocess_singletons(data)
            self.bulk_create_singletons(db, stat_values, criteria)
            
            # Process items in chunks
            chunks = [data[i:i + self.chunk_size] for i in range(0, len(data), self.chunk_size)]
            
            for chunk_num, chunk in enumerate(chunks, 1):
                try:
                    for item_data in chunk:
                        self.import_item(db, item_data, is_nano)
                    
                    db.commit()
                    self.stats.log_progress(chunk_num, self.chunk_size)
                    
                except Exception as e:
                    logger.error(f"Error processing chunk {chunk_num}: {e}")
                    db.rollback()
                    self.stats.errors += len(chunk)
        
        elapsed = time.time() - self.stats.start_time
        logger.info(f"Import completed in {elapsed:.1f}s. "
                   f"Created: {self.stats.items_created}, "
                   f"Updated: {self.stats.items_updated}, "
                   f"Errors: {self.stats.errors}")
        
        return self.stats
    
    def import_symbiants_from_csv(self, file_path: str, clear_existing: bool = False, full_reset: bool = False) -> int:
        """
        Import symbiants from CSV file.

        Args:
            file_path: Path to CSV file to import
            clear_existing: Clear existing symbiant data before import
            full_reset: Drop all tables and recreate from migrations before import
        """
        logger.info(f"Starting symbiant import from {file_path} (full_reset={full_reset})")

        # Handle full reset if requested
        if full_reset:
            runner = MigrationRunner(db_url=self.db_url)
            success = runner.reset_database()
            if not success:
                raise RuntimeError("Failed to reset database with migrations")

        count = 0
        with self.get_db_session() as db:
            if clear_existing and not full_reset:
                db.query(Symbiant).delete()
                db.commit()
            
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                
                symbiants = []
                for row in reader:
                    symbiant = Symbiant(
                        aoid=int(row.get('aoid', 0)),
                        family=row.get('family', '')
                    )
                    symbiants.append(symbiant)
                    count += 1
                    
                    # Batch insert
                    if len(symbiants) >= self.chunk_size:
                        db.bulk_save_objects(symbiants)
                        db.commit()
                        symbiants = []
                        logger.info(f"Imported {count} symbiants...")
                
                # Insert remaining
                if symbiants:
                    db.bulk_save_objects(symbiants)
                    db.commit()
        
        logger.info(f"Symbiant import completed. Imported {count} symbiants.")
        return count

