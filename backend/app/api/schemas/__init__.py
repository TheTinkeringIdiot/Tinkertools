"""
Pydantic schemas for API request/response models.
"""

from .stat_value import ItemStatResponse, StatValueCreate
from .criterion import ItemCriterionResponse, CriterionCreate
from .spell import (
    SpellCreate,
    ItemSpellResponse,
    SpellDataResponse,
)
from .action import ActionResponse, ActionCreate
from .nano import (
    NanoProgram,
    NanoDuration,
    NanoTargeting,
)
from .item import ItemResponse, ItemCreate, ItemDetail, ItemSearch, ItemRequirement
from .symbiant import (
    SymbiantResponse,
    SymbiantWithDropsResponse,
    MobDropInfo,
    # Deprecated but kept for backwards compatibility:
    SymbiantCreate,
    SymbiantDetail,
    PocketBossInfo,
)
from .mob import MobResponse
from .source import SourceTypeResponse, SourceResponse, ItemSourceResponse
from .weapon_analysis import WeaponSkill, WeaponAnalyzeRequest
from .common import PaginatedResponse

__all__ = [
    "ItemStatResponse",
    "StatValueCreate",
    "ItemCriterionResponse",
    "CriterionCreate",
    "SpellCreate",
    "ItemSpellResponse",
    "SpellDataResponse",
    "ActionResponse",
    "ActionCreate",
    "NanoProgram",
    "NanoDuration",
    "NanoTargeting",
    "ItemResponse",
    "ItemCreate",
    "ItemDetail",
    "ItemSearch",
    "ItemRequirement",
    "SymbiantResponse",
    "SymbiantWithDropsResponse",
    "MobDropInfo",
    "SymbiantCreate",  # Deprecated
    "SymbiantDetail",  # Deprecated
    "PocketBossInfo",  # Deprecated
    "MobResponse",
    "SourceTypeResponse",
    "SourceResponse",
    "ItemSourceResponse",
    "WeaponSkill",
    "WeaponAnalyzeRequest",
    "PaginatedResponse",
]
