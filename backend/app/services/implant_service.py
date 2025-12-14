"""
Implant Service for TinkerTools.

Handles implant lookup by slot, QL, and exact cluster combinations.
"""

from typing import List, Optional, Dict, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, Integer, cast, String, select
import logging

from app.models.item import Item, ItemStats, ItemSpellData
from app.models.stat_value import StatValue
from app.models.spell_data import SpellData, SpellDataSpells
from app.models.spell import Spell, SpellCriterion
from app.models.action import Action, ActionCriteria
from app.models.criterion import Criterion
from app.models.source import ItemSource, Source, SourceType
from app.services.interpolation import InterpolationService
from app.api.schemas.item import ItemDetail
from app.api.routes.items import build_item_detail

logger = logging.getLogger(__name__)


class ImplantService:
    """Service for implant-related operations."""
    
    # Valid implant slot bitflags (2^1 to 2^13)
    VALID_SLOT_BITFLAGS = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192]
    
    def __init__(self, db: Session):
        self.db = db
        self.interpolation_service = InterpolationService(db)
    
    def lookup_implant(
        self, 
        slot: int, 
        target_ql: int, 
        clusters: Dict[str, int]
    ) -> Optional[Tuple[ItemDetail, bool, int]]:
        """
        Look up an implant by slot, QL, and exact cluster combination.
        
        Args:
            slot: Numeric slot position (1-13)
            target_ql: Target quality level (1-300)
            clusters: Dict mapping position names to STAT IDs
            
        Returns:
            Tuple of (ItemDetail, was_interpolated, base_ql) or None if not found
        """
        # Validate slot bitflag
        if slot not in self.VALID_SLOT_BITFLAGS:
            logger.warning(f"Invalid implant slot bitflag: {slot}")
            return None
        
        # Determine base QL for efficient lookup
        base_ql = self._determine_base_ql(target_ql)
        
        # Find implant with exact cluster match
        implant_item = self._find_implant_with_clusters(slot, base_ql, clusters)
        
        if not implant_item:
            logger.info(f"No implant found for slot {slot}, QL {target_ql}, clusters {clusters}")
            return None
        
        # Check if interpolation is needed
        needs_interpolation = target_ql != implant_item.ql
        
        if needs_interpolation:
            # Use InterpolationService to get the item at target QL
            interpolated = self.interpolation_service.interpolate_item(implant_item.aoid, target_ql)
            if interpolated:
                # Convert InterpolatedItem to ItemDetail
                item_detail = self._convert_interpolated_to_detail(interpolated)
                return item_detail, True, base_ql
            else:
                # Fallback to original item if interpolation fails
                logger.warning(f"Interpolation failed for implant AOID {implant_item.aoid}, using base item")
        
        # Return original item
        item_detail = build_item_detail(implant_item, self.db)
        return item_detail, False, base_ql
    
    def _determine_base_ql(self, target_ql: int) -> int:
        """
        Determine the optimal base QL for lookup based on target QL.
        
        Implants are stored at QL 1, 200, 201, and 300.
        For efficiency:
        - Use QL 1 for target QL 1-200
        - Use QL 201 for target QL 201-300
        """
        if target_ql <= 200:
            return 1
        else:
            return 201
    
    def _find_implant_with_clusters(
        self,
        slot: int,
        base_ql: int,
        clusters: Dict[str, int]
    ) -> Optional[Item]:
        """
        Find an implant item with exact cluster match using optimized CTE-based query.

        Implant clusters are represented as spells with ID 53045 (Modify Stat) that modify
        specific skills. This method finds implants that have exactly the requested clusters
        and no extra ones.

        Args:
            slot: Numeric slot position
            base_ql: Base quality level to query
            clusters: Dict mapping position names to STAT IDs

        Returns:
            Item with exact cluster match or None
        """
        from sqlalchemy import text

        cluster_stats = list(clusters.values())
        cluster_count = len(cluster_stats)

        logger.info(f"Searching for implant: slot={slot}, base_ql={base_ql}, clusters={clusters}")

        if cluster_stats:
            # Use raw SQL with CTEs for optimal performance
            # Single query that PostgreSQL can optimize effectively
            cluster_list = ','.join(str(stat) for stat in cluster_stats)

            raw_query = text(f"""
                WITH implant_candidates AS (
                    -- Get all implants at the specified QL and slot
                    SELECT DISTINCT i.id
                    FROM items i
                    JOIN item_stats ist ON i.id = ist.item_id
                    JOIN stat_values sv ON ist.stat_value_id = sv.id
                    WHERE i.item_class = 3
                      AND i.ql = :base_ql
                      AND sv.stat = 298
                      AND (sv.value & :slot) > 0
                ),
                implant_clusters AS (
                    -- Get all Modify Stat spells for candidate implants
                    SELECT
                        ic.id as item_id,
                        (s.spell_params->>'Stat')::integer as cluster_stat
                    FROM implant_candidates ic
                    JOIN item_spell_data isd ON ic.id = isd.item_id
                    JOIN spell_data sd ON isd.spell_data_id = sd.id
                    JOIN spell_data_spells sds ON sd.id = sds.spell_data_id
                    JOIN spells s ON sds.spell_id = s.id
                    WHERE s.spell_id = 53045
                ),
                cluster_matches AS (
                    -- Count matching and non-matching clusters
                    SELECT
                        item_id,
                        COUNT(*) FILTER (WHERE cluster_stat IN ({cluster_list})) as matching_count,
                        COUNT(*) FILTER (WHERE cluster_stat NOT IN ({cluster_list})) as extra_count
                    FROM implant_clusters
                    GROUP BY item_id
                )
                -- Select items with exact cluster match
                SELECT i.*
                FROM items i
                JOIN cluster_matches cm ON i.id = cm.item_id
                WHERE cm.matching_count = :cluster_count
                  AND cm.extra_count = 0
                LIMIT 1
            """)

            result = self.db.execute(
                raw_query,
                {"base_ql": base_ql, "slot": slot, "cluster_count": cluster_count}
            ).first()

            if result:
                # Convert row to Item object with eager loading
                item = self.db.query(Item)\
                    .options(
                        joinedload(Item.item_stats).joinedload(ItemStats.stat_value),
                        joinedload(Item.item_spell_data).joinedload(ItemSpellData.spell_data)
                            .joinedload(SpellData.spell_data_spells).joinedload(SpellDataSpells.spell)
                            .joinedload(Spell.spell_criteria).joinedload(SpellCriterion.criterion),
                        joinedload(Item.actions).joinedload(Action.action_criteria).joinedload(ActionCriteria.criterion),
                        joinedload(Item.item_sources).joinedload(ItemSource.source).joinedload(Source.source_type)
                    )\
                    .filter(Item.id == result.id)\
                    .first()
                logger.info(f"Found implant: AOID={item.aoid}, name='{item.name}', QL={item.ql}")
                return item
            else:
                logger.info(f"No implant found with exact cluster match")
                return None
        else:
            # Handle case where no clusters specified (basic implants with no Modify Stat spells)
            # Use optimized raw SQL
            raw_query = text("""
                WITH implant_candidates AS (
                    -- Get all implants at the specified QL and slot
                    SELECT DISTINCT i.id
                    FROM items i
                    JOIN item_stats ist ON i.id = ist.item_id
                    JOIN stat_values sv ON ist.stat_value_id = sv.id
                    WHERE i.item_class = 3
                      AND i.ql = :base_ql
                      AND sv.stat = 298
                      AND (sv.value & :slot) > 0
                ),
                implants_with_clusters AS (
                    -- Get implants that have any Modify Stat spells
                    SELECT DISTINCT ic.id
                    FROM implant_candidates ic
                    JOIN item_spell_data isd ON ic.id = isd.item_id
                    JOIN spell_data sd ON isd.spell_data_id = sd.id
                    JOIN spell_data_spells sds ON sd.id = sds.spell_data_id
                    JOIN spells s ON sds.spell_id = s.id
                    WHERE s.spell_id = 53045
                )
                -- Select implants without any clusters
                SELECT i.*
                FROM items i
                JOIN implant_candidates ic ON i.id = ic.id
                WHERE i.id NOT IN (SELECT id FROM implants_with_clusters)
                LIMIT 1
            """)

            result = self.db.execute(
                raw_query,
                {"base_ql": base_ql, "slot": slot}
            ).first()

            if result:
                # Convert row to Item object with eager loading
                item = self.db.query(Item)\
                    .options(
                        joinedload(Item.item_stats).joinedload(ItemStats.stat_value),
                        joinedload(Item.item_spell_data).joinedload(ItemSpellData.spell_data)
                            .joinedload(SpellData.spell_data_spells).joinedload(SpellDataSpells.spell)
                            .joinedload(Spell.spell_criteria).joinedload(SpellCriterion.criterion),
                        joinedload(Item.actions).joinedload(Action.action_criteria).joinedload(ActionCriteria.criterion),
                        joinedload(Item.item_sources).joinedload(ItemSource.source).joinedload(Source.source_type)
                    )\
                    .filter(Item.id == result.id)\
                    .first()
                logger.info(f"Found implant: AOID={item.aoid}, name='{item.name}', QL={item.ql}")
                return item
            else:
                logger.info(f"No implant found without clusters")
                return None
    
    def _convert_interpolated_to_detail(self, interpolated_item) -> ItemDetail:
        """
        Convert an InterpolatedItem to ItemDetail format.
        
        Args:
            interpolated_item: InterpolatedItem from interpolation service
            
        Returns:
            ItemDetail object
        """
        from app.api.schemas.spell import SpellDataResponse, SpellWithCriteria
        from app.api.schemas.action import ActionResponse
        from app.api.schemas.criterion import CriterionResponse
        
        # Convert InterpolatedSpellData to SpellDataResponse format
        converted_spell_data = []
        for idx, spell_data in enumerate(interpolated_item.spell_data or []):
            # Convert InterpolatedSpell objects to SpellWithCriteria
            converted_spells = []
            for spell_idx, spell in enumerate(spell_data.spells):
                # Convert criteria dicts to CriterionResponse objects
                converted_criteria = []
                for criteria_dict in spell.criteria:
                    converted_criteria.append(CriterionResponse(
                        id=0,  # Interpolated items don't have DB IDs
                        stat=criteria_dict.get('stat', 0),
                        value1=criteria_dict.get('value1', 0),
                        value2=criteria_dict.get('value2', 0),
                        operator=criteria_dict.get('operator', 0)
                    ))
                
                converted_spells.append(SpellWithCriteria(
                    id=0,  # Interpolated items don't have DB IDs
                    target=spell.target,
                    tick_count=spell.tick_count,
                    tick_interval=spell.tick_interval,
                    spell_id=spell.spell_id,
                    spell_format=spell.spell_format,
                    spell_params=spell.spell_params,
                    criteria=converted_criteria
                ))
            
            converted_spell_data.append(SpellDataResponse(
                id=0,  # Interpolated items don't have DB IDs
                event=spell_data.event,
                spells=converted_spells
            ))
        
        # Convert InterpolatedAction to ActionResponse format
        converted_actions = []
        for action in interpolated_item.actions or []:
            # Convert criteria dicts to CriterionResponse objects
            converted_criteria = []
            for criteria_dict in action.criteria:
                converted_criteria.append(CriterionResponse(
                    id=0,  # Interpolated items don't have DB IDs
                    stat=criteria_dict.get('stat', 0),
                    value1=criteria_dict.get('value1', 0),
                    value2=criteria_dict.get('value2', 0),
                    operator=criteria_dict.get('operator', 0)
                ))
            
            converted_actions.append(ActionResponse(
                id=0,  # Interpolated items don't have DB IDs
                item_id=interpolated_item.id,
                action=action.action,
                criteria=converted_criteria
            ))
        
        return ItemDetail(
            id=interpolated_item.id or 0,
            aoid=interpolated_item.aoid,
            name=interpolated_item.name,
            ql=interpolated_item.ql,
            item_class=interpolated_item.item_class,
            description=interpolated_item.description,
            is_nano=interpolated_item.is_nano,
            stats=interpolated_item.stats or [],
            spell_data=converted_spell_data,
            attack_stats=[],  # InterpolatedItem doesn't have separate attack_stats
            defense_stats=[],  # InterpolatedItem doesn't have separate defense_stats
            actions=converted_actions,
            sources=[]  # Sources not typically available in interpolated items
        )
    
    def get_available_implants_for_slot(self, slot: int, ql: int = 1) -> List[Item]:
        """
        Get all available implants for a specific slot.
        
        Args:
            slot: Numeric slot position
            ql: Quality level to query (default: 1)
            
        Returns:
            List of Item objects for the slot
        """
        if slot not in self.VALID_SLOT_BITFLAGS:
            return []
        
        # Basic query for implants at specified QL
        query = self.db.query(Item)\
            .filter(Item.item_class == 3)\
            .filter(Item.ql == ql)\
            .order_by(Item.name)
        
        # TODO: Add proper slot filtering when slot data is available
        # For now, return all implants at the specified QL
        
        return query.all()
    
    def validate_cluster_combination(self, clusters: Dict[str, int]) -> bool:
        """
        Validate if a cluster combination is theoretically possible.
        
        Args:
            clusters: Dict mapping position names to STAT IDs
            
        Returns:
            True if the combination could exist
        """
        # Basic validation - ensure positions are valid
        valid_positions = {"Shiny", "Bright", "Faded"}
        
        for position in clusters.keys():
            if position not in valid_positions:
                return False
        
        # Additional validation logic could be added here
        # (e.g., checking if certain STAT combinations are impossible)
        
        return True