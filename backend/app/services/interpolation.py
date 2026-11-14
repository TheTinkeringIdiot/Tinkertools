"""
Item Interpolation Service for TinkerTools.

This service implements the core interpolation logic from the legacy InterpItem.py,
allowing calculation of item stats, spells, and criteria at specific quality levels
between the discrete entries of a game build.

The QL variants of an item are the items of the build that share its name and
description, which in the store is its text part. They are read through
``app.store``: one query finds the variants of any number of items, one loads
them.
"""

from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.interpolated_item import (
    InterpolatedAction,
    InterpolatedItem,
    InterpolatedSpell,
    InterpolatedSpellData,
)
from app.store import tables as t
from app.store.context import Build
from app.store.items import (
    ItemRecord,
    criteria_response,
    load_effect_formats,
    load_records,
    spell_params,
    stats_response,
)
from app.store.presence import any_of, present, revisions

# Parameters interpolated for each interpolatable effect type: the one that
# must name the same subject in both variants, and the one that scales.
_SPELL_PARAMS: Dict[int, Tuple[str, str]] = {
    53012: ("Stat", "Amount"),
    53014: ("Stat", "Amount"),
    53045: ("Stat", "Amount"),
    53175: ("Stat", "Amount"),
    53026: ("Skill", "Amount"),
    53028: ("Skill", "Amount"),
    53184: ("Stat", "Percent"),
    53237: ("Stat", "Percent"),
}


