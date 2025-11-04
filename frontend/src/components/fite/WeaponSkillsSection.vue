<!--
WeaponSkillsSection - Weapon skills input for TinkerFite

Inputs (18 fields):
- 17 weapon skills (100-116, 133-134)
- Wrangle - weapon skill bonus for requirements
-->
<template>
  <div
    class="bg-surface-0 dark:bg-surface-950 rounded-lg shadow-md dark:shadow-none border border-surface-200 dark:border-surface-700 p-6"
  >
    <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-4">
      Weapon Skills
    </h3>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- Martial Arts (100) -->
      <div class="flex flex-col">
        <label
          for="skill-100"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Martial Arts
        </label>
        <InputNumber
          id="skill-100"
          v-model="localSkills[100]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Multi Melee (101) -->
      <div class="flex flex-col">
        <label
          for="skill-101"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Multi Melee
        </label>
        <InputNumber
          id="skill-101"
          v-model="localSkills[101]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- 1h Blunt (102) -->
      <div class="flex flex-col">
        <label
          for="skill-102"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          1h Blunt
        </label>
        <InputNumber
          id="skill-102"
          v-model="localSkills[102]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- 1h Edged (103) -->
      <div class="flex flex-col">
        <label
          for="skill-103"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          1h Edged
        </label>
        <InputNumber
          id="skill-103"
          v-model="localSkills[103]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Melee Energy (104) -->
      <div class="flex flex-col">
        <label
          for="skill-104"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Melee Energy
        </label>
        <InputNumber
          id="skill-104"
          v-model="localSkills[104]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- 2h Edged (105) -->
      <div class="flex flex-col">
        <label
          for="skill-105"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          2h Edged
        </label>
        <InputNumber
          id="skill-105"
          v-model="localSkills[105]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Piercing (106) -->
      <div class="flex flex-col">
        <label
          for="skill-106"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Piercing
        </label>
        <InputNumber
          id="skill-106"
          v-model="localSkills[106]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- 2h Blunt (107) -->
      <div class="flex flex-col">
        <label
          for="skill-107"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          2h Blunt
        </label>
        <InputNumber
          id="skill-107"
          v-model="localSkills[107]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Sharp Objects (108) -->
      <div class="flex flex-col">
        <label
          for="skill-108"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Sharp Objects
        </label>
        <InputNumber
          id="skill-108"
          v-model="localSkills[108]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Grenade (109) -->
      <div class="flex flex-col">
        <label
          for="skill-109"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Grenade
        </label>
        <InputNumber
          id="skill-109"
          v-model="localSkills[109]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Heavy Weapons (110) -->
      <div class="flex flex-col">
        <label
          for="skill-110"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Heavy Weapons
        </label>
        <InputNumber
          id="skill-110"
          v-model="localSkills[110]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Bow (111) -->
      <div class="flex flex-col">
        <label
          for="skill-111"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Bow
        </label>
        <InputNumber
          id="skill-111"
          v-model="localSkills[111]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Pistol (112) -->
      <div class="flex flex-col">
        <label
          for="skill-112"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Pistol
        </label>
        <InputNumber
          id="skill-112"
          v-model="localSkills[112]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Rifle (113) -->
      <div class="flex flex-col">
        <label
          for="skill-113"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Rifle
        </label>
        <InputNumber
          id="skill-113"
          v-model="localSkills[113]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- MG/SMG (114) -->
      <div class="flex flex-col">
        <label
          for="skill-114"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          MG/SMG
        </label>
        <InputNumber
          id="skill-114"
          v-model="localSkills[114]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Shotgun (115) -->
      <div class="flex flex-col">
        <label
          for="skill-115"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Shotgun
        </label>
        <InputNumber
          id="skill-115"
          v-model="localSkills[115]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Assault Rifle (116) -->
      <div class="flex flex-col">
        <label
          for="skill-116"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Assault Rifle
        </label>
        <InputNumber
          id="skill-116"
          v-model="localSkills[116]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Ranged Energy (133) -->
      <div class="flex flex-col">
        <label
          for="skill-133"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Ranged Energy
        </label>
        <InputNumber
          id="skill-133"
          v-model="localSkills[133]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Multi Ranged (134) -->
      <div class="flex flex-col">
        <label
          for="skill-134"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Multi Ranged
        </label>
        <InputNumber
          id="skill-134"
          v-model="localSkills[134]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>
    </div>

    <!-- Wrangle Section -->
    <div class="mt-6 pt-6 border-t border-surface-200 dark:border-surface-700">
      <h4 class="text-md font-semibold text-surface-900 dark:text-surface-50 mb-4">
        Weapon Skill Bonus
      </h4>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- Wrangle -->
        <div class="flex flex-col">
          <label
            for="wrangle"
            class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
          >
            Wrangle
          </label>
          <InputNumber
            id="wrangle"
            v-model="localWrangle"
            :min="0"
            :max="3000"
            :step="1"
            class="w-full font-mono"
            @update:model-value="onWrangleChange"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import InputNumber from 'primevue/inputnumber';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';
import { WEAPON_SKILL_IDS } from '@/types/weapon-analysis';

// Props
interface Props {
  weaponSkills: Record<number, number>;
  wrangle: number;
  profile?: TinkerProfile | null;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'update:weaponSkills': [skills: Record<number, number>];
  'update:wrangle': [wrangle: number];
}>();

// Local state for two-way binding
const localSkills = ref<Record<number, number>>({ ...props.weaponSkills });
const localWrangle = ref(props.wrangle);

// Programmatic update flag to prevent watcher loops
const isProgrammaticUpdate = ref(false);

// Weapon skill IDs (17 total)
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

// Handle field changes - emit updates to parent
const onFieldChange = () => {
  if (!isProgrammaticUpdate.value) {
    emit('update:weaponSkills', { ...localSkills.value });
  }
};

const onWrangleChange = () => {
  if (!isProgrammaticUpdate.value) {
    emit('update:wrangle', localWrangle.value);
  }
};

// Watch for prop changes from parent (external updates)
watch(
  () => props.weaponSkills,
  (newSkills) => {
    isProgrammaticUpdate.value = true;
    localSkills.value = { ...newSkills };
    setTimeout(() => {
      isProgrammaticUpdate.value = false;
    }, 10);
  },
  { deep: true }
);

watch(
  () => props.wrangle,
  (newWrangle) => {
    isProgrammaticUpdate.value = true;
    localWrangle.value = newWrangle;
    setTimeout(() => {
      isProgrammaticUpdate.value = false;
    }, 10);
  }
);

// Auto-populate from profile when profile changes
watch(
  () => props.profile?.skills,
  (newSkills) => {
    if (newSkills && !isProgrammaticUpdate.value) {
      isProgrammaticUpdate.value = true;
      weaponSkillIds.forEach((id) => {
        localSkills.value[id] = newSkills[id]?.total || 0;
      });
      setTimeout(() => {
        isProgrammaticUpdate.value = false;
        emit('update:weaponSkills', { ...localSkills.value });
      }, 10);
    }
  },
  { immediate: true, deep: true }
);
</script>
