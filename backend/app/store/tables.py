"""
Tables of the content-addressed store, as SQLAlchemy Core tables.

The definitions and the rules for reading each table are in
``backend/database/cas/001_store.sql``, ``002_curated_and_derived.sql`` and
``003_change_analysis.sql`` (what is derived about changes);
this module only names the tables and columns so queries can be composed.
Indexes and constraints are not repeated here: nothing creates tables from
this metadata.

Every table is declared in the logical schema ``LOGICAL_SCHEMA``. A store
session (``app.store.context``) maps that name to the schema the store really
lives in, so the same queries read a throwaway store in a test.
"""

from sqlalchemy import (
    Boolean,
    BigInteger,
    Column,
    Date,
    Integer,
    MetaData,
    Numeric,
    SmallInteger,
    String,
    Table,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB

LOGICAL_SCHEMA = "cas"

metadata = MetaData(schema=LOGICAL_SCHEMA)

build = Table(
    "build",
    metadata,
    Column("build_id", SmallInteger, primary_key=True),
    Column("slug", String(40), nullable=False),
    Column("branch", String(20), nullable=False),
    Column("ordinal", Integer, nullable=False),
    Column("sort_order", Integer, nullable=False),
    Column("display_name", String(120), nullable=False),
    Column("client_build", String(40)),
    Column("released_on", Date),
    Column("parent_build_id", SmallInteger),
    Column("enabled", Boolean, nullable=False),
    Column("is_default", Boolean, nullable=False),
    Column("features", JSONB, nullable=False),
    Column("overlay_strain_first", Boolean, nullable=False),
)

part_text = Table(
    "part_text",
    metadata,
    Column("text_id", Integer, primary_key=True),
    Column("hash", String(40), nullable=False),
    Column("name", Text, nullable=False),
    Column("description", Text, nullable=False),
)

part_stats = Table(
    "part_stats",
    metadata,
    Column("stats_id", Integer, primary_key=True),
    Column("hash", String(40), nullable=False),
    Column("doc", JSONB, nullable=False),
)

part_effects = Table(
    "part_effects",
    metadata,
    Column("effects_id", Integer, primary_key=True),
    Column("hash", String(40), nullable=False),
    Column("doc", JSONB, nullable=False),
)

part_actions = Table(
    "part_actions",
    metadata,
    Column("actions_id", Integer, primary_key=True),
    Column("hash", String(40), nullable=False),
    Column("doc", JSONB, nullable=False),
)

part_atkdef = Table(
    "part_atkdef",
    metadata,
    Column("atkdef_id", Integer, primary_key=True),
    Column("hash", String(40), nullable=False),
    Column("doc", JSONB, nullable=False),
)

part_misc = Table(
    "part_misc",
    metadata,
    Column("misc_id", Integer, primary_key=True),
    Column("hash", String(40), nullable=False),
    Column("doc", JSONB, nullable=False),
)

effect_type = Table(
    "effect_type",
    metadata,
    Column("spell_id", Integer, primary_key=True),
    Column("format", Text, nullable=False),
)

item_revision = Table(
    "item_revision",
    metadata,
    Column("rev_id", Integer, primary_key=True),
    Column("aoid", Integer, nullable=False),
    Column("hash", String(40), nullable=False),
    Column("is_nano", Boolean, nullable=False),
    Column("ql", Integer, nullable=False),
    Column("item_class", Integer, nullable=False),
    Column("text_id", Integer, nullable=False),
    Column("stats_id", Integer, nullable=False),
    Column("effects_id", Integer),
    Column("actions_id", Integer),
    Column("atkdef_id", Integer),
    Column("misc_id", Integer),
)

item_presence = Table(
    "item_presence",
    metadata,
    Column("branch", String(20), primary_key=True),
    Column("aoid", Integer, primary_key=True),
    Column("from_ordinal", Integer, primary_key=True),
    Column("to_ordinal", Integer, nullable=False),
    Column("rev_id", Integer, nullable=False),
)

stat_entry = Table(
    "stat_entry",
    metadata,
    Column("stats_id", Integer, nullable=False),
    Column("stat", Integer, nullable=False),
    Column("value", Integer, nullable=False),
)

requirement = Table(
    "requirement",
    metadata,
    Column("actions_id", Integer, primary_key=True),
    Column("action", Integer, primary_key=True),
    Column("position", Integer, primary_key=True),
    Column("value1", Integer, nullable=False),
    Column("value2", Integer, nullable=False),
    Column("operator", Integer, nullable=False),
)

effect_entry = Table(
    "effect_entry",
    metadata,
    Column("effects_id", Integer, nullable=False),
    Column("event", Integer, nullable=False),
    Column("spell_id", Integer, nullable=False),
    Column("target", Integer),
    Column("subject", BigInteger),
    Column("amount", Integer),
)

atkdef_entry = Table(
    "atkdef_entry",
    metadata,
    Column("atkdef_id", Integer, nullable=False),
    Column("is_attack", Boolean, nullable=False),
    Column("stat", Integer, nullable=False),
    Column("value", Integer, nullable=False),
)

build_note = Table(
    "build_note",
    metadata,
    Column("note_id", Integer, primary_key=True),
    Column("build_id", SmallInteger, nullable=False),
    Column("title", Text, nullable=False),
    Column("body", Text),
)

item_change = Table(
    "item_change",
    metadata,
    Column("branch", String(20), primary_key=True),
    Column("ordinal", Integer, primary_key=True),
    Column("aoid", Integer, primary_key=True),
    Column("kind", String(1), nullable=False),
    Column("old_rev_id", Integer),
    Column("new_rev_id", Integer),
    Column("parts_changed", SmallInteger, nullable=False),
    Column("relevance", SmallInteger),
    Column("note_id", Integer),
)

revision_relevance = Table(
    "revision_relevance",
    metadata,
    Column("rev_id", Integer, primary_key=True),
    Column("gameplay", BigInteger, nullable=False),
    Column("economy", BigInteger, nullable=False),
    Column("cosmetic", BigInteger, nullable=False),
    Column("effects", BigInteger, nullable=False),
)

build_transition = Table(
    "build_transition",
    metadata,
    Column("branch", String(20), nullable=False),
    Column("ordinal", Integer, nullable=False),
    Column("part", String(10), nullable=False),
    Column("path", Text, nullable=False),
    Column("old", JSONB),
    Column("new", JSONB),
    Column("items", Integer, nullable=False),
    Column("occurrences", Integer, nullable=False),
)

nano_overlay = Table(
    "nano_overlay",
    metadata,
    Column("aoid", Integer, primary_key=True),
    Column("ql", Integer, nullable=False),
    Column("strain", Integer),
    Column("substrain", Integer),
)

nano_properties = Table(
    "nano_properties",
    metadata,
    Column("rev_id", Integer, primary_key=True),
    Column("overlay_strain_first", Boolean, primary_key=True),
    Column("school", SmallInteger),
    Column("professions", ARRAY(Integer), nullable=False),
    Column("min_level", SmallInteger),
    Column("strain", Integer),
    Column("substrain", Integer),
)

symbiant_items = Table(
    "symbiant_items",
    metadata,
    Column("rev_id", Integer, primary_key=True),
    Column("aoid", Integer, nullable=False),
    Column("name", Text, nullable=False),
    Column("ql", Integer, nullable=False),
    Column("slot_id", Integer),
    Column("family", Text),
)

perk = Table(
    "perk",
    metadata,
    Column("aoid", Integer, primary_key=True),
    Column("name", String(128), nullable=False),
    Column("perk_series", String(128), nullable=False),
    Column("counter", Integer, nullable=False),
    Column("type", String(3), nullable=False),
    Column("level_required", Integer, nullable=False),
    Column("ai_level_required", Integer),
    Column("professions", ARRAY(Integer), nullable=False),
    Column("breeds", ARRAY(Integer), nullable=False),
)

mob = Table(
    "mob",
    metadata,
    Column("mob_id", Integer, primary_key=True),
    Column("name", String(255), nullable=False),
    Column("level", Integer),
    Column("playfield", String(100)),
    Column("location", String(255)),
    Column("mob_names", ARRAY(Text)),
    Column("is_pocket_boss", Boolean, nullable=False),
    Column("metadata", JSONB, nullable=False),
    Column("retired", Boolean, nullable=False),
)

source_type = Table(
    "source_type",
    metadata,
    Column("source_type_id", Integer, primary_key=True),
    Column("name", String(50), nullable=False),
    Column("description", Text),
)

source = Table(
    "source",
    metadata,
    Column("source_id", Integer, primary_key=True),
    Column("source_type_id", Integer, nullable=False),
    Column("entity_id", Integer, nullable=False),
    Column("name", String(255)),
    Column("metadata", JSONB, nullable=False),
)

item_source = Table(
    "item_source",
    metadata,
    Column("aoid", Integer, primary_key=True),
    Column("source_id", Integer, primary_key=True),
    Column("drop_rate", Numeric(5, 2)),
    Column("min_ql", Integer),
    Column("max_ql", Integer),
    Column("conditions", Text),
    Column("metadata", JSONB, nullable=False),
)