class InterpolationService:
    """
    Service for interpolating the items of one build at specific quality levels.

    An instance belongs to one request. It remembers the variants it has
    loaded, so ``preload`` followed by any number of ``interpolate_item`` calls
    costs a constant number of queries.
    """

    # Stats that should be interpolated (from legacy INTERP_STATS)
    # fmt: off
    INTERP_STATS = frozenset({
        1, 2, 3, 8, 16, 17, 18, 19, 20, 21, 22, 27, 29, 36, 37, 54, 61, 71, 74,
        90, 91, 92, 93, 94, 95, 96, 97, 100, 101, 102, 103, 104, 105, 106, 107,
        108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121,
        122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135,
        136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149,
        150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163,
        164, 165, 166, 167, 168, 201, 204, 205, 206, 207, 208, 214, 216, 217,
        218, 219, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 238, 239,
        240, 241, 242, 243, 244, 245, 276, 277, 278, 279, 280, 281, 282, 284,
        285, 286, 287, 294, 311, 315, 316, 317, 318, 319, 343, 364, 374, 375,
        379, 380, 381, 382, 383, 475, 476, 477, 478, 479, 480, 481, 482, 483,
    })
    # fmt: on

    # Spell IDs that have interpolatable parameters
    INTERPOLATABLE_SPELLS = frozenset(_SPELL_PARAMS)

    def __init__(self, db: Session, build: Build):
        self.db = db
        self.build = build
        self._variants: Dict[int, List[ItemRecord]] = {}
        self._formats: Optional[Dict[int, str]] = None

    def preload(self, aoids: Iterable[int]) -> None:
        """Load the variants of several items at once, ahead of the calls that
        use them."""
        missing = [aoid for aoid in dict.fromkeys(aoids) if aoid not in self._variants]
        if not missing:
            return
        base = t.item_presence.alias("base")
        base_revision = t.item_revision.alias("base_revision")
        texts = (
            select(base_revision.c.text_id)
            .select_from(
                base.join(base_revision, base_revision.c.rev_id == base.c.rev_id)
            )
            .where(present(self.build, base), any_of(base.c.aoid, missing))
        )
        revision = t.item_revision
        rows = self.db.execute(
            revisions(
                self.build, revision.c.rev_id, revision.c.aoid, revision.c.text_id
            )
            .where(revision.c.text_id.in_(texts))
            .order_by(revision.c.ql, revision.c.aoid)
        ).all()
        records = {
            record.rev_id: record
            for record in load_records(
                self.db, self.build, rev_ids=[row.rev_id for row in rows]
            )
        }
        by_text: Dict[int, List[ItemRecord]] = {}
        text_of: Dict[int, int] = {}
        for row in rows:
            by_text.setdefault(row.text_id, []).append(records[row.rev_id])
            text_of[row.aoid] = row.text_id
        for aoid in missing:
            self._variants[aoid] = by_text.get(text_of.get(aoid, -1), [])

    def _find_item_variants(self, aoid: int) -> List[ItemRecord]:
        """
        All items with the same name and description as the item, ordered by
        QL. Empty when the build does not have the item.
        """
        self.preload([aoid])
        return self._variants[aoid]

    def _effect_formats(self) -> Dict[int, str]:
        if self._formats is None:
            self._formats = load_effect_formats(self.db)
        return self._formats

    def interpolate_item(self, aoid: int, target_ql: int) -> Optional[InterpolatedItem]:
        """
        Main interpolation function that creates an interpolated item at the target QL.

        Args:
            aoid: Anarchy Online ID of the item
            target_ql: Target quality level for interpolation

        Returns:
            InterpolatedItem or None if item not found
        """
        item_variants = self._find_item_variants(aoid)
        if not item_variants:
            return None
        base_item = next(item for item in item_variants if item.aoid == aoid)

        # Check if interpolation is needed
        if (
            len(item_variants) == 1
            or base_item.is_nano
            or "Control Point" in base_item.name
        ):
            # No interpolation needed - return original item with target QL
            return self._create_interpolated_item(base_item, None, target_ql)

        # Find the appropriate low and high items for interpolation
        lo_item, hi_item = self._find_interpolation_bounds(item_variants, target_ql)

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
        item_variants = self._find_item_variants(aoid)
        if not item_variants:
            return None

        # If only one variant, return single non-interpolatable range
        if len(item_variants) == 1:
            return [self._range(item_variants[0], item_variants[0], False)]

        # Create ranges between consecutive variants
        # All ranges with multiple variants are interpolatable
        ranges = [
            self._range(lo_item, hi_item, True)
            for lo_item, hi_item in zip(item_variants, item_variants[1:])
        ]
        # Last item - only if it's not covered by the previous range
        last = item_variants[-1]
        if last.ql > item_variants[-2].ql:
            ranges.append(self._range(last, last, False))
        return ranges

    @staticmethod
    def _range(
        lo_item: ItemRecord, hi_item: ItemRecord, interpolatable: bool
    ) -> Dict[str, Any]:
        return {
            "min_ql": lo_item.ql,
            "max_ql": hi_item.ql,
            "interpolatable": interpolatable,
            "base_aoid": lo_item.aoid,
        }

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

    def _find_interpolation_bounds(
        self, variants: Sequence[ItemRecord], target_ql: int
    ) -> Tuple[ItemRecord, Optional[ItemRecord]]:
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

    def _create_interpolated_item(
        self, lo_item: ItemRecord, hi_item: Optional[ItemRecord], target_ql: int
    ) -> InterpolatedItem:
        """
        Create an InterpolatedItem at the target QL: interpolated between the
        low and high items, or the low item as it is when there is no high item.
        """
        interpolated = InterpolatedItem.from_item(
            lo_item, interpolating=hi_item is not None
        )
        interpolated.set_interpolation_metadata(lo_item, hi_item, target_ql)
        interpolated.stats = self._interpolate_stats(lo_item, hi_item, interpolated)
        interpolated.spell_data = self._interpolate_spell_data(
            lo_item, hi_item, interpolated
        )
        interpolated.actions = self._interpolate_actions(lo_item, hi_item, interpolated)
        return interpolated

    def _interpolate_stats(
        self,
        lo_item: ItemRecord,
        hi_item: Optional[ItemRecord],
        interpolated: InterpolatedItem,
    ) -> List[Dict[str, Any]]:
        """
        Interpolate stats between low and high items.
        """
        if hi_item is None:
            return stats_response(lo_item.stats)

        lo_stats = dict(lo_item.stats)
        hi_stats = dict(hi_item.stats)

        interpolated_stats = []
        for stat_id, lo_value in lo_stats.items():
            if stat_id not in hi_stats:
                continue
            hi_value = hi_stats[stat_id]
            if lo_value != hi_value and stat_id in self.INTERP_STATS:
                value = interpolated.interpolate_value(lo_value, hi_value)
            else:
                # Unchanged, or a stat that is not interpolated: the low value
                value = lo_value
            interpolated_stats.append({"stat": stat_id, "value": value})
        return interpolated_stats

    def _load_item_spell_data(self, item: ItemRecord) -> List[InterpolatedSpellData]:
        """
        The spell data of an item as it is. Spell criteria are not carried
        into interpolated items.
        """
        formats = self._effect_formats()
        return [
            InterpolatedSpellData(
                event=event["event"],
                spells=[
                    InterpolatedSpell(
                        target=effect["target"],
                        tick_count=effect["tick_count"],
                        tick_interval=effect["tick_interval"],
                        spell_id=effect["spell_id"],
                        spell_format=formats.get(effect["spell_id"]),
                        spell_params=spell_params(effect),
                        criteria=[],
                    )
                    for effect in event["effects"]
                ],
            )
            for event in item.effects
        ]

    def _interpolate_spell_data(
        self,
        lo_item: ItemRecord,
        hi_item: Optional[ItemRecord],
        interpolated: InterpolatedItem,
    ) -> List[InterpolatedSpellData]:
        """
        Interpolate spell data between low and high items.
        """
        lo_spell_data = self._load_item_spell_data(lo_item)
        if hi_item is None:
            return lo_spell_data

        # Create mapping by event for easier lookup
        hi_spell_data_map = {sd.event: sd for sd in self._load_item_spell_data(hi_item)}

        interpolated_spell_data = []
        for lo_sd in lo_spell_data:
            hi_sd = hi_spell_data_map.get(lo_sd.event)
            if hi_sd is None:
                interpolated_spell_data.append(lo_sd)
                continue

            # Interpolate spells within this spell data
            interpolated_spell_data.append(
                InterpolatedSpellData(
                    event=lo_sd.event,
                    spells=self._interpolate_spells(
                        lo_sd.spells, hi_sd.spells, interpolated
                    ),
                )
            )
        return interpolated_spell_data

    def _interpolate_spells(
        self,
        lo_spells: List[InterpolatedSpell],
        hi_spells: List[InterpolatedSpell],
        interpolated: InterpolatedItem,
    ) -> List[InterpolatedSpell]:
        """
        Interpolate individual spells based on spell ID and parameters.
        """
        interpolated_spells = []

        for lo_spell in lo_spells:
            if lo_spell.spell_id in self.INTERPOLATABLE_SPELLS:
                # Find matching high spell by comparing both spell_id and stat parameter
                hi_spell = self._find_matching_spell(lo_spell, hi_spells)
                if hi_spell is not None:
                    interpolated_spells.append(
                        self._interpolate_single_spell(lo_spell, hi_spell, interpolated)
                    )
                    continue

            # No interpolation needed or possible
            interpolated_spells.append(lo_spell)

        return interpolated_spells

    def _find_matching_spell(
        self, lo_spell: InterpolatedSpell, hi_spells: List[InterpolatedSpell]
    ) -> Optional[InterpolatedSpell]:
        """
        Find a matching spell from hi_spells that has the same spell_id and stat/skill parameter.
        """
        for hi_spell in hi_spells:
            if hi_spell.spell_id != lo_spell.spell_id:
                continue

            # For stat-based spells, match on the Stat parameter
            if "Stat" in lo_spell.spell_params and "Stat" in hi_spell.spell_params:
                if lo_spell.spell_params["Stat"] == hi_spell.spell_params["Stat"]:
                    return hi_spell
            # For skill-based spells, match on the Skill parameter
            elif "Skill" in lo_spell.spell_params and "Skill" in hi_spell.spell_params:
                if lo_spell.spell_params["Skill"] == hi_spell.spell_params["Skill"]:
                    return hi_spell
            # For other spells without stat/skill, just match on spell_id
            elif (
                "Stat" not in lo_spell.spell_params
                and "Skill" not in lo_spell.spell_params
            ):
                return hi_spell

        return None

    def _interpolate_single_spell(
        self,
        lo_spell: InterpolatedSpell,
        hi_spell: InterpolatedSpell,
        interpolated: InterpolatedItem,
    ) -> InterpolatedSpell:
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
            criteria=lo_spell.criteria,
        )

        subject, amount = _SPELL_PARAMS[lo_spell.spell_id]
        lo_params, hi_params = lo_spell.spell_params, hi_spell.spell_params
        if (
            subject in lo_params
            and amount in lo_params
            and subject in hi_params
            and amount in hi_params
            and lo_params[subject] == hi_params[subject]
        ):
            new_spell.spell_params[amount] = interpolated.interpolate_value(
                lo_params[amount], hi_params[amount]
            )

        return new_spell

    def _load_item_actions(self, item: ItemRecord) -> List[InterpolatedAction]:
        """
        The actions of an item as they are, criteria in evaluation order.
        """
        return [
            InterpolatedAction(
                action=action["action"], criteria=criteria_response(action["criteria"])
            )
            for action in item.actions
        ]

    def _interpolate_actions(
        self,
        lo_item: ItemRecord,
        hi_item: Optional[ItemRecord],
        interpolated: InterpolatedItem,
    ) -> List[InterpolatedAction]:
        """
        Interpolate actions between low and high items.
        """
        lo_actions = self._load_item_actions(lo_item)
        if hi_item is None:
            return lo_actions

        # Create mapping by action for easier lookup
        hi_actions_map = {
            action.action: action for action in self._load_item_actions(hi_item)
        }

        interpolated_actions = []
        for lo_action in lo_actions:
            hi_action = hi_actions_map.get(lo_action.action)
            if hi_action is None:
                interpolated_actions.append(lo_action)
                continue

            interpolated_actions.append(
                InterpolatedAction(
                    action=lo_action.action,
                    criteria=self._interpolate_criteria(
                        lo_action.criteria, hi_action.criteria, interpolated
                    ),
                )
            )
        return interpolated_actions

    def _interpolate_criteria(
        self,
        lo_criteria: List[Dict[str, Any]],
        hi_criteria: List[Dict[str, Any]],
        interpolated: InterpolatedItem,
    ) -> List[Dict[str, Any]]:
        """
        Interpolate criteria values for actions.
        """
        interpolated_criteria = []

        for i, lo_crit in enumerate(lo_criteria):
            if i >= len(hi_criteria):
                interpolated_criteria.append(lo_crit)
                continue

            hi_crit = hi_criteria[i]

            if (
                lo_crit["value1"] == hi_crit["value1"]
                and lo_crit["operator"] == hi_crit["operator"]
                and lo_crit["value1"] in self.INTERP_STATS
            ):
                # Interpolate value2
                interpolated_criteria.append(
                    {
                        "value1": lo_crit["value1"],
                        "value2": interpolated.interpolate_value(
                            lo_crit["value2"], hi_crit["value2"]
                        ),
                        "operator": lo_crit["operator"],
                    }
                )
            else:
                # No interpolation needed
                interpolated_criteria.append(lo_crit)

        return interpolated_criteria
