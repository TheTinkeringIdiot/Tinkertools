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
from app.models.spell import Spell
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
        Find an implant item with exact cluster match.
        
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
        cluster_stats = list(clusters.values())
        cluster_count = len(cluster_stats)
        
        logger.info(f"Searching for implant: slot={slot}, base_ql={base_ql}, clusters={clusters}")
        
        # Build base query for implants
        query = self.db.query(Item)\
            .filter(Item.item_class == 3)\
            .filter(Item.ql == base_ql)
        
        # Filter to implants that have exactly the required clusters via spells
        if cluster_stats:
            # Subquery: Items that have all required clusters via Modify Stat spells (53045)
            has_all_clusters = self.db.query(Item.id)\
                .join(ItemSpellData, Item.id == ItemSpellData.item_id)\
                .join(SpellData, ItemSpellData.spell_data_id == SpellData.id)\
                .join(SpellDataSpells, SpellData.id == SpellDataSpells.spell_data_id)\
                .join(Spell, SpellDataSpells.spell_id == Spell.id)\
                .filter(Item.item_class == 3)\
                .filter(Item.ql == base_ql)\
                .filter(Spell.spell_id == 53045)\
                .filter(cast(Spell.spell_params['Stat'], String).cast(Integer).in_(cluster_stats))\
                .group_by(Item.id)\
                .having(func.count(Spell.id.distinct()) == cluster_count)\
                .subquery()

            # Subquery: Items that have NO extra clusters (other Modify Stat spells not in our list)
            # First get items with extra clusters
            items_with_extra_clusters = self.db.query(Item.id)\
                .join(ItemSpellData, Item.id == ItemSpellData.item_id)\
                .join(SpellData, ItemSpellData.spell_data_id == SpellData.id)\
                .join(SpellDataSpells, SpellData.id == SpellDataSpells.spell_data_id)\
                .join(Spell, SpellDataSpells.spell_id == Spell.id)\
                .filter(Item.item_class == 3)\
                .filter(Item.ql == base_ql)\
                .filter(Spell.spell_id == 53045)\
                .filter(~cast(Spell.spell_params['Stat'], String).cast(Integer).in_(cluster_stats))\
                .distinct()\
                .subquery()

            # Then create subquery for items WITHOUT extra clusters
            has_no_extra_clusters = self.db.query(Item.id)\
                .filter(Item.item_class == 3)\
                .filter(Item.ql == base_ql)\
                .filter(~Item.id.in_(select(items_with_extra_clusters.c.id)))\
                .subquery()

            # Combine conditions: must have all required clusters and no extra ones
            query = query.filter(Item.id.in_(select(has_all_clusters.c.id)))\
                         .filter(Item.id.in_(select(has_no_extra_clusters.c.id)))
        else:
            # Handle case where no clusters specified (basic implants with no Modify Stat spells)
            # First get items that have any Modify Stat spells
            items_with_modify_stat = self.db.query(Item.id)\
                .join(ItemSpellData, Item.id == ItemSpellData.item_id)\
                .join(SpellData, ItemSpellData.spell_data_id == SpellData.id)\
                .join(SpellDataSpells, SpellData.id == SpellDataSpells.spell_data_id)\
                .join(Spell, SpellDataSpells.spell_id == Spell.id)\
                .filter(Item.item_class == 3)\
                .filter(Item.ql == base_ql)\
                .filter(Spell.spell_id == 53045)\
                .distinct()\
                .subquery()

            # Then filter to items WITHOUT Modify Stat spells
            query = query.filter(~Item.id.in_(select(items_with_modify_stat.c.id)))
        
        # Filter by slot using stat 298 (Slot) with bitwise AND operation
        # The slot parameter should be a bitflag value (e.g., 32 for chest)
        slot_filter_query = self.db.query(Item.id)\
            .join(ItemStats, Item.id == ItemStats.item_id)\
            .join(StatValue, ItemStats.stat_value_id == StatValue.id)\
            .filter(StatValue.stat == 298)\
            .filter(StatValue.value.op('&')(slot) > 0)\
            .subquery()

        query = query.filter(Item.id.in_(select(slot_filter_query.c.id)))
        
        # Execute query and get first result
        result = query.first()
        
        if result:
            logger.info(f"Found implant: AOID={result.aoid}, name='{result.name}', QL={result.ql}")
        else:
            logger.info(f"No implant found with exact cluster match")
        
        return result
    
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