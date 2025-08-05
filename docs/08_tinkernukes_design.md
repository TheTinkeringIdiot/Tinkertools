# TinkerNukes - Nanotechnician Offensive Nano Tool

## Overview

TinkerNukes is a specialized tool focused exclusively on offensive nanoprograms used by the Nanotechnician profession in Anarchy Online. It provides comprehensive analysis, optimization, and management capabilities for all NT offensive nanos including direct damage, damage over time (DoT), area effect (AoE), and special offensive effects.

## Core Functionality

### 1. Offensive Nano Analysis
- **Direct Damage Nanos**: Analysis of instant damage nanoprograms
- **Damage Over Time (DoT)**: Complete DoT nano analysis and tracking
- **Area Effect Damage**: AoE nano damage distribution and effectiveness
- **Multi-Effect Nanos**: Nanos with combined offensive effects
- **Nano Damage Scaling**: How nano damage scales with character progression

### 2. Nanotechnician-Specific Features
- **Nano Skill Requirements**: Calculate required nano skills for casting
- **Casting Analysis**: Cast time, nano cost, and efficiency calculations  
- **Nano Pool Management**: Optimize nano point usage for sustained damage
- **Profession Synergies**: NT-specific bonuses and skill interactions
- **NCU Management**: Nano Control Unit optimization for offensive loadouts

### 3. Primary Focus - Material Creation Nanos
- **Material Creation (MC) Primary**: MC is the main nano skill for offensive nanos
- **Simple Table Display**: All nanos displayed in straightforward table format
- **Individual Requirements**: Each nano shows its specific requirements clearly
- **No Complex Categorization**: Simplified approach without unnecessary sorting/filtering

### 4. Advanced Analysis Features
- **Damage Efficiency**: Damage per nano point and per second calculations
- **Casting Rotation Optimization**: Optimal casting sequences for maximum DPS
- **Target Type Analysis**: Effectiveness against different target types
- **Situational Effectiveness**: PvP vs PvE nano effectiveness
- **Nano Progression Planning**: Plan nano upgrades as character levels

## Architecture Design

### Component Structure

