"""
Pydantic schemas for cross-version diffs: an item's timeline, the change list
of a build, the comparison of two builds and of one item across two builds.

Stats, skills, actions, events and effect types are numeric ids, as everywhere
in the API. The field-level diff (``ItemDiff``) is described in
``app/core/item_diff.py``.
"""

from datetime import date
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from .common import PaginatedResponse
from .criterion import ItemCriterionResponse

ChangeKind = Literal["added", "removed", "changed"]
PartName = Literal["text", "stats", "effects", "actions", "atkdef", "misc"]
RelevanceName = Literal["gameplay", "economy", "cosmetic", "text"]


class BuildRef(BaseModel):
    """A build, as far as a diff needs to name it."""

    slug: str = Field(description="Version slug, used in URLs")
    display_name: str = Field(description="Human readable version name")
    family: str = Field(description="Version family (branch): 'ao', 'prk'")
    client_build: Optional[str] = Field(None, description="Game client build string")
    snapshot_date: Optional[date] = Field(
        None, description="Date the data was captured"
    )


# ---------------------------------------------------------------------------
# Field-level diff
# ---------------------------------------------------------------------------


class FieldChange(BaseModel):
    """A named field with its old and new value."""

    field: str = Field(
        description="text: 'name', 'description'. misc: 'static_instance', "
        "'animation_mesh', 'shop'. Changed effect: 'target', 'tick_count', "
        "'tick_interval', 'spell_params.<name>'"
    )
    old: Any = Field(None, description="Value before; null when absent")
    new: Any = Field(None, description="Value after; null when absent")


class StatChange(BaseModel):
    """One stat (or attack/defense skill) whose value differs."""

    stat: int = Field(description="Stat or skill id")
    change: ChangeKind
    old: Optional[int] = Field(None, description="Value before; null when added")
    new: Optional[int] = Field(None, description="Value after; null when removed")
    bits_set: Optional[List[int]] = Field(
        None,
        description="Flag stats only (0, 30, 182, 298, 355, 389): the flag values "
        "(1, 2, 4, ...) that are set now and were not",
    )
    bits_cleared: Optional[List[int]] = Field(
        None, description="Flag stats only: the flag values that are no longer set"
    )


class CriterionChange(BaseModel):
    """One step of the sequence diff of a criteria list."""

    op: Literal["same", "added", "removed", "changed"]
    old: Optional[ItemCriterionResponse] = Field(
        None, description="Criterion before; null when added"
    )
    new: Optional[ItemCriterionResponse] = Field(
        None, description="Criterion after; null when removed"
    )


class ActionChange(BaseModel):
    """One action whose requirements differ."""

    action: int = Field(description="Action id")
    change: ChangeKind
    criteria: List[CriterionChange] = Field(
        description="The whole criteria sequence, old and new merged in order"
    )


class DiffEffect(BaseModel):
    """An effect, shaped as the ``spells`` of an item's ``spell_data``."""

    spell_id: int
    target: Optional[int] = None
    tick_count: Optional[int] = None
    tick_interval: Optional[int] = None
    spell_format: Optional[str] = None
    spell_params: Dict[str, Any] = Field(default_factory=dict)
    criteria: List[ItemCriterionResponse] = Field(default_factory=list)


class EffectChange(BaseModel):
    """An old and a new effect that are the same effect, changed."""

    old: DiffEffect
    new: DiffEffect
    fields: List[FieldChange] = Field(
        description="Fixed fields and parameters that differ"
    )
    criteria: Optional[List[CriterionChange]] = Field(
        None, description="Sequence diff of the criteria; null when they are equal"
    )


class EventChange(BaseModel):
    """One event whose effects differ."""

    event: int = Field(description="Event id (the new one when renumbered)")
    change: Literal["added", "removed", "changed", "renumbered"]
    old_event: Optional[int] = Field(
        None, description="Renumbered events only: the event id before"
    )
    added: List[DiffEffect] = Field(default_factory=list)
    removed: List[DiffEffect] = Field(default_factory=list)
    changed: List[EffectChange] = Field(default_factory=list)


class ItemDiff(BaseModel):
    """Field-level diff of two revisions of an item. A part that did not
    change is an empty list."""

    text: List[FieldChange] = Field(default_factory=list)
    stats: List[StatChange] = Field(default_factory=list)
    effects: List[EventChange] = Field(default_factory=list)
    actions: List[ActionChange] = Field(default_factory=list)
    attack: List[StatChange] = Field(default_factory=list)
    defense: List[StatChange] = Field(default_factory=list)
    misc: List[FieldChange] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Change rows
# ---------------------------------------------------------------------------


class ItemChange(BaseModel):
    """One item that differs between two builds: a row of a change list."""

    aoid: int = Field(description="Item AOID")
    kind: ChangeKind
    name: str = Field(description="Name in the newer build (the older, if removed)")
    old_name: Optional[str] = Field(
        None, description="Name in the older build, when it differs"
    )
    ql: int = Field(description="Quality level in the newer build (older if removed)")
    old_ql: Optional[int] = Field(
        None, description="Quality level in the older build, when it differs"
    )
    item_class: int = Field(description="Item class (stat 76)")
    is_nano: bool
    icon: Optional[int] = Field(None, description="Icon id (stat 79)")
    parts: List[PartName] = Field(
        description="Parts that differ; empty for an added or removed item"
    )
    relevance: List[RelevanceName] = Field(description="What the change matters for")
    note_id: Optional[int] = Field(
        None, description="Build note that explains the whole change, if any"
    )
    diff: Optional[ItemDiff] = Field(
        None,
        description="Field-level diff of a changed item; null unless asked for "
        "(include_diff) and for added and removed items",
    )


