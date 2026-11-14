"""
The weapons a character can consider, for TinkerFite's weapon analysis.

A weapon is an item of class 1 with an attack/defense block. One is returned
when all of these hold:

* its attack block gives at least half of the attack rating to one of the
  character's top weapon skills;
* it has a requirement of some kind (which leaves out mob weapons and props),
  or it is one of the Martial Arts Item templates;
* nothing about wielding it excludes the character: it is not NPC-only, and
  its faction, breed, profession and expansion requirements are met.

The level and the skill values of the request do not filter: every QL variant
is returned, so the client can interpolate.
"""

from typing import Any, Dict, List

from sqlalchemy import ColumnElement, Select, and_, or_
from sqlalchemy.orm import Session

from app.api.schemas.weapon_analysis import WeaponAnalyzeRequest
from app.store import tables as t
from app.store.context import Build
from app.store.items import (
    actions_response,
    load_effect_formats,
    load_records,
    load_sources,
    spell_data_response,
    stats_response,
)
from app.store.presence import any_of, has_atkdef, has_requirement, has_stat, revisions

WEAPON_ITEM_CLASS = 1
ACTION_WIELD = 8

STAT_BREED = 4
STAT_FACTION = 33
STAT_PROFESSION = 60
STAT_VISUAL_PROFESSION = 368
STAT_EXPANSION = 389
STAT_NPC_FAMILY = 455

OPERATOR_BIT_SET = 22
OPERATOR_BIT_NOT_SET = 107

# The least share of the attack rating a skill must give for the weapon to
# count as a weapon of that skill.
MIN_SKILL_SHARE = 50

# Player-equippable items that legitimately have no wield action criteria.
# These are the "Martial Arts Item" (unarmed combat) templates; the client
# selects one based on profession + MA skill rather than via wield
# requirements. See client PlayerCharacter.cs:184-259.
MARTIAL_ARTS_ITEM_AOIDS = (
    # Family 1: Martial Artist (profession 2)
    211352,
    211353,
    211354,
    211357,
    211358,
    211363,
    211364,
    # Family 2: Shade (profession 15)
    211349,
    211350,
    211351,
    211359,
    211360,
    211365,
    211366,
    # Family 3: Generic fallback (all other professions)
    43712,
    43713,
    144745,
    211355,
    211356,
    211361,
    211362,
)


def _wield_requires(*conditions: ColumnElement) -> ColumnElement:
    """The Wield action has a criterion meeting ``conditions``."""
    return has_requirement(t.requirement.c.action == ACTION_WIELD, *conditions)


def _excluded_by_wield(request: WeaponAnalyzeRequest) -> List[ColumnElement]:
    """Wield criteria that rule the character out, whatever else the action
    asks for."""
    stat = t.requirement.c.value1
    value = t.requirement.c.value2
    operator = t.requirement.c.operator
    owned = value.op("&")(request.expansion_bitflag)
    return [
        _wield_requires(stat == STAT_NPC_FAMILY),
        _wield_requires(stat == STAT_BREED, value != request.breed_id, value != 0),
        _wield_requires(
            stat == STAT_EXPANSION, operator == OPERATOR_BIT_SET, owned != value
        ),
        _wield_requires(
            stat == STAT_EXPANSION, operator == OPERATOR_BIT_NOT_SET, owned != 0
        ),
    ]


def weapon_query(build: Build, request: WeaponAnalyzeRequest) -> Select:
    """The revisions of ``build`` that are weapons for the character."""
    revision = t.item_revision
    skills = [skill.skill_id for skill in request.top_weapon_skills]
    query = revisions(build).where(
        revision.c.item_class == WEAPON_ITEM_CLASS,
        has_atkdef(
            t.atkdef_entry.c.is_attack,
            any_of(t.atkdef_entry.c.stat, skills),
            t.atkdef_entry.c.value >= MIN_SKILL_SHARE,
        ),
        or_(has_requirement(), any_of(revision.c.aoid, MARTIAL_ARTS_ITEM_AOIDS)),
        *(~excluded for excluded in _excluded_by_wield(request)),
    )

    # Side 0 is neutral and can use the weapons of every faction.
    if request.side > 0:
        query = query.where(
            ~has_stat(
                t.stat_entry.c.stat == STAT_FACTION,
                t.stat_entry.c.value != request.side,
                t.stat_entry.c.value != 0,
            )
        )

    # A weapon restricted by profession lists one criterion per profession
    # allowed; value 0 stands for any. Profession 0 in the request is "any".
    if request.profession_id > 0:
        names_profession = t.requirement.c.value1.in_(
            (STAT_PROFESSION, STAT_VISUAL_PROFESSION)
        )
        query = query.where(
            or_(
                ~_wield_requires(names_profession),
                _wield_requires(
                    and_(
                        names_profession,
                        t.requirement.c.value2.in_((request.profession_id, 0)),
                    )
                ),
            )
        )
    return query


def filter_weapons(
    db: Session, build: Build, request: WeaponAnalyzeRequest
) -> List[Dict[str, Any]]:
    """The weapons of ``build`` for the character, by AOID, each as the JSON
    document of its ``ItemDetail``.

    A character has several hundred to well over a thousand weapons. They are
    built as plain documents because validating that many response models
    costs more than finding and loading the weapons does.
    """
    rev_ids = db.execute(
        weapon_query(build, request).order_by(t.item_revision.c.aoid)
    ).scalars()
    records = load_records(db, build, rev_ids=list(rev_ids))
    if not records:
        return []
    formats = load_effect_formats(db)
    sources = load_sources(db, build, [record.aoid for record in records])
    return [
        {
            "aoid": record.aoid,
            "name": record.name,
            "ql": record.ql,
            "item_class": record.item_class,
            "description": record.description,
            "is_nano": record.is_nano,
            "id": record.aoid,
            "stats": stats_response(record.stats),
            "spell_data": spell_data_response(record, formats),
            "attack_stats": stats_response(record.attack),
            "defense_stats": stats_response(record.defense),
            "actions": actions_response(record),
            "sources": [
                source.model_dump(mode="json")
                for source in sources.get(record.aoid, ())
            ],
        }
        for record in records
    ]