```typescript
features/tinker-nukes/
├── TinkerNukes.vue                     # Main application entry point
├── components/
│   ├── offensive-nanos/
│   │   ├── OffensiveNanoAnalyzer.vue   # Main offensive nano analysis interface
│   │   ├── DirectDamageAnalysis.vue    # Direct damage nano analysis
│   │   ├── DoTAnalysis.vue             # Damage over time analysis
│   │   ├── AoEDamageAnalysis.vue       # Area effect damage analysis
│   │   ├── MultiEffectAnalysis.vue     # Multi-effect nano analysis
│   │   ├── NanoDamageScaling.vue       # Damage scaling analysis
│   │   └── OffensiveNanoBrowser.vue    # Browse offensive nanos by category
│   ├── nanotechnician/
│   │   ├── NTSkillAnalyzer.vue         # NT skill requirement analysis
│   │   ├── CastingAnalyzer.vue         # Casting time and cost analysis
│   │   ├── NanoPoolOptimizer.vue       # Nano point management
│   │   ├── ProfessionSynergies.vue     # NT-specific bonuses
│   │   ├── NCUManager.vue              # NCU optimization for offensive nanos
│   │   └── NTProgressionPlanner.vue    # NT character progression planning
│   ├── nano-display/
│   │   ├── NanoTable.vue               # Simple table display of all offensive nanos
│   │   ├── NanoRow.vue                 # Individual nano row with requirements
│   │   ├── RequirementsDisplay.vue     # Clear requirement display
│   │   └── MaterialCreationFocus.vue   # MC skill focus and analysis
│   ├── optimization/
│   │   ├── DamageEfficiency.vue        # Damage efficiency calculations
│   │   ├── CastingRotations.vue        # Optimal casting sequences
│   │   ├── RotationOptimizer.vue       # Rotation optimization algorithms
│   │   ├── TargetTypeAnalysis.vue      # Effectiveness vs target types
│   │   ├── SituationalAnalysis.vue     # PvP/PvE effectiveness
│   │   └── ProgressionOptimizer.vue    # Nano progression optimization
│   ├── analysis/
│   │   ├── NanoDamageCalculator.vue    # Precise nano damage calculations
│   │   ├── DoTTracker.vue              # DoT effect tracking and analysis
│   │   ├── AoEEffectivenessAnalysis.vue # AoE damage distribution
│   │   ├── NanoEfficiencyMetrics.vue   # Efficiency measurement tools
│   │   ├── CastingEfficiencyAnalysis.vue # Casting efficiency analysis
│   │   └── NanoComparison.vue          # Compare offensive nanos
│   ├── visualization/
│   │   ├── NanoDamageCharts.vue        # Nano damage visualization
│   │   ├── DoTTimelines.vue            # DoT effect timelines
│   │   ├── EfficiencyGraphs.vue        # Efficiency comparison graphs
│   │   ├── RotationVisualizer.vue      # Casting rotation visualization
│   │   └── ProgressionCharts.vue       # Character progression charts
│   └── tools/
│       ├── QuickDamageCalculator.vue   # Quick nano damage estimates
│       ├── DoTCalculator.vue           # Quick DoT calculations
│       ├── NanoCostCalculator.vue      # Nano point cost calculator
│       ├── CastTimeCalculator.vue      # Casting time calculator
│       └── EfficiencyCalculator.vue    # Quick efficiency calculations
├── composables/
│   ├── useOffensiveNanos.ts            # Offensive nano management
│   ├── useNanoDamageCalculations.ts    # Nano damage calculation logic
│   ├── useDoTAnalysis.ts               # DoT analysis and tracking
│   ├── useAoEAnalysis.ts               # AoE damage analysis
│   ├── useNTSkills.ts                  # NT skill analysis
│   ├── useCastingAnalysis.ts           # Casting analysis logic
│   ├── useNanoEfficiency.ts            # Efficiency calculation logic
│   ├── useRotationOptimization.ts      # Rotation optimization
│   ├── useNanoProgression.ts           # Nano progression planning
│   └── useNanoComparison.ts            # Nano comparison utilities
├── services/
│   ├── offensiveNanoEngine.ts          # Core offensive nano calculation engine
│   ├── nanoDamageCalculator.ts         # Nano damage calculation service
│   ├── dotCalculator.ts                # DoT calculation engine
│   ├── aoeCalculator.ts                # AoE damage calculation service
│   ├── ntSkillCalculator.ts            # NT skill requirement calculator
│   ├── castingAnalyzer.ts              # Casting analysis service
│   ├── nanoEfficiencyAnalyzer.ts       # Efficiency analysis engine
│   ├── rotationOptimizer.ts            # Rotation optimization service
│   ├── nanoProgressionPlanner.ts       # Nano progression planning service
│   └── nanoComparisonEngine.ts         # Nano comparison algorithms
├── stores/
│   ├── tinkerNukesStore.ts             # Main application state
│   ├── offensiveNanoStore.ts           # Offensive nano state management
│   ├── ntCharacterStore.ts             # NT character-specific state
│   ├── nanoDamageStore.ts              # Nano damage calculation state
│   ├── rotationStore.ts                # Casting rotation state
│   └── nanoProgressionStore.ts         # Nano progression state
├── types/
│   ├── offensive-nano.ts               # Offensive nano types
│   ├── nt-character.ts                 # NT character types
│   ├── nano-damage.ts                  # Nano damage calculation types
│   ├── dot-effects.ts                  # DoT effect types
│   ├── aoe-effects.ts                  # AoE effect types
│   ├── casting.ts                      # Casting-related types
│   ├── efficiency.ts                   # Efficiency analysis types
│   ├── rotation.ts                     # Casting rotation types
│   └── progression.ts                  # Nano progression types
└── utils/
    ├── nanoFormulas.ts                 # Core nano calculation formulas
    ├── nanoDamageFormulas.ts           # Nano damage-specific formulas
    ├── dotFormulas.ts                  # DoT calculation formulas
    ├── aoeFormulas.ts                  # AoE calculation formulas
    ├── ntSkillFormulas.ts              # NT skill calculation formulas
    ├── castingFormulas.ts              # Casting calculation formulas
    ├── efficiencyFormulas.ts           # Efficiency calculation formulas
    ├── rotationFormulas.ts             # Rotation optimization formulas
    └── nanoUtilities.ts                # General nano utilities
```

