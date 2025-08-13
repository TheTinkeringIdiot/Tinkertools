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
from app.models.spell import Spell
from app.models.spell_data import SpellData
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
            'Control Point' in base_item.name or
            item_variants[-1].ql == base_item.ql):
            # No interpolation needed - return original item
            return self._create_non_interpolated_item(base_item)

        # Find the appropriate low and high items for interpolation
        lo_item, hi_item = self._find_interpolation_bounds(item_variants, target_ql)
        
        if not lo_item:
            return None

        # Create the interpolated item
        return self._create_interpolated_item(lo_item, hi_item, target_ql)

    def get_interpolation_range(self, aoid: int) -> Optional[Tuple[int, int]]:
        """
        Get the minimum and maximum quality levels available for interpolation.
        
        Args:
            aoid: Anarchy Online ID of the item
            
        Returns:
            Tuple of (min_ql, max_ql) or None if item not found
        """
        base_item = self.db.query(Item).filter(Item.aoid == aoid).first()
        if not base_item:
            return None

        item_variants = self._find_item_variants(base_item.name, base_item.description)
        if not item_variants:
            return None

        return (item_variants[0].ql, item_variants[-1].ql - 1)

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
        """
        return (self.db.query(Item)
                .filter(and_(Item.name == name, Item.description == description))
                .order_by(Item.ql)
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

    def _create_non_interpolated_item(self, item: Item) -> InterpolatedItem:
        """
        Create an InterpolatedItem from a single item (no interpolation).
        """
        interpolated = InterpolatedItem.from_item(item, interpolating=False)
        
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
        """
        item_stats = (self.db.query(StatValue)
                      .join(ItemStats)
                      .filter(ItemStats.item_id == item.id)
                      .all())
        
        # Convert to dict format
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
        """
        spell_data_entries = (self.db.query(SpellData)
                              .join(ItemSpellData)
                              .filter(ItemSpellData.item_id == item.id)
                              .all())

        result = []
        for spell_data in spell_data_entries:
            interpolated_spells = []
            
            # Get spells for this spell data manually
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
                    criteria=[]  # Load separately if needed
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
        
        # Create mapping by spell_id for easier lookup
        hi_spells_map = {spell.spell_id: spell for spell in hi_spells}
        
        for lo_spell in lo_spells:
            if lo_spell.spell_id in self.INTERPOLATABLE_SPELLS:
                hi_spell = hi_spells_map.get(lo_spell.spell_id)
                if hi_spell is not None:
                    interpolated_spell = self._interpolate_single_spell(lo_spell, hi_spell, interpolated)
                    interpolated_spells.append(interpolated_spell)
                    continue
            
            # No interpolation needed or possible
            interpolated_spells.append(lo_spell)

        return interpolated_spells

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
        """
        actions = (self.db.query(Action)
                   .filter(Action.item_id == item.id)
                   .all())

        result = []
        for action in actions:
            # Get criteria for this action manually
            from app.models.action import ActionCriteria
            from app.models.criterion import Criterion
            
            criteria_data = (self.db.query(Criterion)
                             .join(ActionCriteria)
                             .filter(ActionCriteria.action_id == action.id)
                             .order_by(ActionCriteria.order_index)
                             .all())
            
            # Convert criteria to dict format
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