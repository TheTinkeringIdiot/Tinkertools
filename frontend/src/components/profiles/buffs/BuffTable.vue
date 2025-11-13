<!--
BuffTable - Display table of active nano buffs with NCU management
Shows active buff nanos with their icons, names, NCU costs and removal options
-->
<template>
  <div class="buff-table">
    <!-- Table for buffs when present -->
    <DataTable
      v-if="buffs.length > 0"
      :value="buffs"
      :scrollable="true"
      scrollHeight="flex"
      class="buff-data-table"
      :rowHover="true"
      :stripedRows="true"
    >
      <!-- Custom header template with NCU info and Remove All button -->
      <template #header>
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-2">
            <i class="pi pi-sparkles text-primary-500" :aria-hidden="true"></i>
            <span class="font-semibold text-surface-900 dark:text-surface-50"> Buffs ({{ currentNCU }} / {{ maxNCU }} NCU) </span>
          </div>
          <Button
            label="Remove All"
            icon="pi pi-times"
            severity="danger"
            size="small"
            text
            @click="$emit('remove-all-buffs')"
            v-tooltip.left="'Remove all active buffs'"
          />
        </div>
      </template>

      <!-- Buff Icon Column -->
      <Column field="icon" header="Icon" class="w-20">
        <template #body="{ data }">
          <div class="flex items-center justify-center">
            <img
              v-if="getBuffIconUrl(data)"
              :src="getBuffIconUrl(data)"
              :alt="`${data.name} icon`"
              class="buff-icon"
              @error="onIconError"
            />
            <i v-else class="pi pi-sparkles text-primary-500 text-xl" :aria-hidden="true"></i>
          </div>
        </template>
      </Column>

      <!-- Buff Name Column -->
      <Column field="name" header="Name" :sortable="true" class="min-w-48">
        <template #body="{ data }">
          <div
            class="buff-name-container"
            v-tooltip="getBuffTooltip(data)"
            :tooltip-options="{
              showDelay: 500,
              hideDelay: 200,
              escape: false,
              class: 'buff-tooltip',
            }"
          >
            <span class="font-medium cursor-help">{{ data.name }}</span>
            <div v-if="data.ql" class="text-xs text-surface-500 dark:text-surface-400">
              QL {{ data.ql }}
            </div>
          </div>
        </template>
      </Column>

      <!-- NCU Cost Column -->
      <Column field="ncu_cost" header="NCU Cost" :sortable="true" class="w-24">
        <template #body="{ data }">
          <div class="text-center">
            <span class="font-semibold text-primary-600 dark:text-primary-400">
              {{ getBuffNCUCost(data) }}
            </span>
          </div>
        </template>
      </Column>

      <!-- Actions Column -->
      <Column header="Actions" class="w-24">
        <template #body="{ data }">
          <div class="flex gap-2 justify-center">
            <Button
              icon="pi pi-times"
              size="small"
              severity="danger"
              rounded
              text
              @click="$emit('remove-buff', data)"
              v-tooltip.top="'Remove buff'"
              :aria-label="`Remove ${data.name}`"
            />
          </div>
        </template>
      </Column>
    </DataTable>

    <!-- Empty State -->
    <div v-else class="bg-surface-50 dark:bg-surface-900 border-2 border-dashed border-surface-300 dark:border-surface-700 rounded-lg p-8 text-center">
      <div class="mb-4">
        <i class="pi pi-sparkles text-6xl opacity-30" :aria-hidden="true"></i>
      </div>
      <p class="text-xl text-surface-600 dark:text-surface-400 mb-2">No active buffs</p>
      <p class="text-sm text-surface-500 dark:text-surface-500 mb-4">
        Cast nano programs from TinkerItems to add buff effects to your profile.
      </p>
      <p class="text-xs text-surface-400 dark:text-surface-600">
        NCU Available: {{ maxNCU - currentNCU }} / {{ maxNCU }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import type { Item, StatValue } from '@/types/api';
import { getItemIconUrl } from '@/services/game-utils';

// Props
const props = defineProps<{
  buffs: Item[];
  currentNCU: number;
  maxNCU: number;
}>();

// Emits
const emit = defineEmits<{
  'remove-buff': [buff: Item];
  'remove-all-buffs': [];
}>();

// Helper functions
function getBuffIconUrl(buff: Item): string | null {
  if (!buff.stats || buff.stats.length === 0) {
    return null;
  }
  return getItemIconUrl(buff.stats);
}

function getBuffNCUCost(buff: Item): number {
  // NCU cost is stored in stat 54 (Level stat for nano programs)
  const ncuStat = buff.stats?.find((stat: StatValue) => stat.stat === 54);
  return ncuStat?.value || 0;
}

function getBuffTooltip(buff: Item): string {
  try {
    const effects = getBuffEffects(buff);
    const ncuCost = getBuffNCUCost(buff);

    let tooltip = `<div class="buff-tooltip-content">`;

    // Buff name and QL
    tooltip += `<div class="tooltip-header">`;
    tooltip += `<strong>${buff.name}</strong>`;
    if (buff.ql) {
      tooltip += ` (QL ${buff.ql})`;
    }
    tooltip += `</div>`;

    // NCU cost
    if (ncuCost > 0) {
      tooltip += `<div class="tooltip-ncu">NCU Cost: ${ncuCost}</div>`;
    }

    // Effects
    if (effects.length > 0) {
      tooltip += `<div class="tooltip-effects">`;
      tooltip += `<div class="tooltip-section-title">Effects:</div>`;
      for (const effect of effects) {
        const effectClass = effect.startsWith('-') ? 'negative-effect' : 'positive-effect';
        tooltip += `<div class="${effectClass}">${effect}</div>`;
      }
      tooltip += `</div>`;
    }

    // Description if available
    if (buff.description) {
      tooltip += `<div class="tooltip-description">`;
      tooltip += `<div class="tooltip-section-title">Description:</div>`;
      tooltip += `<div>${buff.description}</div>`;
      tooltip += `</div>`;
    }

    tooltip += `</div>`;
    return tooltip;
  } catch (error) {
    console.warn('Error generating buff tooltip:', error);
    return buff.name || 'Unknown Buff';
  }
}

function getBuffEffects(buff: Item): string[] {
  try {
    const effects: string[] = [];

    // Parse spell data for stat modifications
    if (buff.spell_data && buff.spell_data.length > 0) {
      for (const spellData of buff.spell_data) {
        if (spellData.spells && spellData.spells.length > 0) {
          for (const spell of spellData.spells) {
            // Look for common buff spell IDs that modify stats
            const spellId = spell.spell_id;

            // Spell ID 53045: Modify Skill
            // Spell ID 53012: Modify Ability
            // Spell ID 53014: Modify AC
            // Spell ID 53175: Modify Max Health/Nano
            if (spellId && [53045, 53012, 53014, 53175].includes(spellId)) {
              const effect = parseSpellEffect(spell.spell_params, spellId);
              if (effect) {
                effects.push(effect);
              }
            }
          }
        }
      }
    }

    return effects;
  } catch (error) {
    console.warn('Error parsing buff effects:', error);
    return [];
  }
}

function parseSpellEffect(spellParams: Record<string, any>, spellId: number): string | null {
  try {
    if (!spellParams || typeof spellParams !== 'object') {
      return null;
    }

    // Common spell parameter keys for stat modifications
    const statId = spellParams.stat || spellParams.stat_id || spellParams[0];
    const amount = spellParams.amount || spellParams.value || spellParams[1];

    if (typeof statId === 'number' && typeof amount === 'number') {
      const skillName = getSkillNameFromStatId(statId);
      if (skillName) {
        const sign = amount >= 0 ? '+' : '';
        return `${skillName}: ${sign}${amount}`;
      }
    }

    return null;
  } catch (error) {
    console.warn('Error parsing spell effect:', error);
    return null;
  }
}

function getSkillNameFromStatId(statId: number): string | null {
  // Map common stat IDs to skill names
  // This is a simplified mapping - a full implementation would use game-data.ts
  const statMap: Record<number, string> = {
    // Abilities
    17: 'Strength',
    19: 'Stamina',
    18: 'Agility',
    20: 'Intelligence',
    21: 'Sense',
    22: 'Psychic',

    // Common skills
    16: 'Matter Metamorphosis',
    11: 'Time and Space',
    15: 'Biological Metamorphosis',
    12: 'Sensory Improvement',
    13: 'Matter Creation',
    14: 'Psychological Modifications',

    // Body & Defense
    53: 'Body Development',
    57: 'Duck-Exp',
    58: 'Dodge-Ranged',
    59: 'Evade-ClsC',

    // Trade & Repair
    71: 'Computer Literacy',
    72: 'Psychology',
    78: 'Chemistry',

    // Combat & Healing
    124: 'First Aid',
    125: 'Treatment',
  };

  return statMap[statId] || `Stat ${statId}`;
}

function onIconError() {
  console.warn('Failed to load buff icon');
}
</script>

<style scoped>
.buff-data-table :deep(.p-datatable) {
  background: transparent;
}

.buff-data-table :deep(.p-datatable-wrapper) {
  background: var(--p-surface-0);
  border-radius: 0.5rem;
}

.buff-data-table :deep(.p-datatable-header) {
  background: var(--p-surface-50);
  border-bottom: 1px solid var(--p-surface-200);
  padding: 0.75rem 1rem;
}

.buff-data-table :deep(.p-datatable-tbody) {
  font-size: 0.9rem;
  background: var(--p-surface-0);
}

:global(.dark) .buff-data-table :deep(.p-datatable-wrapper) {
  background: var(--p-surface-900);
}

:global(.dark) .buff-data-table :deep(.p-datatable-header) {
  background: var(--p-surface-800);
  border-bottom: 1px solid var(--p-surface-700);
}

:global(.dark) .buff-data-table :deep(.p-datatable-tbody) {
  background: var(--p-surface-900);
}

.buff-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
  border-radius: 4px;
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.3));
}

