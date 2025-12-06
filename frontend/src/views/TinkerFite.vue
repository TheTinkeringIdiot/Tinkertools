<!--
TinkerFite - Weapon Analysis Tool

Phase 6: UI Components Integration
Main view component with profile integration, filtering, and DPS calculations
-->

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import { analyzeWeaponsWithCache } from '@/services/weapon-service';
import { clearWeaponCache, logCacheStats, clearLegacyLocalStorageCache } from '@/services/indexed-db-weapon-cache';
import type { FiteInputState, WeaponCandidate } from '@/types/weapon-analysis';
import { WEAPON_SKILL_IDS, SPECIAL_ATTACK_IDS, INITIATIVE_IDS, DAMAGE_MODIFIER_IDS } from '@/types/weapon-analysis';
import { getEquipableWeapons } from '@/utils/weapon-filtering';
import { accountTypeToExpansionBitflag } from '@/utils/expansion-utils';
import FiteInputForm from '@/components/fite/FiteInputForm.vue';
import FiltersSection from '@/components/fite/FiltersSection.vue';
import FiteTable from '@/components/fite/FiteTable.vue';
import Badge from 'primevue/badge';
import Button from 'primevue/button';

// ============================================================================
// Store
// ============================================================================

const profileStore = useTinkerProfilesStore();

// ============================================================================
// State
// ============================================================================

const loading = ref(false);
const weapons = ref<WeaponCandidate[]>([]);

// Input state with defaults
const inputState = ref<FiteInputState>({
  characterStats: {
    breed: 1,
    level: 220,
    profession: 0,
    side: 0,
    crit: 0,
    targetAC: 0,
    aggdef: 75,
  },
  weaponSkills: {},
  specialAttacks: {},
  initiative: {
    meleeInit: 0,
    physicalInit: 0,
    rangedInit: 0,
  },
  combatBonuses: {
    aao: 0,
    addDamage: 0,
    wrangle: 0,
  },
});

// Filter state
const searchQuery = ref('');
const selectedWeaponType = ref<number | null>(null);
const minQL = ref<number | undefined>(undefined);
const maxQL = ref<number | undefined>(undefined);

// ============================================================================
// Computed
// ============================================================================

const activeProfile = computed(() => profileStore.activeProfile);

/**
 * Cache key data - only the profile fields that affect weapon backend query
 * Used to detect when cache should be invalidated
 */
const cacheKeyData = computed(() => {
  if (!activeProfile.value) return null;

  const profile = activeProfile.value;
  const weaponSkillIds = [
    WEAPON_SKILL_IDS.MARTIAL_ARTS,
    WEAPON_SKILL_IDS.MULTI_MELEE,
    WEAPON_SKILL_IDS.ONE_H_BLUNT,
    WEAPON_SKILL_IDS.ONE_H_EDGED,
    WEAPON_SKILL_IDS.MELEE_ENERGY,
    WEAPON_SKILL_IDS.TWO_H_EDGED,
    WEAPON_SKILL_IDS.PIERCING,
    WEAPON_SKILL_IDS.TWO_H_BLUNT,
    WEAPON_SKILL_IDS.SHARP_OBJECTS,
    WEAPON_SKILL_IDS.GRENADE,
    WEAPON_SKILL_IDS.HEAVY_WEAPONS,
    WEAPON_SKILL_IDS.BOW,
    WEAPON_SKILL_IDS.PISTOL,
    WEAPON_SKILL_IDS.RIFLE,
    WEAPON_SKILL_IDS.MG_SMG,
    WEAPON_SKILL_IDS.SHOTGUN,
    WEAPON_SKILL_IDS.ASSAULT_RIFLE,
    WEAPON_SKILL_IDS.RANGED_ENERGY,
    WEAPON_SKILL_IDS.MULTI_RANGED,
  ];

  // Get top 3 weapon skills
  const weaponSkills = weaponSkillIds.map(id => ({
    id,
    value: profile.skills[id]?.total || 0
  }));

  const top3 = weaponSkills
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map(s => `${s.id}:${s.value}`)
    .join(',');

  const faction = profile.Character.Faction?.toLowerCase() || 'neutral';
  const side = faction === 'clan' ? 1 : faction === 'omni' ? 2 : 0;

  return {
    level: profile.Character.Level,
    breed: profile.Character.Breed,
    profession: profile.Character.Profession,
    side,
    top3Skills: top3,
  };
});