## Core Types and Interfaces

### 1. Offensive Nano System

```typescript
interface OffensiveNano {
  id: number
  name: string
  description: string
  category: OffensiveNanoCategory
  school: NanoSchool
  strain: NanoStrain
  qualityLevel: number
  
  // Casting requirements
  castingRequirements: CastingRequirement[]
  nanoCost: number
  castingTime: number
  recycle: number
  
  // Offensive effects
  damageEffects: DamageEffect[]
  offensiveEffects: OffensiveEffect[]
  
  // Target information
  targetType: TargetType
  range: number
  areaEffect?: AoEProperties
  
  // Profession restrictions
  professionRequirements: ProfessionRequirement[]
  levelRequirement: number
}

enum OffensiveNanoCategory {
  DIRECT_DAMAGE = 'direct_damage',
  DAMAGE_OVER_TIME = 'damage_over_time',
  AREA_EFFECT = 'area_effect',
  MULTI_EFFECT = 'multi_effect',
  DEBUFF_DAMAGE = 'debuff_damage',
  SPECIAL_OFFENSIVE = 'special_offensive'
}

enum NanoSchool {
  MATTER_METAMORPHOSIS = 'matter_metamorphosis',
  BIOLOGICAL_METAMORPHOSIS = 'biological_metamorphosis',
  PSYCHOLOGICAL_MODIFICATIONS = 'psychological_modifications',
  MATTER_CREATION = 'matter_creation',
  TIME_AND_SPACE = 'time_and_space',
  SENSORY_IMPROVEMENT = 'sensory_improvement'
}

interface DamageEffect {
  type: DamageEffectType
  school: NanoSchool
  baseDamage: DamageRange
  scaling: DamageScaling
  duration?: number // For DoT effects
  interval?: number // For DoT tick interval
  resistance: ResistanceType
}

enum DamageEffectType {
  INSTANT_DAMAGE = 'instant_damage',
  DAMAGE_OVER_TIME = 'damage_over_time',
  BURST_DAMAGE = 'burst_damage',
  CHANNELED_DAMAGE = 'channeled_damage'
}

interface DamageRange {
  minimum: number
  maximum: number
  average: number
}
```

### 2. Nanotechnician Character Analysis

```typescript
interface NTCharacterAnalysis {
  character: TinkerProfile
  
  // NT-specific skill analysis
  nanoSkills: NTNanoSkills
  castingCapabilities: CastingCapabilities
  nanoPool: NanoPoolAnalysis
  ncuCapacity: NCUAnalysis
  
  // Offensive capabilities
  offensivePotential: OffensivePotential
  schoolProficiencies: SchoolProficiency[]
  damageModifiers: NTDamageModifier[]
  
  // Equipment bonuses
  nanoEquipmentBonuses: EquipmentBonus[]
  implantBonuses: ImplantBonus[]
  
  // Profession synergies
  ntSynergies: NTProfessionSynergy[]
}

interface NTNanoSkills {
  matterMetamorphosis: number
  biologicalMetamorphosis: number
  psychologicalModifications: number
  matterCreation: number
  timeAndSpace: number
  sensoryImprovement: number
  
  // Calculated effective skills with bonuses
  effectiveMM: number
  effectiveBM: number
  effectivePM: number
  effectiveMC: number
  effectiveTS: number
  effectiveSI: number
}

interface CastingCapabilities {
  // Base casting stats
  baseCastingSpeed: number
  nanoInitiative: number
  
  // Modified casting stats
  effectiveCastingSpeed: number
  effectiveNanoInit: number
  
  // Casting efficiency
  castingEfficiency: number
  interruptResistance: number
  
  // School-specific bonuses
  schoolCastingBonuses: Record<NanoSchool, CastingBonus>
}

interface NanoPoolAnalysis {
  maxNanoPool: number
  currentNanoPool: number
  nanoRegeneration: number
  
  // Efficiency metrics
  sustainedCastingCapacity: number
  burstCastingCapacity: number
  nanoEfficiency: number
  
  // Optimization recommendations
  nanoPoolOptimizations: NanoPoolOptimization[]
}
```