.buff-name-container {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Custom tooltip styling */
:deep(.buff-tooltip) {
  max-width: 400px;
}

:deep(.buff-tooltip-content) {
  line-height: 1.4;
}

:deep(.tooltip-header) {
  font-weight: bold;
  margin-bottom: 8px;
  color: var(--primary-500);
}

:deep(.tooltip-ncu) {
  font-size: 0.9rem;
  color: var(--surface-600);
  margin-bottom: 8px;
}

:deep(.dark .tooltip-ncu) {
  color: var(--surface-400);
}

:deep(.tooltip-effects) {
  margin-bottom: 8px;
}

:deep(.tooltip-section-title) {
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--surface-700);
  font-size: 0.9rem;
}

:deep(.dark .tooltip-section-title) {
  color: var(--surface-300);
}

:deep(.positive-effect) {
  color: var(--green-600);
  font-size: 0.9rem;
  margin-left: 8px;
}

:deep(.dark .positive-effect) {
  color: var(--green-400);
}

:deep(.negative-effect) {
  color: var(--red-600);
  font-size: 0.9rem;
  margin-left: 8px;
}

:deep(.dark .negative-effect) {
  color: var(--red-400);
}

:deep(.tooltip-description) {
  font-size: 0.85rem;
  color: var(--surface-600);
  line-height: 1.3;
}

:deep(.dark .tooltip-description) {
  color: var(--surface-400);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .buff-data-table :deep(.p-datatable-header) {
    padding: 0.5rem;
  }

  .buff-data-table :deep(.p-datatable-header) .flex {
    flex-direction: column;
    gap: 0.5rem;
    align-items: stretch;
  }

  .buff-icon {
    width: 24px;
    height: 24px;
  }
}
</style>
