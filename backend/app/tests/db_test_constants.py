"""
Real database record identifiers for testing.

This module contains constants for specific AOIDs and IDs from the production
TinkerTools database. These records have known characteristics and are used
in tests to replace mock data with real database queries.

All values are taken from database research and represent stable, well-known
game data that can be reliably used in tests.

Usage:
    from app.tests.db_test_constants import ITEM_PISTOL_MASTERY
    from app.tests.db_helpers import get_item_by_aoid

    item = await get_item_by_aoid(session, ITEM_PISTOL_MASTERY)
"""

# =============================================================================
# Items - Varied Stat Counts
# =============================================================================

# Items with many stats - Perfect for complex relationship testing
ITEM_PISTOL_MASTERY = 29246  # ID: 121201, QL: 24, 26 stats, 29 sources
ITEM_NEURONAL_STIMULATOR = 220345  # ID: 126011, QL: 25, 27 stats, 18 sources
ITEM_SILENT_DAGGER = 210789  # ID: 124784, QL: 60, 25 stats, 12 sources

# Items with few stats - Perfect for simple tests
ITEM_CELL_SCANNER = 24562  # ID: 83, QL: 1, 6 stats
ITEM_UNNAMED = 42131  # ID: 994, QL: 1, 6 stats, no name (edge case)

# Profession items - All have 7 stats, QL: 1
ITEM_AGENT = 46228  # ID: 1502
ITEM_ADVENTURER = 46226  # ID: 1500
ITEM_ENGINEER = 46229  # ID: 1503

# =============================================================================
# Items - QL Ranges (for query/filter tests)
# =============================================================================

ITEM_LOW_QL = 220309  # ID: 86236, QL: 1-50, "One Monster Spawner"
ITEM_MID_LOW_QL = 219132  # ID: 86185, QL: 100-150, "Breathing Ocular Symbiant"
ITEM_MID_HIGH_QL = 219137  # ID: 86190, QL: 200-250, "Vigorous Ocular Symbiant"
ITEM_HIGH_QL = 219139  # ID: 86192, QL: 300-350, "Intelligent Ocular Symbiant"

# Items with many sources
ITEM_FERVOR_DEVOTEE = 210323  # 11 sources
ITEM_FERVOR_MINION = 210325  # 11 sources

# =============================================================================
# Symbiant Items - For mob drop testing
# =============================================================================

# Adobe Suzerain (Mob 1171) drops - 7 symbiants
ITEM_SYMBIANT_ADOBE_ARTILLERY_OCULAR = 219135  # ID: 86188, QL: 170, Artillery Unit Aban
ITEM_SYMBIANT_ADOBE_INFANTRY_THIGH = 235792  # ID: 94098, QL: 170, Infantry Unit Aban
ITEM_SYMBIANT_ADOBE_INFANTRY_FEET = 235825  # ID: 94131, QL: 150, Infantry Unit Aban

# Aesma Daeva (Mob 1172) drops - 1 symbiant
ITEM_SYMBIANT_AESMA_INFANTRY_LEFT_ARM = 235711  # ID: 94018, QL: 260, Infantry Unit Aban

# Ahpta (Mob 1173) drops - 5 symbiants
ITEM_SYMBIANT_AHPTA_ARTILLERY_FEET = 235612  # ID: 93919, QL: 250, Artillery Unit Aban
ITEM_SYMBIANT_AHPTA_CONTROL_OCULAR = 236297  # ID: 94602, QL: 270, Control Unit Aban
ITEM_SYMBIANT_AHPTA_CONTROL_BRAIN = 236312  # ID: 94616, QL: 250, Control Unit Aban

# =============================================================================
# Perks - Shadowlands (SL)
# =============================================================================

# Accumulator series - Perfect for testing perk progression
PERK_SL_ACCUMULATOR_1_ITEM_ID = 82832  # AOID: 210830, Counter: 1, Level: 10
PERK_SL_ACCUMULATOR_1_AOID = 210830

PERK_SL_ACCUMULATOR_2_ITEM_ID = 82833  # AOID: 210831, Counter: 2, Level: 20
PERK_SL_ACCUMULATOR_2_AOID = 210831

PERK_SL_ACCUMULATOR_3_ITEM_ID = 82834  # AOID: 210832, Counter: 3, Level: 40
PERK_SL_ACCUMULATOR_3_AOID = 210832

PERK_SL_ACCUMULATOR_4_ITEM_ID = 82835  # AOID: 210833, Counter: 4, Level: 60
PERK_SL_ACCUMULATOR_4_AOID = 210833

PERK_SL_ACCUMULATOR_5_ITEM_ID = 82836  # AOID: 210834, Counter: 5, Level: 80
PERK_SL_ACCUMULATOR_5_AOID = 210834

# All Accumulator perks have 1 profession restriction, 0 breed restrictions

# =============================================================================
# Perks - Alien Invasion (AI)
# =============================================================================

# Opportunist series
PERK_AI_OPPORTUNIST_1_ITEM_ID = 102602  # AOID: 252479, Counter: 1, Level: 15
PERK_AI_OPPORTUNIST_1_AOID = 252479

PERK_AI_OPPORTUNIST_2_ITEM_ID = 102603  # AOID: 252480, Counter: 2, Level: 25
PERK_AI_OPPORTUNIST_2_AOID = 252480

# Alien Technology Expertise
PERK_AI_TECH_1_ITEM_ID = 99464  # AOID: 247748, Counter: 1, Level: 15
PERK_AI_TECH_1_AOID = 247748

