# Anarchy Online IP (Improvement Points) Calculation System

This document provides a comprehensive analysis of the Anarchy Online Improvement Points (IP) system based on the AOSkills4 implementation (`modSkills.vb`). This system is crucial for character development and forms the foundation for all skill and ability calculations in the game.

## Table of Contents

1. [System Overview](#system-overview)
2. [Title Level System](#title-level-system)
3. [IP Allocation by Level](#ip-allocation-by-level)
4. [Skill Cost Calculations](#skill-cost-calculations)
5. [Ability Cost Calculations](#ability-cost-calculations)
6. [Skill Caps and Limitations](#skill-caps-and-limitations)
7. [Trickle-Down System](#trickle-down-system)
8. [Health and Nano Pool Calculations](#health-and-nano-pool-calculations)
9. [Data Tables Reference](#data-tables-reference)
10. [Implementation Details](#implementation-details)

## System Overview

The Improvement Points (IP) system in Anarchy Online is a complex character advancement mechanism where players spend IP to raise their abilities (attributes) and skills. The system has several key characteristics:

- **IP is finite** - Each level provides a specific amount of IP
- **Costs scale** - Higher skill/ability levels cost more IP per point
- **Profession matters** - Different professions have different costs for skills
- **Breed affects abilities** - Different breeds have varying ability costs and caps
- **Title Levels create breakpoints** - Progression changes at specific level thresholds

## Title Level System

The game uses "Title Levels" (TL) to create progression breakpoints. These are not the same as character levels but represent major advancement phases:

```
TL1: Levels 1-14    (Newbie)
TL2: Levels 15-49   (Beginner)
TL3: Levels 50-99   (Intermediate)
TL4: Levels 100-149 (Advanced)
TL5: Levels 150-189 (Expert)
TL6: Levels 190-204 (Master)
TL7: Levels 205+    (Grandmaster/Shadowlands)
```

### Title Level Functions

```vb
Public Function calcTitleLevel(ByVal level As Integer) As Integer
    Dim i As Integer
    For i = 1 To 6
        If (level < titleLevels(i)) Then
            Return i
        End If
    Next
    Return 7
End Function
```

Title levels affect:

- Skill caps (maximum attainable skill values)
- IP gain rates
- Health and Nano Pool progression

## IP Allocation by Level

Each level provides IP according to a complex formula based on title level:

### Base IP by Title Level

```
TL1: 1,500 base + (level - 1) × 4,000 IP per level
TL2: 53,500 base + (level - 14) × 10,000 IP per level
TL3: 403,500 base + (level - 49) × 20,000 IP per level
TL4: 1,403,500 base + (level - 99) × 40,000 IP per level
TL5: 3,403,500 base + (level - 149) × 80,000 IP per level
TL6: 6,603,500 base + (level - 189) × 150,000 IP per level
TL7: 8,853,500 base + (level - 204) × 600,000 IP per level
```

### IP Calculation Function

```vb
Public Function calcIP(ByVal level As Integer) As Int32
    Dim tl As Integer
    tl = CInt(IIf(level = 1, 0, calcTitleLevel(level)))
    Return BaseIPByTL(tl) + ((level - LevelAdjustByTL(tl)) * IPByTL(tl))
End Function
```

### Example IP Totals

- Level 1: 1,500 IP
- Level 15: 57,500 IP
- Level 50: 763,500 IP
- Level 100: 1,823,500 IP
- Level 200: 19,853,500 IP
- Level 220: 32,853,500 IP

## Skill Cost Calculations

Skills have profession-specific cost multipliers that determine how much IP is required to raise them.

### Cost Multiplier Matrix

The system uses a 97×14 matrix where:

- **Rows**: 97 different skills (0-96)
- **Columns**: 14 professions (Adventurer, Agent, Bureaucrat, Doctor, Enforcer, Engineer, Fixer, Keeper, MA, MP, NT, Shade, Soldier, Trader)

### Example Cost Multipliers (first few skills)

```
Skill               Adv  Agt  Bur  Doc  Enf  Eng  Fix  Kep  MA   MP   NT   Shd  Sol  Trd
Body Development   1.2  2.4  2.4  2.0  1.0  2.4  1.8  1.2  1.5  2.4  2.4  2.6  1.1  2.0
Nano Pool         1.6  1.2  1.4  1.0  2.0  1.8  1.6  2.2  1.6  1.0  1.0  2.5  2.0  1.2
Martial Arts      2.8  1.6  2.8  2.0  1.6  2.8  2.8  3.0  1.0  2.8  2.8  1.6  2.0  2.0
```

### Skill Cost Calculation

The IP cost to raise a skill by one point:

```vb
Public Function calcSkillCost(ByVal curBS As Integer, ByVal profID As Integer, ByVal skillID As Integer) As Double
    Return (curBS) * skillCosts(skillID, profID)
End Function
```

The total IP cost for a skill at a given level:

```vb
Public Function calcTotalSkillCost(ByVal curBS As Integer, ByVal profID As Integer, ByVal skillID As Integer) As Int32
    Dim totalIP As Double
    Dim i As Integer

    totalIP = 0
    If curBS > 0 Then
        For i = 0 To curBS - 1
            totalIP = totalIP + roundDown(calcSkillCost(i + BASE_SKILL, profID, skillID))
        Next
    End If
    Return CInt(totalIP)
End Function
```

**Key insight**: Cost increases linearly with skill level. A skill at level 100 costs 100× the base multiplier per additional point.

### Professional Specializations

Each profession has skills they excel in (low multipliers) and skills they struggle with (high multipliers):

- **Soldier**: Combat skills (1.0-1.5×), poor at nano skills (4.0×)
- **Doctor**: Medical skills (1.0×), nano skills (1.0-1.6×), poor at weapons
- **Engineer**: Technical skills (1.0×), crafting (1.0-1.4×), moderate combat
- **Agent**: Balanced overall with specialization in stealth and ranged

## Ability Cost Calculations

Abilities (Strength, Agility, Stamina, Intelligence, Sense, Psychic) have breed-specific costs.

### Breed Cost Multipliers

```
Breed      Str  Agi  Sta  Int  Sen  Psy
Solitus     2    2    2    2    2    2    (balanced)
Opifex      2    1    3    2    1    2    (agile, weak stamina)
Nanomage    3    3    2    1    2    1    (intelligent, physically weak)
Atrox       1    2    1    3    3    3    (strong, poor mental stats)
```

### Ability Cost Calculation

```vb
Public Function calcAttrCost(ByVal curAV As Integer, ByVal breedID As Integer, ByVal attrID As Integer) As Double
    Return curAV * breedCosts(breedID, attrID)
End Function
```

### Total Ability Cost

```vb
Public Function calcTotalAttrCost(ByVal curAV As Integer, ByVal breedID As Integer, ByVal attrID As Integer) As Int32
    Dim totalIP As Double
    Dim i As Integer

    totalIP = 0
    If curAV > 0 Then
        For i = 0 To curAV - 1
            totalIP = totalIP + roundDown(calcAttrCost(i + breedInit(breedID, attrID), breedID, attrID))
        Next
    End If
    Return CInt(totalIP)
End Function
```

### Breed Starting Values

```
Breed      Str  Agi  Sta  Int  Sen  Psy
Solitus     6    6    6    6    6    6
Opifex      3   15    6    6   10    3
Nanomage    3    3    3   15    6   10
Atrox      15    6   10    3    3    3
```

## Skill Caps and Limitations

Skills are limited by multiple factors that create a complex interaction system.

### Level-Based Caps

Each skill has maximum values based on character level and profession. The system uses cost factors to determine caps:

```vb
Public Function calcLevelCap(ByVal level As Integer, ByVal profID As Integer, ByVal skillID As Integer) As Integer
    Dim tl As Integer
    Dim costFac As Double = skillCosts(skillID, profID)
    Dim maxValCap As Integer
    Dim maxVal As Integer

    tl = calcTitleLevel(level)
    If level < 201 Then
        maxValCap = CInt(costToRate(CInt((costFac * 10) - 10), tl + 1))
        If tl = 1 Then
            maxVal = CInt(costToRate(CInt((costFac * 10) - 10), 1) * level)
        Else
            maxVal = CInt(costToRate(CInt((costFac * 10) - 10), tl) + costToRate(CInt((costFac * 10) - 10), 1) * (level - calcPrevTitleLevel(level)))
        End If
        maxValCap = CInt(IIf(maxValCap > maxVal, maxVal, maxValCap))
    Else
        maxValCap = CInt(costToRate(CInt((costFac * 10) - 10), 7) + (level - 200) * costToRate(CInt((costFac * 10) - 10), 8))
    End If
    Return maxValCap
End Function
```

### Cost-to-Rate Conversion Table

The `costToRate` matrix converts skill cost factors to actual skill caps:

```
Cost   Inc/Lvl  TL1  TL2  TL3  TL4  TL5  TL6  Post-201/Lvl
1.0      5      55   195  355  485  545  595     25
1.1      5      55   195  355  485  545  595     25
...
2.5      4      45   155  295  405  445  475     15
...
4.0      3      40   135  265  365  395  415     10
...
5.0      3      35   115  245  325  345  355      5
```

### Ability-Based Caps (Soft Caps)

Skills are also limited by character abilities through the trickle-down system:

```vb
Public Function calcAbilityCap(ByVal abilities() As Integer, ByVal skillID As Integer) As Integer
    Dim weightedAbility As Double
    Dim i As Integer

    weightedAbility = 0
    For i = 0 To 5
        weightedAbility = weightedAbility + abilities(i) * skillAbilities(skillID, i)
    Next
    Return roundAO(((weightedAbility - 5) * 2) + 5)
End Function
```

**The final skill cap is the minimum of level-based and ability-based caps.**

## Trickle-Down System

Abilities provide free skill points through "trickle-down" bonuses. Each skill receives bonuses based on a weighted combination of abilities.

### Trickle-Down Factors Matrix

A 97×6 matrix defines how each ability contributes to each skill:

```vb
' Example: Martial Arts skill (skillID = 2)
{0.2, 0.5, 0.0, 0.0, 0.0, 0.3}  ' 20% Str, 50% Agi, 30% Psy

' Example: 1h Blunt skill (skillID = 8)
{0.5, 0.1, 0.4, 0.0, 0.0, 0.0}  ' 50% Str, 10% Agi, 40% Sta
```

### Trickle-Down Calculation

```vb
Public Function calcTrickleDown(ByVal abilities() As Integer, ByVal skillID As Integer) As Integer
    Dim i As Integer
    Dim weightedAbility As Double = 0

    For i = 0 To 5
        weightedAbility = weightedAbility + (abilities(i) * skillAbilities(skillID, i))
    Next
    Return roundDown(weightedAbility / 4.0)
End Function
```

### Examples

For a character with abilities [100, 150, 120, 80, 90, 70]:

**Martial Arts**: (100×0.2 + 150×0.5 + 120×0.0 + 80×0.0 + 90×0.0 + 70×0.3) / 4 = 37 free points

**1h Blunt**: (100×0.5 + 150×0.1 + 120×0.4 + 80×0.0 + 90×0.0 + 70×0.0) / 4 = 26 free points

## Health and Nano Pool Calculations

### Health Calculation

Health depends on Body Development skill, character level, breed, and profession:

```vb
Public Function calcHP(ByVal bd As Integer, ByVal level As Integer, ByVal breedID As Integer, ByVal profID As Integer) As Integer
    Dim tl As Integer
    Dim lhp As Integer = 0

    tl = calcTitleLevel(level)
    tl = CInt(IIf(tl = 7, 6, tl))
    lhp = (profHP(tl - 1, profID) + breedHP(breedID)) * level
    Return breedBaseHP(breedID) + (bd * breedBodyFac(breedID)) + lhp
End Function
```

**Components**:

- **Base HP by breed**: Solitus/Atrox: 10/25, Opifex/Nanomage: 15/10
- **Body Development bonus**: BD skill × breed factor (2-4)
- **Level bonus**: Level × (profession HP + breed modifier)

### Nano Pool Calculation

Similar to health but based on Nano Pool skill:

```vb
Public Function calcNP(ByVal np As Integer, ByVal level As Integer, ByVal breedID As Integer, ByVal profID As Integer) As Integer
    Dim tl As Integer
    Dim lnp As Integer = 0

    tl = calcTitleLevel(level)
    tl = CInt(IIf(tl = 7, 6, tl))
    lnp = (profNP(tl - 1, profID) + breedNP(breedID)) * level
    Return breedBaseNP(breedID) + (np * breedNanoFac(breedID)) + lnp
End Function
```

## Data Tables Reference

### Profession IDs

```
0: Adventurer    7: Keeper
1: Agent         8: Martial Artist
2: Bureaucrat    9: Meta-Physicist
3: Doctor       10: Nano-Technician
4: Enforcer     11: Shade
5: Engineer     12: Soldier
6: Fixer        13: Trader
```

### Breed IDs

```
0: Solitus
1: Opifex
2: Nanomage
3: Atrox
```

### Skill IDs (first 20)

```
0: Body Dev        10: Piercing
1: Nano Pool       11: 2h Blunt
2: Martial Arts    12: 2h Edged
3: Brawling        13: Melee Energy
4: Dimach          14: Deflect
5: Riposte         15: Sneak Attack
6: Adventuring     16: Mult. Melee
7: Swimming        17: Fast Attack
8: 1h Blunt        18: Sharp Obj
9: 1h Edged        19: Grenade
```

### Ability IDs

```
0: Strength
1: Agility
2: Stamina
3: Intelligence
4: Sense
5: Psychic
```

## Implementation Details

### Rounding Functions

The system uses specific rounding rules:

```vb
' AO-specific rounding (round down if < 0.5, up otherwise)
Public Function roundAO(ByVal n As Double) As Integer
    Return CInt(Math.Floor(n + 0.5))
End Function

' Always round down
Public Function roundDown(ByVal n As Double) As Integer
    Return CInt(Math.Floor(n))
End Function
```

### Ability Caps by Level

Pre-201: `(level × 3) + breed_init[breed][ability]`, capped by breed maximum

Post-201: `breed_cap[breed][ability] + (level - 200) × breed_rate[breed][ability]`

### Critical System Interactions

1. **IP Spending Order**: Abilities should be raised before skills due to trickle-down benefits
2. **Soft vs Hard Caps**: Level caps are "hard" limits, ability caps are "soft" limits
3. **Breed Selection Impact**: Affects both ability costs and maximum potential
4. **Profession Selection Impact**: Dramatically affects skill costs and viable builds

### Performance Considerations

- IP calculations are computationally intensive
- Trickle-down recalculation needed when abilities change
- Skill cap recalculation needed when level or abilities change
- Total character validation requires checking all constraints

## Conclusion

The Anarchy Online IP system is a sophisticated character progression mechanism that creates meaningful choices between breeds, professions, and skill development paths. Understanding these mechanics is essential for:

- Character build planning
- Equipment requirement validation
- Twinking optimization
- End-game character optimization

The system's complexity comes from the interaction of multiple constraint systems (IP limits, level caps, ability caps, breed/profession factors) that must all be satisfied simultaneously for a valid character build.
