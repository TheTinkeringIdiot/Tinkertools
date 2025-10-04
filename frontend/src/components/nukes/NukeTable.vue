<template>
  <DataTable
    :value="tableData"
    :loading="loading"
    paginator
    :rows="25"
    :rowsPerPageOptions="[25, 50, 100]"
    :sortField="defaultSortField"
    :sortOrder="defaultSortOrder"
    :globalFilter="searchQuery"
    class="nuke-table"
    @row-click="onRowClick"
    data-keyboard-nav-container
    role="table"
    :aria-label="`Table showing ${tableData.length} offensive nano programs. Use arrow keys to navigate, Enter to select.`"
  >
    <!-- Name Column - Not sortable, clickable link -->
    <Column field="name" header="Nano" class="min-w-48">
      <template #body="{ data }">
        <div class="flex items-center gap-2">
          <router-link
            :to="`/items/${data.aoid}`"
            class="font-medium text-primary-500 hover:text-primary-600 hover:underline"
            @click.stop
          >
            {{ data.name }}
          </router-link>
        </div>
      </template>
    </Column>

    <!-- QL Column - Sortable, default sort (descending) -->
    <Column field="ql" header="QL" sortable class="w-20">
      <template #body="{ data }">
        <span class="font-mono">{{ data.ql }}</span>
      </template>
    </Column>

    <!-- Cast Time Column - Sortable -->
    <Column field="castTime" header="Cast Time (s)" sortable class="w-28">
      <template #body="{ data }">
        <span class="font-mono text-sm">{{ data.castTime }}</span>
      </template>
    </Column>

    <!-- Recharge Time Column - Sortable -->
    <Column field="rechargeTime" header="Recharge Time (s)" sortable class="w-32">
      <template #body="{ data }">
        <span class="font-mono text-sm">{{ data.rechargeTime }}</span>
      </template>
    </Column>

    <!-- Min Damage Column - Sortable -->
    <Column field="minDamage" header="Min Damage" sortable class="w-28">
      <template #body="{ data }">
        <span class="font-mono">{{ data.minDamage }}</span>
      </template>
    </Column>

    <!-- Mid Damage Column - Sortable -->
    <Column field="midDamage" header="Mid Damage" sortable class="w-28">
      <template #body="{ data }">
        <span class="font-mono">{{ data.midDamage }}</span>
      </template>
    </Column>

    <!-- Max Damage Column - Sortable -->
    <Column field="maxDamage" header="Max Damage" sortable class="w-28">
      <template #body="{ data }">
        <span class="font-mono">{{ data.maxDamage }}</span>
      </template>
    </Column>

    <!-- Nano Cost Column - Sortable -->
    <Column field="nanoCost" header="Nano Cost" sortable class="w-28">
      <template #body="{ data }">
        <span class="font-mono">{{ data.nanoCost }}</span>
      </template>
    </Column>

    <!-- Damage Per Nano Column - Sortable -->
    <Column field="damagePerNano" header="Damage/Nano" sortable class="w-32">
      <template #body="{ data }">
        <span class="font-mono text-sm">{{ data.damagePerNano }}</span>
      </template>
    </Column>

    <!-- Damage Per Cast Column - Sortable -->
    <Column field="damagePerCast" header="Damage/Cast" sortable class="w-32">
      <template #body="{ data }">
        <span class="font-mono">{{ data.damagePerCast }}</span>
      </template>
    </Column>

    <!-- DPS Column - Sortable -->
    <Column field="dps" header="DPS" sortable class="w-24">
      <template #body="{ data }">
        <span class="font-mono text-sm">{{ data.dps }}</span>
      </template>
    </Column>

    <!-- Sustain Time Column - Sortable -->
    <Column field="sustainTime" header="Sustain Time" sortable class="w-32">
      <template #body="{ data }">
        <span class="font-mono text-sm">{{ data.sustainTimeFormatted }}</span>
      </template>
    </Column>

    <!-- Casts to Empty Column - Sortable -->
    <Column field="castsToEmpty" header="Casts to Empty" sortable class="w-32">
      <template #body="{ data }">
        <span class="font-mono text-sm">{{ data.castsToEmptyFormatted }}</span>
      </template>
    </Column>

    <!-- Empty State -->
    <template #empty>
      <div class="text-center py-12">
        <i class="pi pi-search text-4xl text-surface-400 mb-4"></i>
        <p class="text-lg text-surface-600 dark:text-surface-400">
          No offensive nanos found
        </p>
        <p class="text-sm text-surface-500 dark:text-surface-500">
          Adjust your search criteria or input values
        </p>
      </div>
    </template>
  </DataTable>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { type OffensiveNano } from '@/types/offensive-nano'