# =============================================================================
# Perks - Lost Eden (LE)
# =============================================================================

# Exploration series
PERK_LE_EXPLORATION_1_ITEM_ID = 104965  # AOID: 260870, Counter: 1, Level: 1
PERK_LE_EXPLORATION_1_AOID = 260870

PERK_LE_EXPLORATION_2_ITEM_ID = 104966  # AOID: 260871, Counter: 2, Level: 50
PERK_LE_EXPLORATION_2_AOID = 260871

PERK_LE_EXPLORATION_3_ITEM_ID = 104967  # AOID: 260872, Counter: 3, Level: 75
PERK_LE_EXPLORATION_3_AOID = 260872

# =============================================================================
# Stat Values
# =============================================================================

# Common stats (high occurrence count)
STAT_ID_COMMON_0 = 103  # Stat 0, 714 occurrences, Value: -864026591
STAT_ID_COMMON_1 = 888  # Stat 1, 30 occurrences, Value: 5000
STAT_ID_COMMON_2 = 146  # Stat 2, 259 occurrences, Value: 6400
STAT_ID_COMMON_8 = 793  # Stat 8, 622 occurrences, Value: 100

# Rare stats (low occurrence count)
STAT_ID_RARE_3 = 1061  # Stat 3, 3 occurrences, Value: 0
STAT_ID_RARE_4 = 11066  # Stat 4, 1 occurrence, Value: 15
STAT_ID_RARE_5 = 9748  # Stat 5, 1 occurrence, Value: 15
STAT_ID_RARE_6 = 11973  # Stat 6, 1 occurrence, Value: 15

# Extreme value stats (edge cases)
STAT_ID_HIGH_VALUE_1 = 2144  # Stat 75, Value: 2138539184
STAT_ID_HIGH_VALUE_2 = 37162  # Stat 272, Value: 2109947473
STAT_ID_HIGH_VALUE_3 = 8077  # Stat 75, Value: 2096210229

STAT_ID_LOW_VALUE_1 = 28015  # Stat 0, Value: -2147483647 (INT_MIN)
STAT_ID_LOW_VALUE_2 = 34151  # Stat 0, Value: -2147483646
STAT_ID_LOW_VALUE_3 = 12775  # Stat 0, Value: -2147483645

# =============================================================================
# Spells
# =============================================================================

# Spells with many criteria (complex relationships)
SPELL_ID_COMPLEX_1 = 234997  # Spell AOID: 53016, 34 criteria
SPELL_ID_COMPLEX_2 = 236442  # Spell AOID: 53016, 29 criteria
SPELL_ID_COMPLEX_3 = 339369  # Spell AOID: 53016, 26 criteria
SPELL_ID_COMPLEX_4 = 238215  # Spell AOID: 53044, 26 criteria
SPELL_ID_COMPLEX_5 = 292151  # Spell AOID: 53033, 25 criteria

# Spells without criteria (simple/edge cases)
SPELL_ID_SIMPLE_1 = 1  # Spell AOID: 53039, 0 criteria
SPELL_ID_SIMPLE_2 = 2  # Spell AOID: 53045, 0 criteria
SPELL_ID_SIMPLE_3 = 3  # Spell AOID: 53045, 0 criteria
SPELL_ID_SIMPLE_4 = 4  # Spell AOID: 53045, 0 criteria
SPELL_ID_SIMPLE_5 = 5  # Spell AOID: 53045, 0 criteria

# =============================================================================
# Mobs (Pocket Bosses)
# =============================================================================

MOB_ID_ADOBE_SUZERAIN = 1171  # Level: 125, Playfield: "Scheol Upper", 7 items
MOB_ID_AESMA_DAEVA = 1172  # Level: 220, Playfield: "Inferno Frontier", 1 item
MOB_ID_AHPTA = 1173  # Level: 220, Playfield: "Inferno Frontier", 5 items
MOB_ID_ALATYR = 1174  # Level: 188, Playfield: "Penumbra Forest"
MOB_ID_ANYA = 1175  # Level: 185, Playfield: "Penumbra Valley"

# All mobs in the database are pocket bosses (is_pocket_boss = True)

# =============================================================================
# Source Types
# =============================================================================

SOURCE_TYPE_ID_ITEM = 1  # "Items that create/upload other items (e.g., nanocr...)"
SOURCE_TYPE_ID_NPC = 2  # "NPCs and mobs that drop items"
SOURCE_TYPE_ID_MOB = 3  # "Items dropped by mobs"
SOURCE_TYPE_ID_MISSION = 4  # "Missions that reward items"
SOURCE_TYPE_ID_VENDOR = 5  # "Vendors and shops that sell items"

# =============================================================================
# Sources
# =============================================================================

# Item sources (nano crystals)
SOURCE_ID_1H_BLUNT_NC = 160  # Source ID: 26464, "Nano Crystal (1H Blunt Weapon Expertise)"
SOURCE_ID_1H_BLUNT_CORRODED = 161  # Source ID: 221375, "Badly Corroded Crystal (1H Blunt...)"
SOURCE_ID_1H_BLUNT_INCOMP = 162  # Source ID: 26462, "Nano Crystal (1H Blunt Weapon Incompeten...)"

# Mob sources (with item drops)
SOURCE_ID_MOB_ADOBE_SUZERAIN = 1  # Source ID: 1171, 7 items dropped
SOURCE_ID_MOB_AESMA_DAEVA = 2  # Source ID: 1172, 1 item dropped
SOURCE_ID_MOB_AHPTA = 3  # Source ID: 1173, 5 items dropped