/**
 * Equipable weapons (filtered by requirements and QL interpolation)
 */
const equipableWeapons = computed(() => {
  return getEquipableWeapons(weapons.value, inputState.value);
});

/**
 * Filtered weapons based on search, weapon type, and QL range
 */
const filteredWeapons = computed(() => {
  let result = equipableWeapons.value;

  // Apply search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter((w) => w.name.toLowerCase().includes(query));
  }

  // Apply weapon type filter
  if (selectedWeaponType.value !== null) {
    result = result.filter((w) => {
      const attackStats = w.attack_stats || [];
      return attackStats.some((stat) => stat.stat === selectedWeaponType.value);
    });
  }

  // Apply QL range
  if (minQL.value !== undefined) {
    result = result.filter((w) => (w.ql ?? 0) >= minQL.value!);
  }
  if (maxQL.value !== undefined) {
    result = result.filter((w) => (w.ql ?? 0) <= maxQL.value!);
  }

  return result;
});

// ============================================================================
// Methods
// ============================================================================

/**
 * Fetch weapons from backend based on current input state
 * Sends top 3 weapon skills to backend for filtering
 */
async function fetchWeapons() {
  if (!activeProfile.value) return;

  loading.value = true;
  try {
    // Get top 3 weapon skills
    const weaponSkills = inputState.value.weaponSkills;
    const top3 = Object.entries(weaponSkills)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([skill_id, value]) => ({ skill_id: Number(skill_id), value }));

    if (top3.length === 0) {
      console.warn('[TinkerFite] No weapon skills found, cannot fetch weapons');
      weapons.value = [];
      return;
    }

    const request = {
      level: inputState.value.characterStats.level,
      breed_id: inputState.value.characterStats.breed,
      profession_id: inputState.value.characterStats.profession,
      side: inputState.value.characterStats.side,
      top_weapon_skills: top3,
      expansion_bitflag: accountTypeToExpansionBitflag(
        activeProfile.value.Character.AccountType || 'Paid'
      ),
    };

    console.log('[TinkerFite] Fetching weapons with request:', request);
    const result = await analyzeWeaponsWithCache(request);
    weapons.value = result.map((w) => ({ ...w, equipable: false }) as WeaponCandidate);
    console.log(`[TinkerFite] Fetched ${weapons.value.length} weapons`);
  } catch (error) {
    console.error('[TinkerFite] Failed to fetch weapons:', error);
    weapons.value = [];
  } finally {
    loading.value = false;
  }
}

/**
 * Populate input state from active profile
 * Extracts all weapon skills, special attacks, and combat stats
 */
