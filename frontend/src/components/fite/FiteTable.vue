<!--
FiteTable - Weapon analysis table with DPS calculations for TinkerFite

PrimeVue DataTable with columns:
- Name (clickable → /items/{id})
- QL
- Clip Size
- Damage Type (chip/badge with color)
- Special Attacks (comma-separated)
- Atk/Rch (formatted as "X.XX/Y.YY" seconds)
- Min Damage
- Avg Damage
- Max Damage
- Crit Damage
- Min DPS
- Avg DPS
- Max DPS
-->
<template>
  <div class="fite-table">
    <DataTable
      :value="tableData"
      :loading="loading"
      :paginator="true"
      :rows="25"
      :rows-per-page-options="[25, 50, 100]"
      striped-rows
      sortable
      sortField="avgDPS"
      :sortOrder="-1"
      responsive-layout="scroll"
      @row-click="onRowClick"
      :empty-message="emptyMessage"
      class="p-datatable-sm"
    >
      <!-- Name Column -->
      <Column field="name" header="Name" :sortable="true" style="min-width: 200px">
        <template #body="{ data }">
          <a
            :href="`/items/${data.aoid}`"
            class="text-primary-500 hover:text-primary-600 font-semibold"
            @click.prevent="onWeaponClick(data.aoid)"
          >
            {{ data.name }}
          </a>
        </template>
      </Column>

      <!-- QL Column -->
      <Column field="ql" header="QL" :sortable="true" style="min-width: 80px">
        <template #body="{ data }">
          <span class="font-mono">{{ data.ql }}</span>
        </template>
      </Column>

      <!-- Clip Size Column -->
      <Column field="clipSize" header="Clip" :sortable="true" style="min-width: 80px">
        <template #body="{ data }">
          <span class="font-mono">{{ data.clipSize || '-' }}</span>
        </template>
      </Column>

      <!-- Damage Type Column -->
      <Column field="damageTypeName" header="Damage Type" :sortable="true" style="min-width: 130px">
        <template #body="{ data }">
          <Badge
            v-if="data.damageTypeName"
            :value="data.damageTypeName"
            :severity="getDamageTypeSeverity(data.damageType)"
          />
          <span v-else>-</span>
        </template>
      </Column>

      <!-- Special Attacks Column -->
      <Column field="specialAttacks" header="Special Attacks" style="min-width: 200px">
        <template #body="{ data }">
          <span v-if="data.specialAttacks && data.specialAttacks.length > 0">
            {{ data.specialAttacks.join(', ') }}
          </span>
          <span v-else class="text-surface-400">None</span>
        </template>
      </Column>

      <!-- Atk/Rch Column -->
      <Column header="Atk/Rch (s)" :sortable="false" style="min-width: 120px">
        <template #body="{ data }">
          <span class="font-mono">
            {{ formatTime(data.attackTime) }}/{{ formatTime(data.rechargeTime) }}
          </span>
        </template>
      </Column>

      <!-- Min Damage Column -->
      <Column field="minDamage" header="Min Dmg" :sortable="true" style="min-width: 100px">
        <template #body="{ data }">
          <span class="font-mono">{{ data.minDamage?.toLocaleString() || '-' }}</span>
        </template>
      </Column>

      <!-- Avg Damage Column -->
      <Column field="avgDamage" header="Avg Dmg" :sortable="true" style="min-width: 100px">
        <template #body="{ data }">
          <span class="font-mono">{{ data.avgDamage?.toLocaleString() || '-' }}</span>
        </template>
      </Column>

      <!-- Max Damage Column -->
      <Column field="maxDamage" header="Max Dmg" :sortable="true" style="min-width: 100px">
        <template #body="{ data }">
          <span class="font-mono">{{ data.maxDamage?.toLocaleString() || '-' }}</span>
        </template>
      </Column>

      <!-- Crit Damage Column -->
      <Column field="critDamage" header="Crit Dmg" :sortable="true" style="min-width: 100px">
        <template #body="{ data }">
          <span class="font-mono">{{ data.critDamage?.toLocaleString() || '-' }}</span>
        </template>
      </Column>

      <!-- Min DPS Column -->
      <Column field="minDPS" header="Min DPS" :sortable="true" style="min-width: 100px">
        <template #body="{ data }">
          <span class="font-mono font-semibold text-primary-600 dark:text-primary-400">
            {{ data.minDPS?.toLocaleString() || '-' }}
          </span>
        </template>
      </Column>

      <!-- Avg DPS Column -->
      <Column field="avgDPS" header="Avg DPS" :sortable="true" style="min-width: 100px">
        <template #body="{ data }">
          <span class="font-mono font-semibold text-primary-700 dark:text-primary-300">
            {{ data.avgDPS?.toLocaleString() || '-' }}
          </span>
        </template>
      </Column>

      <!-- Max DPS Column -->
      <Column field="maxDPS" header="Max DPS" :sortable="true" style="min-width: 100px">
        <template #body="{ data }">
          <span class="font-mono font-semibold text-primary-800 dark:text-primary-200">
            {{ data.maxDPS?.toLocaleString() || '-' }}
          </span>
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Badge from 'primevue/badge';
import type { WeaponCandidate, FiteInputState } from '@/types/weapon-analysis';
import { WEAPON_STAT_IDS, DAMAGE_TYPES } from '@/types/weapon-analysis';
import { calculateBaseDamage60s, convertToDPS, calculateARBonus } from '@/utils/weapon-damage-calculations';
import { calculateAllSpecialAttacks, getWeaponSpecialAttacks } from '@/utils/weapon-special-attacks';