class BuildNote(BaseModel):
    """A build-wide event that explains many item changes at once."""

    note_id: int
    title: str
    body: Optional[str] = None
    count: int = Field(description="Changes of the build the note explains")
    matching: int = Field(
        description="Of those, the changes that match the request's filters"
    )


class ChangeSummary(BaseModel):
    """Counts over every change between the two builds, whatever the filters."""

    total: int
    by_kind: Dict[ChangeKind, int]
    by_part: Dict[PartName, int] = Field(
        description="Changed items per part that differs (an item counts once "
        "per part)"
    )
    by_relevance: Dict[RelevanceName, int] = Field(
        description="Changes per relevance class (a change counts once per class)"
    )
    noted: int = Field(description="Changes explained by a build note")


class ChangeListResponse(PaginatedResponse[ItemChange]):
    """A page of the changes from ``base`` to ``build``."""

    build: BuildRef = Field(description="The newer side of the comparison")
    base: Optional[BuildRef] = Field(
        None,
        description="The older side: the previous build (the parent build for a "
        "branch's first build), or the build asked for. Null for a build with "
        "nothing before it, whose items are all 'added'",
    )
    summary: ChangeSummary
    notes: List[BuildNote] = Field(
        default_factory=list,
        description="Notes of the build, most changes first. Their changes are "
        "left out of ``items`` unless notes=expand or note_id is given",
    )


# ---------------------------------------------------------------------------
# One item
# ---------------------------------------------------------------------------


class TimelineNote(BaseModel):
    """The build note of a timeline entry."""

    note_id: int
    title: str
    body: Optional[str] = None


class TimelineEntry(BaseModel):
    """One build in which an item was added, changed or removed."""

    build: BuildRef
    base: Optional[BuildRef] = Field(
        None, description="The build the change is relative to"
    )
    kind: ChangeKind
    name: str = Field(description="Name as of this build (before it, if removed)")
    ql: int
    parts: List[PartName]
    relevance: List[RelevanceName]
    note: Optional[TimelineNote] = Field(
        None, description="Build note that explains the whole change, if any"
    )
    diff: Optional[ItemDiff] = Field(
        None, description="Field-level diff of a 'changed' entry"
    )


class ItemTimelineResponse(BaseModel):
    """Every change of one item along the lineage of the request's version."""

    aoid: int
    family: str = Field(description="Family (branch) whose history this is")
    entries: List[TimelineEntry] = Field(
        description="Newest first. The history of a fork continues into its "
        "parent's, up to the build it forked from"
    )


class ItemSnapshot(BaseModel):
    """What an item is in one build, in brief."""

    name: str
    ql: int
    item_class: int
    is_nano: bool
    icon: Optional[int] = None


class ItemCompareResponse(BaseModel):
    """One item in two builds."""

    aoid: int
    build: BuildRef
    base: BuildRef
    kind: Literal["added", "removed", "changed", "unchanged"]
    old: Optional[ItemSnapshot] = Field(None, description="The item in ``base``")
    new: Optional[ItemSnapshot] = Field(None, description="The item in ``build``")
    parts: List[PartName]
    relevance: List[RelevanceName]
    diff: Optional[ItemDiff] = Field(
        None, description="Field-level diff when the item is in both builds"
    )


# ---------------------------------------------------------------------------
# Transitions
# ---------------------------------------------------------------------------


class SharedTransition(BaseModel):
    """A field going from one value to another on several items of a build."""

    part: PartName
    path: str = Field(
        description="Field, as app/core/item_diff.transitions names it: "
        "'stat:79', 'stat:30:bit:8', 'effect:53089:spell_params.Chance', "
        "'action:6:criterion', 'event', 'name', ..."
    )
    old: Any = Field(
        None,
        description="Value before: a number, a word, a criterion as [value1, "
        "value2, operator]; null when absent or particular to each item",
    )
    new: Any = Field(None, description="Value after, as ``old``")
    items: int = Field(description="Changed items with this transition")
    occurrences: int = Field(description="Times it occurs in them")
    stat: Optional[int] = Field(
        None, description="The stat or skill id in ``path``, if any"
    )
    bit: Optional[int] = Field(None, description="The flag value in ``path``, if any")
    spell_id: Optional[int] = Field(
        None, description="The effect type in ``path``, if any"
    )
    action: Optional[int] = Field(None, description="The action id in ``path``, if any")
    field: Optional[str] = Field(
        None, description="The field of a changed effect in ``path``, if any"
    )


class BuildTransitionsResponse(BaseModel):
    """The most shared field transitions of a build's changes."""

    build: BuildRef
    base: Optional[BuildRef] = None
    transitions: List[SharedTransition] = Field(description="Most items first")