function populateFromProfile() {
  if (!activeProfile.value) return;

  const profile = activeProfile.value;

  // Character stats
  inputState.value.characterStats.breed = profile.Character.Breed;
  inputState.value.characterStats.level = profile.Character.Level;
  inputState.value.characterStats.profession = profile.Character.Profession;
  // Map faction to side (0=Neutral, 1=Clan, 2=Omni)
  const faction = profile.Character.Faction?.toLowerCase() || 'neutral';
  inputState.value.characterStats.side = faction === 'clan' ? 1 : faction === 'omni' ? 2 : 0;

  // Weapon skills (17 skills)
  const weaponSkillIds = [
    WEAPON_SKILL_IDS.MARTIAL_ARTS,
    WEAPON_SKILL_IDS.MULTI_MELEE,
    WEAPON_SKILL_IDS.ONE_H_BLUNT,
    WEAPON_SKILL_IDS.ONE_H_EDGED,
    WEAPON_SKILL_IDS.MELEE_ENERGY,
    WEAPON_SKILL_IDS.TWO_H_EDGED,
    WEAPON_SKILL_IDS.PIERCING,
    WEAPON_SKILL_IDS.TWO_H_BLUNT,
    WEAPON_SKILL_IDS.SHARP_OBJECTS,
    WEAPON_SKILL_IDS.GRENADE,
    WEAPON_SKILL_IDS.HEAVY_WEAPONS,
    WEAPON_SKILL_IDS.BOW,
    WEAPON_SKILL_IDS.PISTOL,
    WEAPON_SKILL_IDS.RIFLE,
    WEAPON_SKILL_IDS.MG_SMG,
    WEAPON_SKILL_IDS.SHOTGUN,
    WEAPON_SKILL_IDS.ASSAULT_RIFLE,
    WEAPON_SKILL_IDS.RANGED_ENERGY,
    WEAPON_SKILL_IDS.MULTI_RANGED,
  ];

  weaponSkillIds.forEach((id) => {
    inputState.value.weaponSkills[id] = profile.skills[id]?.total || 0;
  });

  // Special attacks (8 skills)
  const specialAttackIds = [
    SPECIAL_ATTACK_IDS.AIMED_SHOT,
    SPECIAL_ATTACK_IDS.BRAWL,
    SPECIAL_ATTACK_IDS.BURST,
    SPECIAL_ATTACK_IDS.DIMACH,
    SPECIAL_ATTACK_IDS.FAST_ATTACK,
    SPECIAL_ATTACK_IDS.FLING_SHOT,
    SPECIAL_ATTACK_IDS.FULL_AUTO,
    SPECIAL_ATTACK_IDS.SNEAK_ATTACK,
  ];

  specialAttackIds.forEach((id) => {
    inputState.value.specialAttacks[id] = profile.skills[id]?.total || 0;
  });

  // Initiative
  inputState.value.initiative.meleeInit = profile.skills[INITIATIVE_IDS.MELEE_INIT]?.total || 0;
  inputState.value.initiative.physicalInit =
    profile.skills[INITIATIVE_IDS.PHYSICAL_INIT]?.total || 0;
  inputState.value.initiative.rangedInit = profile.skills[INITIATIVE_IDS.RANGED_INIT]?.total || 0;

  // Combat bonuses
  inputState.value.combatBonuses.aao = profile.skills[276]?.total || 0; // Add All Offense

  // Calculate Add Damage from highest damage modifier
  const damageModifiers = [
    profile.skills[DAMAGE_MODIFIER_IDS.PROJECTILE]?.total || 0,
    profile.skills[DAMAGE_MODIFIER_IDS.MELEE]?.total || 0,
    profile.skills[DAMAGE_MODIFIER_IDS.ENERGY]?.total || 0,
    profile.skills[DAMAGE_MODIFIER_IDS.CHEMICAL]?.total || 0,
    profile.skills[DAMAGE_MODIFIER_IDS.RADIATION]?.total || 0,
    profile.skills[DAMAGE_MODIFIER_IDS.COLD]?.total || 0,
    profile.skills[DAMAGE_MODIFIER_IDS.NANO]?.total || 0,
    profile.skills[DAMAGE_MODIFIER_IDS.FIRE]?.total || 0,
    profile.skills[DAMAGE_MODIFIER_IDS.POISON]?.total || 0,
  ];
  inputState.value.combatBonuses.addDamage = Math.max(...damageModifiers, 0);
  inputState.value.combatBonuses.wrangle = 0; // User can set this manually

  // Crit
  inputState.value.characterStats.crit = profile.skills[379]?.total || 0;

  console.log('[TinkerFite] Populated from profile:', profile.Character.Name);
}

/**
 * Handle input state updates from form
 */
function onInputStateUpdate(newState: FiteInputState) {
  inputState.value = { ...newState };
}

/**
 * Clear weapon cache and refetch
 */
function handleClearCache() {
  clearWeaponCache();
  console.log('[TinkerFite] Cache cleared, refetching weapons');
  fetchWeapons();
}

/**
 * Log cache statistics to console
 */
function handleLogStats() {
  logCacheStats();
}

// ============================================================================
// Watchers
// ============================================================================

/**
 * Watch for profile switches (different profile selected)
 * Re-populate input state and fetch weapons when profile switches
 */
watch(
  () => profileStore.activeProfile,
  (newProfile, oldProfile) => {
    if (newProfile?.Character.Name === oldProfile?.Character.Name) return;

    console.log('[TinkerFite] Profile switched, re-populating');
    populateFromProfile();
    fetchWeapons();
  }
);

/**
 * Watch for cache-relevant profile changes within same profile
 * Refetches weapons when level, breed, profession, faction, or top 3 weapon skills change
 */
