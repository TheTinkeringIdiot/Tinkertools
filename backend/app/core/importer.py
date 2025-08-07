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
    SpellDataSpells, ItemSpellData
)

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
    
    def get_db_session(self) -> Session:
        """Get database session."""
        return self.SessionLocal()
    
    def clear_existing_data(self, db: Session, clear_items: bool = False):
        """Clear existing data for fresh import."""
        logger.info("Clearing existing data...")
        
        if clear_items:
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
        
        for action_data in action_data['Actions']:
            action = Action(
                action=action_data.get('Action'),
                item_id=item.id
            )
            db.add(action)
            db.flush()
            
            # Process criteria (with deduplication by criterion_id)
            processed_criteria = set()
            current_order = 0
            
            for crit_data in action_data.get('Criteria', []):
                criterion = self._criterion_cache.get((
                    crit_data['Value1'],
                    crit_data['Value2'],
                    crit_data['Operator']
                ))
                if criterion and criterion.id not in processed_criteria:
                    action_criterion = ActionCriteria(
                        action_id=action.id,
                        criterion_id=criterion.id,
                        order_index=current_order
                    )
                    db.add(action_criterion)
                    processed_criteria.add(criterion.id)
                    current_order += 1
    
    def _process_spell_data(self, db: Session, item: Item, item_data: Dict):
        """Process SpellData."""
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
                              clear_existing: bool = False) -> ImportStats:
        """Import items from JSON file with chunked processing."""
        logger.info(f"Starting import from {file_path} (is_nano={is_nano})")
        
        with self.get_db_session() as db:
            if clear_existing:
                self.clear_existing_data(db, clear_items=True)
            
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
    
    def import_symbiants_from_csv(self, file_path: str, clear_existing: bool = False) -> int:
        """Import symbiants from CSV file."""
        logger.info(f"Starting symbiant import from {file_path}")
        
        count = 0
        with self.get_db_session() as db:
            if clear_existing:
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