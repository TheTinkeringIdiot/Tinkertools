"""
Explicit interpolation chains for item lines whose in-game name changes
across quality-level tiers.

The interpolation engine normally groups an item's variants by matching
``(name, description)`` (see ``InterpolationService._find_item_variants``). A
handful of item lines in Anarchy Online keep a single functional identity but
change their display name partway up the QL range -- the Belt Component
Platform line is the canonical example. Those tiers share neither name nor
description, so the default grouping fragments them into single-QL variants
that each report as non-interpolatable.

This registry lets such a line be described explicitly by listing the AOIDs of
every tier that belongs to it. Membership is looked up by AOID, so any AOID in
a chain resolves the whole chain. The engine sorts the members by QL, so the
order they are listed here does not matter.

Adding a chain here is the only step needed to make a renamed line
interpolatable; the interpolation logic itself is unchanged. Leaving this list
empty preserves the previous behaviour exactly.
"""

from typing import Dict, List, Optional

# One inner list per item line. Each inner list holds the AOIDs of every QL
# tier in that line, in any order.
#
# To populate the Belt Component Platform line, list the AOID of each tier.
# You can gather them from the database with, e.g.:
#
#     SELECT aoid, ql, name
#     FROM items
#     WHERE name ILIKE 'Belt Component Platform%'
#     ORDER BY ql;
#
# then add the AOIDs as a new inner list below.
ITEM_CHAINS: List[List[int]] = [
    # Belt Component Platform line -- add tier AOIDs here, e.g.:
    # [<aoid_ql_low>, <aoid_ql_mid>, <aoid_ql_high>],
]


def _build_index(chains: List[List[int]]) -> Dict[int, List[int]]:
    """Map every AOID to the chain it belongs to."""
    index: Dict[int, List[int]] = {}
    for chain in chains:
        for aoid in chain:
            index[aoid] = chain
    return index


# AOID -> the list of AOIDs in its chain. Built once at import time.
_CHAIN_BY_AOID: Dict[int, List[int]] = _build_index(ITEM_CHAINS)


def get_chain_for_aoid(aoid: int) -> Optional[List[int]]:
    """
    Return the AOIDs of the interpolation chain containing ``aoid``.

    Returns ``None`` when the AOID is not part of any registered chain, in
    which case the caller should fall back to name+description grouping.
    """
    return _CHAIN_BY_AOID.get(aoid)