// Props
interface Props {
  weapons: WeaponCandidate[];
  inputState: FiteInputState;
  loading: boolean;
}

const props = defineProps<Props>();

const router = useRouter();

// Damage type names mapping
// Maps both AC stat IDs (90-97) and enum values (0-8)
const DAMAGE_TYPE_NAMES: Record<number, string> = {
  // Enum values (0-8)
  [DAMAGE_TYPES.NONE]: 'None',
  [DAMAGE_TYPES.MELEE]: 'Melee',
  [DAMAGE_TYPES.ENERGY]: 'Energy',
  [DAMAGE_TYPES.CHEMICAL]: 'Chemical',
  [DAMAGE_TYPES.RADIATION]: 'Radiation',
  [DAMAGE_TYPES.COLD]: 'Cold',
  [DAMAGE_TYPES.POISON]: 'Poison',
  [DAMAGE_TYPES.FIRE]: 'Fire',
  [DAMAGE_TYPES.PROJECTILE]: 'Projectile',
  // AC stat IDs (90-97) - database stores these
  90: 'Projectile', // ProjectileAC
  91: 'Melee', // MeleeAC
  92: 'Energy', // EnergyAC
  93: 'Chemical', // ChemicalAC
  94: 'Radiation', // RadiationAC
  95: 'Cold', // ColdAC
  96: 'Poison', // PoisonAC
  97: 'Fire', // FireAC
};

// Empty message based on loading state
const emptyMessage = computed(() => {
  if (props.loading) return 'Loading weapons...';
  if (props.weapons.length === 0) return 'No weapons found. Try adjusting your filters.';
  return 'No weapons match your criteria.';
});

/**
 * Table data with calculated DPS metrics
 * Computes all damage and DPS values in real-time
 */