import type { NukeInputState } from '@/types/offensive-nano'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

// Import calculation utilities from Phase 2
import {
  calculateCastTime,
  calculateRechargeTime,
  calculateNanoCost,
  type Breed,
} from '@/utils/nuke-casting-calculations'

import {
  calculateNanoDamage,
  type DamageModifiers as DamageModifiersCalc,
  type SpellDamage,
} from '@/utils/nuke-damage-calculations'

import {
  calculateAllEfficiencyMetrics,
  formatSustainTime,
  formatCastsToEmpty,
} from '@/utils/nuke-efficiency-calculations'

import {
  calculateNanoRegen,
  CRUNCHCOM_COST_REDUCTION,
  ENHANCE_NANO_DAMAGE,
  ANCIENT_MATRIX_DAMAGE,
  type NanoRegenBuffs,
} from '@/utils/nuke-regen-calculations'

// ============================================================================
// Component Props
// ============================================================================

interface Props {
  /** Array of offensive nanoprograms from backend */
  nanos: OffensiveNano[]
  /** Current input state with all manual fields and buffs */
  inputState: NukeInputState
  /** Search query for global filtering */
  searchQuery?: string
  /** Loading state */
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  searchQuery: '',
  loading: false,
})

// ============================================================================
// Component Emits
// ============================================================================

const emit = defineEmits<{
  'nano-selected': [nanoId: number]
}>()

// ============================================================================
// Table Configuration
// ============================================================================

const defaultSortField = 'ql'
const defaultSortOrder = -1 // Descending

// ============================================================================
// Computed Table Data
// ============================================================================

/**
 * Calculate all 13 table columns for each nano using input state
 */
