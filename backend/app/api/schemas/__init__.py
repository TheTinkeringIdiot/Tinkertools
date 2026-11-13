"""
Pydantic schemas for API request/response models.
"""

from .stat_value import StatValueResponse, ItemStatResponse, StatValueCreate
from .criterion import CriterionResponse, ItemCriterionResponse, CriterionCreate
from .spell import (
    SpellResponse,
    SpellCreate,
    SpellWithCriteria,
    ItemSpellResponse,
    SpellDataResponse,
)
from .action import ActionResponse, ActionCreate
from .nano import (
    NanoProgram,
    NanoSearchRequest,
    NanoStatsResponse,
    NanoEffect,
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
from .mob import MobResponse, MobDetail, SymbiantDropInfo

# Keep old pocket_boss imports for backwards compatibility
from .pocket_boss import PocketBossResponse, PocketBossCreate, PocketBossDetail
from .source import SourceTypeResponse, SourceResponse, ItemSourceResponse
from .weapon_analysis import WeaponSkill, WeaponAnalyzeRequest
from .common import PaginatedResponse, ErrorResponse

__all__ = [
    "StatValueResponse",
    "ItemStatResponse",
    "StatValueCreate",
    "CriterionResponse",
    "ItemCriterionResponse",
    "CriterionCreate",
    "SpellResponse",
    "SpellCreate",
    "SpellWithCriteria",
    "ItemSpellResponse",
    "SpellDataResponse",
    "ActionResponse",
    "ActionCreate",
    "NanoProgram",
    "NanoSearchRequest",
    "NanoStatsResponse",
    "NanoEffect",
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
    "MobDetail",
    "SymbiantDropInfo",
    "PocketBossResponse",  # Deprecated
    "PocketBossCreate",  # Deprecated
    "PocketBossDetail",  # Deprecated
    "SourceTypeResponse",
    "SourceResponse",
    "ItemSourceResponse",
    "WeaponSkill",
    "WeaponAnalyzeRequest",
    "PaginatedResponse",
    "ErrorResponse",
]