const tableData = computed(() => {
  return props.weapons.map((weapon) => {
    // Calculate base damage over 60s
    const damage60sResult = calculateBaseDamage60s(weapon, props.inputState);

    // Calculate AR bonus for special attacks
    const arBonus = calculateARBonus(weapon, props.inputState);

    // Calculate damage stats for special attacks
    const baseDamage = {
      minDamage: damage60sResult.minDamage,
      avgDamage: damage60sResult.avgDamage,
      maxDamage: damage60sResult.maxDamage,
      critDamage: damage60sResult.critDamage,
    };

    // Calculate special attack damage over 60s (returns total damage, not DPS)
    const specialAttacks = calculateAllSpecialAttacks(
      weapon,
      props.inputState,
      baseDamage,
      arBonus
    );

    // Sum total damage over 60s (basic attacks + special attacks)
    const totalMinDamage60s = damage60sResult.minDamage60s + specialAttacks.total;
    const totalAvgDamage60s = damage60sResult.avgDamage60s + specialAttacks.total;
    const totalMaxDamage60s = damage60sResult.maxDamage60s + specialAttacks.total;

    // Convert to DPS once at the end
    const minDPS = convertToDPS(totalMinDamage60s);
    const avgDPS = convertToDPS(totalAvgDamage60s);
    const maxDPS = convertToDPS(totalMaxDamage60s);

    // Extract weapon stats
    const stats = weapon.stats || [];
    const clipSize = stats.find((s) => s.stat === WEAPON_STAT_IDS.CLIP_SIZE)?.value;
    const damageType = stats.find((s) => s.stat === WEAPON_STAT_IDS.DAMAGE_TYPE)?.value;

    // Get special attack names from weapon
    const specialAttackNames = getWeaponSpecialAttacks(weapon);

    return {
      ...weapon,
      // Speed stats
      attackTime: damage60sResult.attackTime,
      rechargeTime: damage60sResult.rechargeTime,
      // Damage stats (per-hit damage)
      minDamage: damage60sResult.minDamage,
      avgDamage: damage60sResult.avgDamage,
      maxDamage: damage60sResult.maxDamage,
      critDamage: damage60sResult.critDamage,
      // DPS stats (converted from total damage over 60s)
      minDPS,
      avgDPS,
      maxDPS,
      // Display fields
      clipSize,
      damageType,
      damageTypeName: damageType ? DAMAGE_TYPE_NAMES[damageType] : undefined,
      specialAttacks: specialAttackNames,
    };
  });
});

/**
 * Format time in centiseconds to seconds (X.XX)
 */
function formatTime(centiseconds: number | undefined): string {
  if (!centiseconds) return '0.00';
  return (centiseconds / 100).toFixed(2);
}

/**
 * Get PrimeVue severity for damage type badge
 * Handles both enum values (0-8) and AC stat IDs (90-97)
 */
function getDamageTypeSeverity(damageType: number | undefined): string {
  if (!damageType) return 'secondary';

  switch (damageType) {
    // Enum values
    case DAMAGE_TYPES.MELEE:
    case DAMAGE_TYPES.FIRE:
    // AC stat IDs
    case 91: // MeleeAC
    case 97: // FireAC
      return 'danger';

    case DAMAGE_TYPES.ENERGY:
    case DAMAGE_TYPES.COLD:
    case 92: // EnergyAC
    case 95: // ColdAC
      return 'info';

    case DAMAGE_TYPES.CHEMICAL:
    case 93: // ChemicalAC
      return 'warning';

    case DAMAGE_TYPES.RADIATION:
    case DAMAGE_TYPES.POISON:
    case 94: // RadiationAC
    case 96: // PoisonAC
      return 'success';

    case DAMAGE_TYPES.PROJECTILE:
    case 90: // ProjectileAC
      return 'secondary';

    default:
      return 'secondary';
  }
}

/**
 * Handle row click - navigate to item detail
 */
function onRowClick(event: any) {
  const aoid = event.data.aoid;
  if (aoid) {
    router.push(`/items/${aoid}`);
  }
}

/**
 * Handle weapon name click - navigate to item detail
 */
function onWeaponClick(aoid: number) {
  router.push(`/items/${aoid}`);
}
</script>

<style scoped>
.fite-table {
  @apply bg-surface-0 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700;
}

:deep(.p-datatable-tbody > tr) {
  cursor: pointer;
}

:deep(.p-datatable-tbody > tr:hover) {
  background-color: var(--surface-100);
}

:deep(.p-datatable-tbody > tr.dark\:bg-surface-800:hover) {
  background-color: var(--surface-700);
}
</style>
