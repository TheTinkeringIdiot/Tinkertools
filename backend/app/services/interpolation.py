"""
Item Interpolation Service for TinkerTools.

This service implements the core interpolation logic from the legacy InterpItem.py,
allowing calculation of item stats, spells, and criteria at specific quality levels
between discrete database entries.
"""

from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_

from app.models.item import Item, ItemStats, ItemSpellData, ItemShopHash
from app.models.stat_value import StatValue
from app.models.criterion import Criterion
from app.models.spell import Spell, SpellCriterion
from app.models.spell_data import SpellData, SpellDataSpells
from app.models.action import Action, ActionCriteria
from app.models.interpolated_item import (
    InterpolatedItem, 
    InterpolatedAction, 
    InterpolatedSpellData, 
    InterpolatedSpell
)


class InterpolationService:
    """
    Service for interpolating item data at specific quality levels.
    """
    
    # Stats that should be interpolated (from legacy INTERP_STATS)
    INTERP_STATS = {
        1, 2, 3, 8, 16, 17, 18, 19, 20, 21, 22, 27, 29, 36, 37, 54, 61, 71, 74, 90, 91, 92, 93, 94, 95, 96, 97, 100, 101, 102, 103, 104, 105,
        106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133,
        134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161,
        162, 163, 164, 165, 166, 167, 168, 201, 204, 205, 206, 207, 208, 214, 216, 217, 218, 219, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234,
        238, 239, 240, 241, 242, 243, 244, 245, 276, 277, 278, 279, 280, 281, 282, 284, 285, 286, 287, 294, 311, 315, 316, 317, 318, 319, 343, 364,
        374, 375, 379, 380, 381, 382, 383, 475, 476, 477, 478, 479, 480, 481, 482, 483
    }
    
    # Spell IDs that have interpolatable parameters
    INTERPOLATABLE_SPELLS = {
        53012, 53014, 53045, 53175,  # Stat | Amount
        53026, 53028,                # Skill | Amount
        53184, 53237                 # Stat | Percent
    }

    def __init__(self, db: Session):
        self.db = db

    def interpolate_item(self, aoid: int, target_ql: int) -> Optional[InterpolatedItem]:
        """
        Main interpolation function that creates an interpolated item at the target QL.
        
        Args:
            aoid: Anarchy Online ID of the item
            target_ql: Target quality level for interpolation
            
        Returns:
            InterpolatedItem or None if item not found
        """
        # Get the base item
        base_item = self.db.query(Item).filter(Item.aoid == aoid).first()
        if not base_item:
            return None

        # Find all variants of this item by name and description
        item_variants = self._find_item_variants(base_item.name, base_item.description)
        
        if not item_variants:
            return None

        # Check if interpolation is needed
        if (len(item_variants) == 1 or
            base_item.is_nano or
            'Control Point' in base_item.name):
            # No interpolation needed - return original item with target QL
            return self._create_non_interpolated_item(base_item, target_ql)

        # Find the appropriate low and high items for interpolation
        lo_item, hi_item = self._find_interpolation_bounds(item_variants, target_ql)
        
        if not lo_item:
            return None

        # Create the interpolated item
        return self._create_interpolated_item(lo_item, hi_item, target_ql)

    def get_interpolation_ranges(self, aoid: int) -> Optional[List[Dict[str, Any]]]:
        """
        Get interpolation ranges for an item.
        
        If an item has multiple variants, it creates ranges between consecutive
        variants that allow interpolation between them.
        
        Args:
            aoid: Anarchy Online ID of the item
            
        Returns:
            List of range dicts with min_ql, max_ql, interpolatable flags or None if item not found
        """
        base_item = self.db.query(Item).filter(Item.aoid == aoid).first()
        if not base_item:
            return None

        item_variants = self._find_item_variants(base_item.name, base_item.description)
        if not item_variants:
            return None
        
        # If only one variant, return single non-interpolatable range
        if len(item_variants) == 1:
            return [{
                "min_ql": item_variants[0].ql,
                "max_ql": item_variants[0].ql,
                "interpolatable": False,
                "base_aoid": item_variants[0].aoid
            }]
        
        # Create ranges between consecutive variants
        # All ranges with multiple variants are interpolatable
        ranges = []
        
        for i in range(len(item_variants)):
            if i < len(item_variants) - 1:
                # Create interpolatable range between current and next variant
                ranges.append({
                    "min_ql": item_variants[i].ql,
                    "max_ql": item_variants[i + 1].ql,
                    "interpolatable": True,
                    "base_aoid": item_variants[i].aoid
                })
            else:
                # Last item - only if it's not covered by the previous range
                if len(item_variants) == 1 or item_variants[i].ql > item_variants[i-1].ql:
                    ranges.append({
                        "min_ql": item_variants[i].ql,
                        "max_ql": item_variants[i].ql,
                        "interpolatable": False,
                        "base_aoid": item_variants[i].aoid
                    })
        
        return ranges

    def get_interpolation_range(self, aoid: int) -> Optional[Tuple[int, int]]:
        """
        Get the overall minimum and maximum quality levels available.
        
        Args:
            aoid: Anarchy Online ID of the item
            
        Returns:
            Tuple of (min_ql, max_ql) or None if item not found
        """
        ranges = self.get_interpolation_ranges(aoid)
        if not ranges:
            return None
        
        return (ranges[0]["min_ql"], ranges[-1]["max_ql"])

    def is_item_interpolatable(self, aoid: int) -> bool:
        """
        Check if an item can be interpolated (has multiple QL variants).
        
        Args:
            aoid: Anarchy Online ID of the item
            
        Returns:
            True if item can be interpolated, False otherwise
        """
        base_item = self.db.query(Item).filter(Item.aoid == aoid).first()
        if not base_item:
            return False

        if base_item.is_nano or 'Control Point' in base_item.name:
            return False

        item_variants = self._find_item_variants(base_item.name, base_item.description)
        return len(item_variants) > 1

    def _find_item_variants(self, name: str, description: str) -> List[Item]:
        """
        Find all items with the same name and description, ordered by QL.
        Uses eager loading to prevent N+1 queries during interpolation.
        """
        return (self.db.query(Item)
                .options(
                    joinedload(Item.item_stats).joinedload(ItemStats.stat_value),
                    joinedload(Item.item_spell_data).joinedload(ItemSpellData.spell_data)
                        .joinedload(SpellData.spell_data_spells).joinedload(SpellDataSpells.spell),
                    joinedload(Item.actions).joinedload(Action.action_criteria).joinedload(ActionCriteria.criterion)
                )
                .filter(and_(Item.name == name, Item.description == description))
                .order_by(Item.ql, Item.aoid)
                .all())

    def _find_interpolation_bounds(self, variants: List[Item], target_ql: int) -> Tuple[Optional[Item], Optional[Item]]:
        """
        Find the low and high items for interpolation at the target QL.
        """
        if target_ql <= variants[0].ql:
            return variants[0], None

        for i in range(len(variants) - 1):
            if variants[i].ql <= target_ql < variants[i + 1].ql:
                return variants[i], variants[i + 1]

        # Target QL is higher than highest variant
        return variants[-1], None

    def _create_non_interpolated_item(self, item: Item, target_ql: int = None) -> InterpolatedItem:
        """
        Create an InterpolatedItem from a single item (no interpolation).
        If target_ql is provided, the item's QL will be set to that value.
        """
        interpolated = InterpolatedItem.from_item(item, interpolating=False)

        # Update QL to target if specified
        if target_ql is not None:
            interpolated.ql = target_ql
            interpolated.target_ql = target_ql
            interpolated.low_ql = item.ql
            interpolated.high_ql = item.ql

        # Load stats
        interpolated.stats = self._load_item_stats(item)

        # Load spell data
        interpolated.spell_data = self._load_item_spell_data(item)

        # Load actions
        interpolated.actions = self._load_item_actions(item)

        return interpolated

    def _create_interpolated_item(self, lo_item: Item, hi_item: Optional[Item], target_ql: int) -> InterpolatedItem:
        """
        Create an InterpolatedItem with interpolated data.
        """
        interpolated = InterpolatedItem.from_item(lo_item, interpolating=hi_item is not None)
        interpolated.set_interpolation_metadata(lo_item, hi_item, target_ql)
        
        # Load and interpolate stats
        interpolated.stats = self._interpolate_stats(lo_item, hi_item, interpolated)
        
        # Load and interpolate spell data
        interpolated.spell_data = self._interpolate_spell_data(lo_item, hi_item, interpolated)
        
        # Load and interpolate actions
        interpolated.actions = self._interpolate_actions(lo_item, hi_item, interpolated)
        
        return interpolated

    def _load_item_stats(self, item: Item) -> List[Dict[str, Any]]:
        """
        Load stats for a non-interpolated item.
        Uses preloaded relationships to avoid N+1 queries.
        """
        # Use preloaded item_stats relationship instead of querying
        if hasattr(item, 'item_stats') and item.item_stats:
            return [
                {'id': item_stat.stat_value.id, 'stat': item_stat.stat_value.stat, 'value': item_stat.stat_value.value}
                for item_stat in item.item_stats
            ]

        # Fallback to query if relationship not loaded (shouldn't happen with eager loading)
        item_stats = (self.db.query(StatValue)
                      .join(ItemStats)
                      .filter(ItemStats.item_id == item.id)
                      .all())

        return [{'id': stat.id, 'stat': stat.stat, 'value': stat.value} for stat in item_stats]

    def _interpolate_stats(self, lo_item: Item, hi_item: Optional[Item], interpolated: InterpolatedItem) -> List[Dict[str, Any]]:
        """
        Interpolate stats between low and high items.
        """
        if not interpolated.interpolating or hi_item is None:
            return self._load_item_stats(lo_item)

        # Get stats for both items
        lo_stats_list = self._load_item_stats(lo_item)
        hi_stats_list = self._load_item_stats(hi_item)
        
        lo_stats = {stat['stat']: stat for stat in lo_stats_list}
        hi_stats = {stat['stat']: stat for stat in hi_stats_list}

        interpolated_stats = []
        
        for stat_id, lo_stat in lo_stats.items():
            hi_stat = hi_stats.get(stat_id)
            
            if hi_stat is None:
                continue

            if lo_stat['value'] == hi_stat['value']:
                # No change in value
                interpolated_stats.append(lo_stat)
            elif stat_id in self.INTERP_STATS:
                # Interpolate the value
                new_value = interpolated.interpolate_value(lo_stat['value'], hi_stat['value'])
                new_stat = {
                    'id': lo_stat['id'],
                    'stat': stat_id,
                    'value': new_value
                }
                interpolated_stats.append(new_stat)
            else:
                # Use low value for non-interpolatable stats
                interpolated_stats.append(lo_stat)

        return interpolated_stats

    def _load_item_spell_data(self, item: Item) -> List[InterpolatedSpellData]:
        """
        Load spell data for a non-interpolated item.
        Uses preloaded relationships to avoid N+1 queries.
        """
        result = []

        # Use preloaded relationships if available
        if hasattr(item, 'item_spell_data') and item.item_spell_data:
            for isd in item.item_spell_data:
                spell_data = isd.spell_data
                interpolated_spells = []

                # Use preloaded spell_data_spells relationship
                if hasattr(spell_data, 'spell_data_spells') and spell_data.spell_data_spells:
                    for sds in spell_data.spell_data_spells:
                        spell = sds.spell
                        interpolated_spell = InterpolatedSpell(
                            target=spell.target,
                            tick_count=spell.tick_count,
                            tick_interval=spell.tick_interval,
                            spell_id=spell.spell_id,
                            spell_format=spell.spell_format,
                            spell_params=spell.spell_params or {},
                            criteria=[]  # Load separately if needed
                        )
                        interpolated_spells.append(interpolated_spell)

                result.append(InterpolatedSpellData(
                    event=spell_data.event,
                    spells=interpolated_spells
                ))
            return result

        # Fallback to queries if relationships not loaded
        spell_data_entries = (self.db.query(SpellData)
                              .join(ItemSpellData)
                              .filter(ItemSpellData.item_id == item.id)
                              .all())

        for spell_data in spell_data_entries:
            interpolated_spells = []

            from app.models.spell_data import SpellDataSpells
            from app.models.spell import Spell

            spells = (self.db.query(Spell)
                      .join(SpellDataSpells)
                      .filter(SpellDataSpells.spell_data_id == spell_data.id)
                      .all())

            for spell in spells:
                interpolated_spell = InterpolatedSpell(
                    target=spell.target,
                    tick_count=spell.tick_count,
                    tick_interval=spell.tick_interval,
                    spell_id=spell.spell_id,
                    spell_format=spell.spell_format,
                    spell_params=spell.spell_params or {},
                    criteria=[]
                )
                interpolated_spells.append(interpolated_spell)

            result.append(InterpolatedSpellData(
                event=spell_data.event,
                spells=interpolated_spells
            ))

        return result

    def _interpolate_spell_data(self, lo_item: Item, hi_item: Optional[Item], interpolated: InterpolatedItem) -> List[InterpolatedSpellData]:
        """
        Interpolate spell data between low and high items.
        """
        if not interpolated.interpolating or hi_item is None:
            return self._load_item_spell_data(lo_item)

        lo_spell_data = self._load_item_spell_data(lo_item)
        hi_spell_data = self._load_item_spell_data(hi_item)

        # Create mapping by event for easier lookup
        hi_spell_data_map = {sd.event: sd for sd in hi_spell_data}

        interpolated_spell_data = []
        
        for lo_sd in lo_spell_data:
            hi_sd = hi_spell_data_map.get(lo_sd.event)
            
            if hi_sd is None:
                interpolated_spell_data.append(lo_sd)
                continue

            # Interpolate spells within this spell data
            interpolated_spells = self._interpolate_spells(lo_sd.spells, hi_sd.spells, interpolated)
            
            interpolated_spell_data.append(InterpolatedSpellData(
                event=lo_sd.event,
                spells=interpolated_spells
            ))

        return interpolated_spell_data

    def _interpolate_spells(self, lo_spells: List[InterpolatedSpell], hi_spells: List[InterpolatedSpell],
                           interpolated: InterpolatedItem) -> List[InterpolatedSpell]:
        """
        Interpolate individual spells based on spell ID and parameters.
        """
        interpolated_spells = []

        for lo_spell in lo_spells:
            if lo_spell.spell_id in self.INTERPOLATABLE_SPELLS:
                # Find matching high spell by comparing both spell_id and stat parameter
                hi_spell = self._find_matching_spell(lo_spell, hi_spells)
                if hi_spell is not None:
                    interpolated_spell = self._interpolate_single_spell(lo_spell, hi_spell, interpolated)
                    interpolated_spells.append(interpolated_spell)
                    continue

            # No interpolation needed or possible
            interpolated_spells.append(lo_spell)

        return interpolated_spells

    def _find_matching_spell(self, lo_spell: InterpolatedSpell, hi_spells: List[InterpolatedSpell]) -> Optional[InterpolatedSpell]:
        """
        Find a matching spell from hi_spells that has the same spell_id and stat/skill parameter.
        """
        for hi_spell in hi_spells:
            if hi_spell.spell_id != lo_spell.spell_id:
                continue

            # For stat-based spells, match on the Stat parameter
            if 'Stat' in lo_spell.spell_params and 'Stat' in hi_spell.spell_params:
                if lo_spell.spell_params['Stat'] == hi_spell.spell_params['Stat']:
                    return hi_spell
            # For skill-based spells, match on the Skill parameter
            elif 'Skill' in lo_spell.spell_params and 'Skill' in hi_spell.spell_params:
                if lo_spell.spell_params['Skill'] == hi_spell.spell_params['Skill']:
                    return hi_spell
            # For other spells without stat/skill, just match on spell_id
            elif 'Stat' not in lo_spell.spell_params and 'Skill' not in lo_spell.spell_params:
                return hi_spell

        return None

    def _interpolate_single_spell(self, lo_spell: InterpolatedSpell, hi_spell: InterpolatedSpell,
                                 interpolated: InterpolatedItem) -> InterpolatedSpell:
        """
        Interpolate a single spell's parameters.
        """
        new_spell = InterpolatedSpell(
            target=lo_spell.target,
            tick_count=lo_spell.tick_count,
            tick_interval=lo_spell.tick_interval,
            spell_id=lo_spell.spell_id,
            spell_format=lo_spell.spell_format,
            spell_params=lo_spell.spell_params.copy(),
            criteria=lo_spell.criteria
        )

        # Interpolate based on spell type
        if lo_spell.spell_id in {53012, 53014, 53045, 53175}:  # Stat | Amount
            if ('Stat' in lo_spell.spell_params and 'Amount' in lo_spell.spell_params and
                'Stat' in hi_spell.spell_params and 'Amount' in hi_spell.spell_params and
                lo_spell.spell_params['Stat'] == hi_spell.spell_params['Stat']):
                
                new_amount = interpolated.interpolate_value(
                    lo_spell.spell_params['Amount'],
                    hi_spell.spell_params['Amount']
                )
                new_spell.spell_params['Amount'] = new_amount

        elif lo_spell.spell_id in {53026, 53028}:  # Skill | Amount
            if ('Skill' in lo_spell.spell_params and 'Amount' in lo_spell.spell_params and
                'Skill' in hi_spell.spell_params and 'Amount' in hi_spell.spell_params and
                lo_spell.spell_params['Skill'] == hi_spell.spell_params['Skill']):
                
                new_amount = interpolated.interpolate_value(
                    lo_spell.spell_params['Amount'],
                    hi_spell.spell_params['Amount']
                )
                new_spell.spell_params['Amount'] = new_amount

        elif lo_spell.spell_id in {53184, 53237}:  # Stat | Percent
            if ('Stat' in lo_spell.spell_params and 'Percent' in lo_spell.spell_params and
                'Stat' in hi_spell.spell_params and 'Percent' in hi_spell.spell_params and
                lo_spell.spell_params['Stat'] == hi_spell.spell_params['Stat']):
                
                new_percent = interpolated.interpolate_value(
                    lo_spell.spell_params['Percent'],
                    hi_spell.spell_params['Percent']
                )
                new_spell.spell_params['Percent'] = new_percent

        return new_spell

    def _load_item_actions(self, item: Item) -> List[InterpolatedAction]:
        """
        Load actions for a non-interpolated item.
        Uses preloaded relationships to avoid N+1 queries.
        """
        result = []

        # Use preloaded actions relationship if available
        if hasattr(item, 'actions') and item.actions:
            for action in item.actions:
                criteria_dicts = []

                # Use preloaded action_criteria relationship
                if hasattr(action, 'action_criteria') and action.action_criteria:
                    # Sort by order_index (should be preloaded)
                    sorted_criteria = sorted(action.action_criteria, key=lambda ac: ac.order_index)
                    for ac in sorted_criteria:
                        criterion = ac.criterion
                        criteria_dicts.append({
                            'id': criterion.id,
                            'value1': criterion.value1,
                            'value2': criterion.value2,
                            'operator': criterion.operator
                        })

                result.append(InterpolatedAction(
                    action=action.action,
                    criteria=criteria_dicts
                ))
            return result

        # Fallback to queries if relationships not loaded
        actions = (self.db.query(Action)
                   .filter(Action.item_id == item.id)
                   .all())

        for action in actions:
            from app.models.action import ActionCriteria
            from app.models.criterion import Criterion

            criteria_data = (self.db.query(Criterion)
                             .join(ActionCriteria)
                             .filter(ActionCriteria.action_id == action.id)
                             .order_by(ActionCriteria.order_index)
                             .all())

            criteria_dicts = []
            for criterion in criteria_data:
                criteria_dicts.append({
                    'id': criterion.id,
                    'value1': criterion.value1,
                    'value2': criterion.value2,
                    'operator': criterion.operator
                })

            result.append(InterpolatedAction(
                action=action.action,
                criteria=criteria_dicts
            ))

        return result

    def _interpolate_actions(self, lo_item: Item, hi_item: Optional[Item], interpolated: InterpolatedItem) -> List[InterpolatedAction]:
        """
        Interpolate actions between low and high items.
        """
        if not interpolated.interpolating or hi_item is None:
            return self._load_item_actions(lo_item)

        lo_actions = self._load_item_actions(lo_item)
        hi_actions = self._load_item_actions(hi_item)

        # Create mapping by action for easier lookup
        hi_actions_map = {action.action: action for action in hi_actions}

        interpolated_actions = []
        
        for lo_action in lo_actions:
            hi_action = hi_actions_map.get(lo_action.action)
            
            if hi_action is None:
                interpolated_actions.append(lo_action)
                continue

            # Interpolate criteria
            interpolated_criteria = self._interpolate_criteria(lo_action.criteria, hi_action.criteria, interpolated)
            
            interpolated_actions.append(InterpolatedAction(
                action=lo_action.action,
                criteria=interpolated_criteria
            ))

        return interpolated_actions

    def _interpolate_criteria(self, lo_criteria: List[Dict[str, Any]], hi_criteria: List[Dict[str, Any]],
                             interpolated: InterpolatedItem) -> List[Dict[str, Any]]:
        """
        Interpolate criteria values for actions.
        """
        interpolated_criteria = []
        
        for i, lo_crit in enumerate(lo_criteria):
            if i >= len(hi_criteria):
                interpolated_criteria.append(lo_crit)
                continue
                
            hi_crit = hi_criteria[i]
            
            if (lo_crit['value1'] == hi_crit['value1'] and 
                lo_crit['operator'] == hi_crit['operator'] and 
                lo_crit['value1'] in self.INTERP_STATS):
                # Interpolate value2
                new_value2 = interpolated.interpolate_value(lo_crit['value2'], hi_crit['value2'])
                new_criterion = {
                    'id': lo_crit['id'],
                    'value1': lo_crit['value1'],
                    'value2': new_value2,
                    'operator': lo_crit['operator']
                }
                interpolated_criteria.append(new_criterion)
            else:
                # No interpolation needed
                interpolated_criteria.append(lo_crit)

        return interpolated_criteria