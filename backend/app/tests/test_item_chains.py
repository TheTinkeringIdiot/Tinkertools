"""
Tests for the item chains file (backend/database/item_chains.toml) as
app/core/item_chains.py reads it.
"""

import pytest

from app.core.item_chains import ChainsError, ItemChain, parse_chains, read_chains

BELTS = """
[[chain]]
name = "belts"
effect = 53045
stat = 45
rungs = [3, 1, 2]
"""


def test_every_rung_names_its_chain():
    chains = parse_chains(
        BELTS + '[[chain]]\nname="chips"\neffect=1\nstat=2\nrungs=[8, 9]'
    )

    belts = ItemChain(name="belts", effect=53045, stat=45, rungs=frozenset({1, 2, 3}))
    assert {aoid: chain.name for aoid, chain in chains.items()} == {
        1: "belts",
        2: "belts",
        3: "belts",
        8: "chips",
        9: "chips",
    }
    assert chains[1] == belts


def test_a_file_without_chains_has_none():
    assert parse_chains("") == {}


def test_the_file_of_the_repository_is_valid():
    chains = read_chains()

    assert {chain.name for chain in chains.values()} == {"NCU belts", "NCU memory"}


@pytest.mark.parametrize(
    "text,message",
    [
        ("[[chain]\n", "item chains file"),
        ("chains = 1\n", "unknown keys ['chains']"),
        ("[[chain]]\neffect = 1\n", "chain 1: name is required"),
        (BELTS + BELTS, "chain 'belts': defined twice"),
        (BELTS + "colour = 1\n", "chain 'belts': unknown keys ['colour']"),
        (
            BELTS.replace("stat = 45", 'stat = "45"'),
            "chain 'belts': stat is an integer",
        ),
        (BELTS.replace("effect = 53045\n", ""), "chain 'belts': effect is an integer"),
        (BELTS.replace("[3, 1, 2]", "[3, 3]"), "at least two different AOIDs"),
        (BELTS.replace("[3, 1, 2]", "[3]"), "at least two different AOIDs"),
        (BELTS.replace("[3, 1, 2]", '["3", 1]'), "rungs is a list of AOIDs"),
        (
            BELTS + BELTS.replace("belts", "chips").replace("[3, 1, 2]", "[2, 7]"),
            "chain 'chips': 2 is already a rung of 'belts'",
        ),
    ],
)
def test_a_file_that_cannot_be_used_is_refused(text, message):
    with pytest.raises(ChainsError) as error:
        parse_chains(text)

    assert message in str(error.value)