### 3. Offensive Nano Analysis

```typescript
interface OffensiveNanoAnalysis {
  nano: OffensiveNano
  character: NTCharacterAnalysis
  target?: TargetProfile
  
  // Damage analysis
  damageAnalysis: NanoDamageAnalysis
  efficiency: NanoEfficiency
  casting: CastingAnalysis
  
  // Situational analysis
  pvpEffectiveness: number
  pveEffectiveness: number
  soloEffectiveness: number
  teamEffectiveness: number
  
  // Recommendations
  recommendations: NanoRecommendation[]
  alternatives: OffensiveNano[]
  
  // Progression analysis
  progressionValue: ProgressionValue
}

interface NanoDamageAnalysis {
  // Base damage
  baseDamage: DamageRange
  
  // Modified damage with character bonuses
  modifiedDamage: DamageRange
  
  // Critical hit potential
  criticalChance: number
  criticalDamage: DamageRange
  
  // DoT analysis (if applicable)
  dotAnalysis?: DoTAnalysis
  
  // AoE analysis (if applicable)
  aoeAnalysis?: AoEAnalysis
  
  // Special effects
  additionalEffects: AdditionalEffect[]
  
  // Real-world damage (accounting for resistances)
  expectedDamage: DamageRange
}

interface DoTAnalysis {
  totalDamage: number
  damagePerTick: DamageRange
  numberOfTicks: number
  totalDuration: number
  tickInterval: number
  
  // Efficiency metrics
  dotEfficiency: number
  frontLoadedDamage: number
  sustainedDamage: number
  
  // Stacking analysis
  stackable: boolean
  maxStacks?: number
  stackingEfficiency?: number
}

interface AoEAnalysis {
  maxTargets: number
  damageDistribution: AoEDamageDistribution
  areaSize: number
  falloffPattern: DamageFalloffPattern
  
  // Efficiency metrics
  singleTargetDamage: DamageRange
  multiTargetPotential: number
  aoeEfficiency: number
  
  // Tactical considerations
  positioning: PositioningConsiderations
  targetClusters: OptimalTargetCluster[]
}
```

### 4. Casting Rotation System

```typescript
interface CastingRotation {
  id: string
  name: string
  description: string
  
  // Rotation composition
  nanos: RotationNano[]
  totalDuration: number
  totalNanoCost: number
  
  // Performance metrics
  averageDPS: number
  burstDamage: number
  sustainabilityRating: number
  
  // Requirements
  requiredSkills: NTNanoSkills
  requiredNCU: number
  requiredNanoPool: number
  
  // Situational effectiveness
  pvpRating: number
  pveRating: number
  soloRating: number
  teamRating: number
  
  // Optimization data
  optimizationScore: number
  alternatives: CastingRotation[]
  improvements: RotationImprovement[]
}

interface RotationNano {
  nano: OffensiveNano
  castOrder: number
  timing: number
  priority: RotationPriority
  conditions?: CastingCondition[]
  
  // Rotation-specific modifiers
  rotationDamageBonus: number
  synergyBonuses: SynergyBonus[]
}

enum RotationPriority {
  OPENER = 'opener',
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  FILLER = 'filler',
  FINISHER = 'finisher',
  SITUATIONAL = 'situational'
}

interface RotationOptimization {
  currentRotation: CastingRotation
  optimizedRotation: CastingRotation
  improvements: RotationImprovement[]
  
  // Performance gains
  dpsImprovement: number
  efficiencyImprovement: number
  sustainabilityImprovement: number
  
  // Implementation requirements
  skillRequirements: SkillRequirement[]
  equipmentRequirements: EquipmentRequirement[]
  nanoRequirements: NanoRequirement[]
}
```

