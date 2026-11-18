"""
Item chains: ladders of differently named items that interpolate into one
another (``backend/database/item_chains.toml``, which states the rule).

The file is hand-edited and read here, validated, for the interpolation
service (app/services/interpolation.py). It is not imported into the store.
"""

import tomllib
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, FrozenSet, Mapping

CHAINS_FILE = Path(__file__).resolve().parents[2] / "database" / "item_chains.toml"

_KEYS = frozenset({"name", "effect", "stat", "rungs"})


class ChainsError(ValueError):
    """A chains file that cannot be used as it is written."""


@dataclass(frozen=True)
class ItemChain:
    """One chain: the AOIDs of its rungs, and the effect type (``spell_id``)
    and modified stat of the effect whose amount is its key value."""

    name: str
    effect: int
    stat: int
    rungs: FrozenSet[int]


def _integer(raw: Mapping[str, Any], key: str, where: str) -> int:
    value = raw.get(key)
    if type(value) is not int:
        raise ChainsError(f"{where}: {key} is an integer")
    return value


def parse_chains(text: str) -> Dict[int, ItemChain]:
    """The chain of every rung, by AOID."""
    try:
        data = tomllib.loads(text)
    except tomllib.TOMLDecodeError as error:
        raise ChainsError(f"item chains file: {error}") from error
    unknown = set(data) - {"chain"}
    if unknown:
        raise ChainsError(f"item chains file: unknown keys {sorted(unknown)}")
    chains: Dict[int, ItemChain] = {}
    names = set()
    for index, raw in enumerate(data.get("chain") or [], start=1):
        where = f"chain {index}"
        if not isinstance(raw.get("name"), str) or not raw["name"].strip():
            raise ChainsError(f"{where}: name is required")
        where = f"chain '{raw['name']}'"
        if raw["name"] in names:
            raise ChainsError(f"{where}: defined twice")
        names.add(raw["name"])
        unknown = set(raw) - _KEYS
        if unknown:
            raise ChainsError(f"{where}: unknown keys {sorted(unknown)}")
        rungs = raw.get("rungs")
        if not isinstance(rungs, list) or any(type(aoid) is not int for aoid in rungs):
            raise ChainsError(f"{where}: rungs is a list of AOIDs")
        if len(set(rungs)) != len(rungs) or len(rungs) < 2:
            raise ChainsError(f"{where}: rungs needs at least two different AOIDs")
        chain = ItemChain(
            name=raw["name"],
            effect=_integer(raw, "effect", where),
            stat=_integer(raw, "stat", where),
            rungs=frozenset(rungs),
        )
        for aoid in rungs:
            if aoid in chains:
                raise ChainsError(
                    f"{where}: {aoid} is already a rung of '{chains[aoid].name}'"
                )
            chains[aoid] = chain
    return chains


def read_chains(path: Path = CHAINS_FILE) -> Dict[int, ItemChain]:
    return parse_chains(path.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def default_chains() -> Dict[int, ItemChain]:
    """The chains of the file in the repository, read once per process."""
    return read_chains()
