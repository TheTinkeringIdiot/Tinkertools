"""
The backend's strain names must match the frontend's NANO_STRAIN table.
"""

import re
from pathlib import Path

import pytest

from app.core.nano_properties import strain_ids, strain_name
from app.core.nano_strains import NANO_STRAINS

GAME_DATA = (
    Path(__file__).resolve().parents[3]
    / "frontend"
    / "src"
    / "services"
    / "game-data.ts"
)


def _frontend_strains():
    source = GAME_DATA.read_text(encoding="utf-8")
    block = source[source.index("export const NANO_STRAIN = {") :]
    block = block[: block.index("} as const;")]
    entries = re.findall(
        r"^\s*(\d+):\s*(['\"])((?:\\.|(?!\2).)*)\2,?\s*$", block, re.MULTILINE
    )
    return {int(key): value.replace("\\'", "'") for key, _, value in entries}


@pytest.mark.skipif(not GAME_DATA.exists(), reason="frontend sources not present")
def test_strain_names_match_frontend_table():
    assert NANO_STRAINS == _frontend_strains()


def test_strain_lookups():
    assert strain_name(16) == "General 1Hand Blunt Buff"
    assert strain_name(None) is None
    assert strain_name(123456) is None
    assert strain_ids("16") == [16]
    assert strain_ids("general 1hand blunt buff") == [16]
    assert len(strain_ids("Reconstruction")) > 1  # a name several ids share
    assert strain_ids("No Such Strain") == []