const tableData = computed(() => {
  return props.nanos.map((nano) => {
    // Extract input state values
    const { characterStats, damageModifiers, buffPresets } = props.inputState

    // Calculate nano cost reduction from Crunchcom buff
    const costReductionPct = CRUNCHCOM_COST_REDUCTION[buffPresets.crunchcom] || 0

    // Calculate modified cast time (in seconds)
    // nano.castTime is in centiseconds, convert to seconds for calculations
    // Pass attackDelayCap (stat 523) to enforce minimum cast time
    const castTime = calculateCastTime(
      nano.castTime,
      characterStats.nanoInit,
      nano.attackDelayCap
    )

    // Calculate modified recharge time (in seconds)
    // nano.rechargeTime is in centiseconds, convert to seconds for calculations
    // Pass rechargeDelayCap (stat 524) to enforce minimum recharge time
    const rechargeTime = calculateRechargeTime(
      nano.rechargeTime,
      characterStats.nanoInit,
      nano.rechargeDelayCap
    )

    // Calculate modified nano cost (with breed cap)
    const nanoCost = calculateNanoCost(
      nano.nanoPointCost || 0,
      costReductionPct,
      characterStats.breed as Breed
    )

    // Build damage modifiers object for calculation
    const damageModifiersForCalc: DamageModifiersCalc = {
      projectileDamage: damageModifiers.projectile,
      meleeDamage: damageModifiers.melee,
      energyDamage: damageModifiers.energy,
      chemicalDamage: damageModifiers.chemical,
      radiationDamage: damageModifiers.radiation,
      coldDamage: damageModifiers.cold,
      nanoDamage: damageModifiers.nano,
      fireDamage: damageModifiers.fire,
      poisonDamage: damageModifiers.poison,
      directNanoDamageEfficiency: damageModifiers.directNanoDamageEfficiency,
    }

    // Build spell damage objects from nano effects
    // NOTE: This is a simplified version - actual implementation should extract
    // damage spells from nano.effects or a dedicated spells array
    const spells: SpellDamage[] = [
      {
        minValue: nano.minDamage || 0,
        maxValue: nano.maxDamage || 0,
        modifierStat: getModifierStatFromDamageType(nano.damageType),
        tickCount: nano.tickCount || 1,
      },
    ]

    // Calculate damage (min, mid, max) with all modifiers
    const damage = calculateNanoDamage(
      spells,
      damageModifiersForCalc,
      damageModifiers.targetAC
    )

    // Calculate nano regeneration per second
    const regenBuffs: NanoRegenBuffs = {
      humidity: buffPresets.humidity,
      notumSiphon: buffPresets.notumSiphon,
      channeling: buffPresets.channeling,
    }

    const regenPerSecond = calculateNanoRegen(
      characterStats.psychic,
      characterStats.breed,
      characterStats.nanoDelta,
      regenBuffs
    )

    // Calculate all efficiency metrics (DPS, damage/nano, sustain, etc.)
    const efficiencyMetrics = calculateAllEfficiencyMetrics(
      damage.mid,
      nanoCost,
      castTime,
      rechargeTime,
      characterStats.maxNano,
      regenPerSecond,
      nano.tickCount || 1,
      nano.tickInterval || 0
    )

    // Return formatted row data
    return {
      id: nano.id,
      aoid: nano.aoid,
      name: nano.name,
      ql: nano.qualityLevel,
      castTime: castTime.toFixed(2),
      rechargeTime: rechargeTime.toFixed(2),
      minDamage: Math.round(damage.min),
      midDamage: Math.round(damage.mid),
      maxDamage: Math.round(damage.max),
      nanoCost: nanoCost,
      damagePerNano: efficiencyMetrics.damagePerNano.toFixed(2),
      damagePerCast: Math.round(damage.mid), // Same as mid damage
      dps: efficiencyMetrics.dps.toFixed(2),
      sustainTime: efficiencyMetrics.sustainTime,
      sustainTimeFormatted: formatSustainTime(efficiencyMetrics.sustainTime),
      castsToEmpty: efficiencyMetrics.castsToEmpty,
      castsToEmptyFormatted: formatCastsToEmpty(efficiencyMetrics.castsToEmpty),
    }
  })
})

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle row click to navigate to nano detail page
 */
function onRowClick(event: any) {
  const nanoId = event.data.id
  emit('nano-selected', nanoId)
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Map damage type to modifier_stat value for calculation
 * This mapping aligns with DAMAGE_TYPE_MAP in nuke-damage-calculations.ts
 */
function getModifierStatFromDamageType(damageType: string): number {
  const damageTypeMap: Record<string, number> = {
    projectile: 90,
    melee: 91,
    energy: 92,
    chemical: 93,
    radiation: 94,
    cold: 95,
    poison: 96,
    fire: 97,
  }

  return damageTypeMap[damageType] || 96 // Default to poison if unknown
}
</script>

<style scoped>
.nuke-table {
  width: 100%;
}

.nuke-table :deep(.p-datatable-thead > tr > th) {
  background-color: var(--surface-100);
  color: var(--text-color);
  font-weight: 600;
  padding: 0.75rem 1rem;
  border-bottom: 2px solid var(--surface-300);
}

.nuke-table :deep(.p-datatable-tbody > tr) {
  transition: background-color 0.2s;
}

.nuke-table :deep(.p-datatable-tbody > tr:hover) {
  background-color: var(--surface-50);
  cursor: pointer;
}

.nuke-table :deep(.p-datatable-tbody > tr > td) {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--surface-200);
}

.nuke-table :deep(.p-paginator) {
  padding: 1rem;
  background-color: var(--surface-0);
  border-top: 1px solid var(--surface-200);
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .nuke-table :deep(.p-datatable-thead > tr > th) {
    background-color: var(--surface-800);
    border-bottom-color: var(--surface-700);
  }

  .nuke-table :deep(.p-datatable-tbody > tr:hover) {
    background-color: var(--surface-800);
  }

  .nuke-table :deep(.p-datatable-tbody > tr > td) {
    border-bottom-color: var(--surface-700);
  }

  .nuke-table :deep(.p-paginator) {
    background-color: var(--surface-900);
    border-top-color: var(--surface-700);
  }
}
</style>