### 5. Nano Progression System

```typescript
interface NanoProgressionPlan {
  character: NTCharacterAnalysis
  targetLevel: number
  
  // Progression steps
  progressionSteps: NanoProgressionStep[]
  totalTimeline: string
  totalCost: ProgressionCost
  
  // Milestone analysis
  majorMilestones: NanoMilestone[]
  criticalUpgrades: CriticalUpgrade[]
  
  // Alternative paths
  alternativePaths: NanoProgressionPath[]
}

interface NanoProgressionStep {
  level: number
  stepNumber: number
  description: string
  
  // Available nanos at this step
  availableNanos: OffensiveNano[]
  recommendedNanos: OffensiveNano[]
  
  // Skill requirements
  requiredSkills: NTNanoSkills
  skillDeficits: SkillDeficit[]
  trainingPlan: SkillTrainingPlan
  
  // Performance projections
  projectedDPS: number
  projectedEfficiency: number
  capabilityGains: CapabilityGain[]
  
  // Progression timeline
  estimatedTime: string
  prerequisites: Prerequisite[]
}

interface NanoMilestone {
  level: number
  name: string
  description: string
  significance: MilestoneSignificance
  
  // Key nanos unlocked
  keyNanos: OffensiveNano[]
  capabilityChanges: CapabilityChange[]
  
  // Performance impact
  damageImprovement: number
  efficiencyImprovement: number
  gameplayImpact: GameplayImpact[]
}
```

## Core Services

### 1. Offensive Nano Engine

