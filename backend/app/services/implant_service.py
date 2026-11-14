"""
Implant Service for TinkerTools.

Handles implant lookup by slot, QL, and exact cluster combinations.
"""

import logging
from typing import Dict, Optional, Sequence, Tuple

from sqlalchemy import ColumnElement, Integer, func, select
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Session
from sqlalchemy.sql.expression import bindparam

from app.api.schemas.item import ItemDetail
from app.models.interpolated_item import InterpolatedItem
from app.services.interpolation import InterpolationService
from app.store import tables as t
from app.store.context import Build
from app.store.items import load_item_details
from app.store.presence import any_of, has_effect, revisions

logger = logging.getLogger(__name__)

IMPLANT_ITEM_CLASS = 3
STAT_QL = 54
STAT_SLOT = 298
# The effect type of a cluster: "Modify {Stat} {Amount}".
CLUSTER_SPELL_ID = 53045
# Names of the implants players build: "Head Implant: Disease AC, Shiny".
STANDARD_SERIES_NAME = "% Implant: %"


def _is_cluster() -> ColumnElement:
    return t.effect_entry.c.spell_id == CLUSTER_SPELL_ID


def _cluster_count(*conditions: ColumnElement) -> ColumnElement:
    """How many cluster effects of the revision meet ``conditions``."""
    return (
        select(func.count())
        .select_from(t.effect_entry)
        .where(
            t.effect_entry.c.effects_id == t.item_revision.c.effects_id,
            _is_cluster(),
            *conditions,
        )
        .scalar_subquery()
    )


def _none_of(column: ColumnElement, values: Sequence[int]) -> ColumnElement:
    """``column <> ALL(values)``, the complement of ``any_of``."""
    storable = [value for value in values if -(2**31) <= value < 2**31]
    return column != func.all(bindparam(None, storable, type_=ARRAY(Integer)))


def _has_exactly(cluster_stats: Sequence[int]) -> Sequence[ColumnElement]:
    """The revision's cluster effects modify exactly ``cluster_stats``: one
    effect for each stat asked for and none for any other stat."""
    subject = t.effect_entry.c.subject
    if not cluster_stats:
        return [~has_effect(_is_cluster())]
    return [
        # Redundant with the count below, but indexed: it finds the few
        # effect sets with the first cluster before anything is counted.
        has_effect(_is_cluster(), subject == cluster_stats[0]),
        _cluster_count(any_of(subject, cluster_stats)) == len(cluster_stats),
        ~has_effect(_is_cluster(), _none_of(subject, cluster_stats)),
    ]


class ImplantService:
    """Implant lookups in one build of the store."""

    # Valid implant slot bitflags (2^1 to 2^13)
    VALID_SLOT_BITFLAGS = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192]

    def __init__(self, db: Session, build: Build):
        self.db = db
        self.build = build
        self.interpolation_service = InterpolationService(db, build)

    def lookup_implant(
        self, slot: int, target_ql: int, clusters: Dict[str, int]
    ) -> Optional[Tuple[ItemDetail, bool, int]]:
        """
        Look up an implant by slot, QL, and exact cluster combination.

        Args:
            slot: IMPLANT_SLOT bitflag (2 to 8192)
            target_ql: Target quality level (1-300)
            clusters: Dict mapping position names to STAT IDs

        Returns:
            Tuple of (ItemDetail, was_interpolated, base_ql) or None if not found
        """
        if slot not in self.VALID_SLOT_BITFLAGS:
            logger.warning(f"Invalid implant slot bitflag: {slot}")
            return None

        base_ql = self._determine_base_ql(target_ql)
        aoid = self._find_implant_with_clusters(slot, base_ql, clusters)
        if aoid is None:
            logger.info(
                f"No implant found for slot {slot}, QL {target_ql}, clusters {clusters}"
            )
            return None

        if target_ql != base_ql:
            interpolated = self.interpolation_service.interpolate_item(aoid, target_ql)
            if interpolated is not None:
                return self._convert_interpolated_to_detail(interpolated), True, base_ql

        return load_item_details(self.db, self.build, aoids=[aoid])[0], False, base_ql

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
        self, slot: int, base_ql: int, clusters: Dict[str, int]
    ) -> Optional[int]:
        """
        The AOID of the implant of the build at ``base_ql`` that fits ``slot``
        and has exactly the requested clusters; without clusters, the basic
        implant that has none.

        A cluster is an effect of type 53045 (Modify Stat) on the stat it
        raises. Several items can carry the same set, so the choice is fixed:
        an implant of the standard series first, then the lowest AOID.

        The standard series is named "<slot> Implant: <skill>, <positions>".
        The builds from 15.0 to 17.10.5 and PRK also keep some 120 implants
        of an older series ("A Shining Poison Protection Head Implant") that
        differ from their standard twin in name and icon only, have lower
        AOIDs and are gone from the live game; live has test items and
        cyborg implants with higher AOIDs beside a few standard ones.
        """
        revision = t.item_revision
        in_standard_series = (
            select(t.part_text.c.name.like(STANDARD_SERIES_NAME))
            .where(t.part_text.c.text_id == revision.c.text_id)
            .scalar_subquery()
        )
        # The stat sets of the slot at this QL. The QL is tested on the stats
        # part as well as on the revision because that test has an index to
        # start from and all implants of a slot and QL share a handful of
        # stat sets.
        slot_entry, ql_entry = t.stat_entry.alias("slot"), t.stat_entry.alias("ql")
        fitting_stats = (
            select(slot_entry.c.stats_id)
            .select_from(
                ql_entry.join(slot_entry, slot_entry.c.stats_id == ql_entry.c.stats_id)
            )
            .where(
                ql_entry.c.stat == STAT_QL,
                ql_entry.c.value == base_ql,
                slot_entry.c.stat == STAT_SLOT,
                slot_entry.c.value.op("&")(slot) > 0,
            )
        )
        query = (
            revisions(self.build, revision.c.aoid)
            .where(
                revision.c.item_class == IMPLANT_ITEM_CLASS,
                revision.c.ql == base_ql,
                revision.c.stats_id.in_(fitting_stats),
                *_has_exactly(list(clusters.values())),
            )
            .order_by(in_standard_series.desc(), revision.c.aoid)
            .limit(1)
        )
        return self.db.execute(query).scalar_one_or_none()

    def _convert_interpolated_to_detail(
        self, interpolated_item: InterpolatedItem
    ) -> ItemDetail:
        """
        An interpolated item as an ``ItemDetail``. Interpolated items carry no
        attack/defense stats and no sources.
        """
        return ItemDetail.model_validate(
            {
                "id": interpolated_item.id or 0,
                "aoid": interpolated_item.aoid,
                "name": interpolated_item.name,
                "ql": interpolated_item.ql,
                "item_class": interpolated_item.item_class,
                "description": interpolated_item.description,
                "is_nano": interpolated_item.is_nano,
                "stats": interpolated_item.stats,
                "spell_data": [
                    spell_data.model_dump()
                    for spell_data in interpolated_item.spell_data
                ],
                "attack_stats": [],
                "defense_stats": [],
                "actions": [
                    action.model_dump() for action in interpolated_item.actions
                ],
                "sources": [],
            }
        )