watch(
  cacheKeyData,
  (newKey, oldKey) => {
    // Skip if no profile or first run (handled by onMounted)
    if (!newKey || !oldKey) return;

    // Check if cache key actually changed
    const changed =
      newKey.level !== oldKey.level ||
      newKey.breed !== oldKey.breed ||
      newKey.profession !== oldKey.profession ||
      newKey.side !== oldKey.side ||
      newKey.top3Skills !== oldKey.top3Skills;

    if (changed) {
      console.log('[TinkerFite] Cache key changed, refetching weapons', {
        old: oldKey,
        new: newKey,
      });
      populateFromProfile();
      fetchWeapons();
    }
  },
  { deep: true }
);

// ============================================================================
// Lifecycle
// ============================================================================

/**
 * On mount: Populate from profile and fetch weapons
 */
onMounted(() => {
  console.log('[TinkerFite] Component mounted');

  // One-time cleanup of legacy LocalStorage weapon cache
  clearLegacyLocalStorageCache();

  populateFromProfile();
  if (activeProfile.value) {
    fetchWeapons();
  }
});
</script>

<template>
  <div class="tinkerfite-container h-full flex flex-col">
    <!-- Header -->
    <div
      class="bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 p-4"
    >
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div class="flex items-center gap-4">
          <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-50">
            <i class="pi pi-shield mr-2" aria-hidden="true"></i>
            TinkerFite
          </h1>
          <Badge
            :value="filteredWeapons.length"
            severity="success"
            v-if="filteredWeapons.length > 0"
            :aria-label="`${filteredWeapons.length} weapons found`"
          />
        </div>
        <div class="flex items-center gap-2">
          <Button
            label="Clear Cache"
            icon="pi pi-refresh"
            size="small"
            severity="secondary"
            outlined
            @click="handleClearCache"
            :disabled="loading"
            v-tooltip.bottom="'Clear weapon cache and refetch from server'"
          />
          <Button
            label="Cache Stats"
            icon="pi pi-chart-bar"
            size="small"
            severity="secondary"
            outlined
            @click="handleLogStats"
            v-tooltip.bottom="'Log cache statistics to console'"
          />
        </div>
      </div>

      <!-- Profile Info -->
      <div
        v-if="activeProfile"
        class="mt-3 flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300"
      >
        <i class="pi pi-user"></i>
        <span>
          Active Profile: <strong>{{ activeProfile.Character.Name }}</strong> (Level
          {{ activeProfile.Character.Level }})
        </span>
      </div>
    </div>

    <!-- No Profile State -->
    <div
      v-if="!activeProfile"
      class="no-profile flex-1 flex flex-col items-center justify-center gap-4 p-8"
    >
      <i class="pi pi-user-plus" style="font-size: 3rem; color: var(--surface-400)"></i>
      <h2 class="text-xl font-semibold text-surface-900 dark:text-surface-50">No Active Profile</h2>
      <p class="text-surface-600 dark:text-surface-400 text-center max-w-md">
        Please select or create a profile in TinkerProfiles to analyze weapons. Your character stats
        will be automatically populated from your profile.
      </p>
      <a
        href="/profiles"
        class="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
      >
        Go to TinkerProfiles
      </a>
    </div>

    <!-- Content (Profile Loaded) -->
    <div v-else class="flex-1 overflow-auto">
      <!-- Input Form Section -->
      <div class="p-4 border-b border-surface-200 dark:border-surface-700">
        <FiteInputForm
          :input-state="inputState"
          :active-profile="(activeProfile as any) ?? null"
          @update:input-state="onInputStateUpdate"
        />
      </div>

      <!-- Filters Section -->
      <div class="p-4 border-b border-surface-200 dark:border-surface-700">
        <FiltersSection
          :search-query="searchQuery"
          :weapon-type="selectedWeaponType"
          :min-q-l="minQL"
          :max-q-l="maxQL"
          :result-count="filteredWeapons.length"
          @update:search-query="searchQuery = $event"
          @update:weapon-type="selectedWeaponType = $event"
          @update:min-q-l="minQL = $event"
          @update:max-q-l="maxQL = $event"
        />
      </div>

      <!-- Weapon Table -->
      <div class="p-4">
        <FiteTable
          :weapons="filteredWeapons"
          :input-state="inputState"
          :loading="loading"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.tinkerfite-container {
  background-color: var(--surface-0);
}

.loading,
.no-profile {
  text-align: center;
}
</style>