```typescript
class OffensiveNanoEngine {
  private nanoDamageCalculator: NanoDamageCalculator
  private dotCalculator: DoTCalculator
  private aoeCalculator: AoECalculator
  private ntSkillCalculator: NTSkillCalculator
  
  analyzeOffensiveNano(
    nano: OffensiveNano,
    character: NTCharacterAnalysis,
    target?: TargetProfile
  ): OffensiveNanoAnalysis {
    
    // 1. Calculate base nano damage
    const baseDamage = this.calculateBaseDamage(nano)
    
    // 2. Apply NT character modifiers
    const modifiedDamage = this.applyNTModifiers(
      baseDamage,
      character,
      nano
    )
    
    // 3. Analyze special effects (DoT, AoE, etc.)
    const specialEffects = this.analyzeSpecialEffects(nano, character)
    
    // 4. Calculate efficiency metrics
    const efficiency = this.calculateNanoEfficiency(
      modifiedDamage,
      nano,
      character,
      specialEffects
    )
    
    // 5. Analyze casting requirements and capabilities
    const casting = this.analyzeCasting(nano, character)
    
    // 6. Generate situational effectiveness ratings
    const situationalRatings = this.calculateSituationalRatings(
      nano,
      modifiedDamage,
      character,
      target
    )
    
    // 7. Generate recommendations
    const recommendations = this.generateNanoRecommendations(
      nano,
      character,
      efficiency,
      situationalRatings
    )
    
    return {
      nano,
      character,
      target,
      damageAnalysis: {
        baseDamage,
        modifiedDamage,
        criticalChance: this.calculateCriticalChance(character, nano),
        criticalDamage: this.calculateCriticalDamage(modifiedDamage, character),
        dotAnalysis: specialEffects.dotAnalysis,
        aoeAnalysis: specialEffects.aoeAnalysis,
        additionalEffects: specialEffects.additionalEffects,
        expectedDamage: this.calculateExpectedDamage(modifiedDamage, target)
      },
      efficiency,
      casting,
      pvpEffectiveness: situationalRatings.pvp,
      pveEffectiveness: situationalRatings.pve,
      soloEffectiveness: situationalRatings.solo,
      teamEffectiveness: situationalRatings.team,
      recommendations,
      alternatives: this.findAlternativeNanos(nano, character),
      progressionValue: this.calculateProgressionValue(nano, character)
    }
  }
  
  optimizeCastingRotation(
    availableNanos: OffensiveNano[],
    character: NTCharacterAnalysis,
    scenario: CombatScenario
  ): RotationOptimization {
    
    // 1. Filter nanos that character can cast
    const castableNanos = availableNanos.filter(nano =>
      this.canCastNano(nano, character)
    )
    
    // 2. Analyze individual nano effectiveness
    const nanoAnalyses = castableNanos.map(nano =>
      this.analyzeOffensiveNano(nano, character)
    )
    
    // 3. Generate optimal rotation sequences
    const rotationCandidates = this.generateRotationCandidates(
      nanoAnalyses,
      character,
      scenario
    )
    
    // 4. Evaluate and rank rotations
    const rankedRotations = this.rankRotations(rotationCandidates, scenario)
    
    // 5. Optimize top rotation
    const optimizedRotation = this.optimizeRotation(
      rankedRotations[0],
      character,
      scenario
    )
    
    return {
      currentRotation: rankedRotations[0],
      optimizedRotation,
      improvements: this.identifyImprovements(
        rankedRotations[0],
        optimizedRotation
      ),
      dpsImprovement: this.calculateDPSImprovement(
        rankedRotations[0],
        optimizedRotation
      ),
      efficiencyImprovement: this.calculateEfficiencyImprovement(
        rankedRotations[0],
        optimizedRotation
      ),
      sustainabilityImprovement: this.calculateSustainabilityImprovement(
        rankedRotations[0],
        optimizedRotation
      ),
      skillRequirements: this.getRotationSkillRequirements(optimizedRotation),
      equipmentRequirements: this.getRotationEquipmentRequirements(optimizedRotation),
      nanoRequirements: this.getRotationNanoRequirements(optimizedRotation)
    }
  }
}
```

## User Interface Design

### Main Interface Layout
- **Character Setup Panel**: NT character configuration and skill analysis
- **Offensive Nano Browser**: Browse nanos by school and category
- **Nano Analysis Dashboard**: Comprehensive offensive nano analysis
- **Rotation Planner**: Design and optimize casting rotations
- **Damage Calculator**: Quick damage calculations and comparisons
- **Progression Planner**: Plan nano upgrades and character progression

### Key Features
- **Real-time Calculations**: Instant updates as character stats change
- **School-Based Organization**: Organize nanos by NT schools (MM, BM, PM, MC, T&S, SI)
- **Rotation Visualization**: Visual casting rotation timelines
- **Efficiency Metrics**: Clear efficiency and performance indicators
- **Progression Tracking**: Track nano progression as character levels
- **Export Results**: Export analysis for sharing or documentation

## Integration Points

### Character Data Integration
- Real-time sync with NT character stats and nano skills
- Integration with TinkerPlants for stat modifications affecting nano casting
- Validation against current character nano casting capabilities

### Nano Database Integration  
- Live data from offensive nano databases with school categorization
- Search and filter capabilities specific to NT offensive capabilities
- Nano progression and upgrade path information

### Other Tool Integration
- Share optimal offensive nanos with TinkerNanos for complete nano management
- Integration with TinkerFite for combat scenario analysis
- Export nano analysis to TinkerItems for equipment planning

## Summary

This corrected design focuses exclusively on offensive nanoprograms for the Nanotechnician profession, providing comprehensive analysis of damage nanos, DoT effects, AoE capabilities, and optimal casting rotations. The tool serves as the specialist resource for NT players looking to optimize their offensive nano capabilities and damage output.