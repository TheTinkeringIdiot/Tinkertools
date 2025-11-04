<template>
  <div
    class="bg-surface-0 dark:bg-surface-950 rounded-lg shadow-md dark:shadow-none border border-surface-200 dark:border-surface-700 p-6"
  >
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50">Character Skills</h3>
      <Button
        @click="loadFromProfile"
        icon="pi pi-user"
        label="Load Profile"
        size="small"
        severity="secondary"
        v-tooltip="'Load skills from TinkerProfile'"
      />
    </div>

    <div v-if="Object.keys(skills).length === 0" class="text-center py-8">
      <div class="text-surface-400 dark:text-surface-500 mb-2">
        <i class="pi pi-info-circle text-2xl"></i>
      </div>
      <p class="text-surface-600 dark:text-surface-400 mb-4">
        Enter your character's skills to see which weapons you can use
      </p>
      <Button @click="showQuickSetup = true" label="Quick Setup" icon="pi pi-bolt" size="small" />
    </div>

    <div v-else>
      <!-- Skills Summary -->
      <div
        class="mb-4 p-3 bg-primary-50 dark:bg-primary-900/20 rounded border border-primary-200 dark:border-primary-800"
      >
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-primary-900 dark:text-primary-100">
            {{ Object.keys(skills).length }} skills configured
          </span>
          <div class="space-x-2">
            <Button
              @click="showAllSkills = !showAllSkills"
              :label="showAllSkills ? 'Show Less' : 'Show All'"
              size="small"
              severity="secondary"
              text
            />
            <Button
              @click="clearAllSkills"
              icon="pi pi-trash"
              size="small"
              severity="danger"
              text
              v-tooltip="'Clear all skills'"
            />
          </div>
        </div>
      </div>

      <!-- Skills List -->
      <div class="space-y-3">
        <div
          v-for="[skillId, skillValue] in displayedSkills"
          :key="skillId"
          class="flex items-center justify-between p-3 border border-surface-200 dark:border-surface-700 rounded hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
        >
          <div class="flex-1">
            <label class="block text-sm font-medium text-surface-700 dark:text-surface-300">
              {{ getSkillName(skillId) }}
            </label>
            <div class="text-xs text-surface-500 dark:text-surface-400">ID: {{ skillId }}</div>
          </div>
          <div class="flex items-center space-x-2">
            <InputNumber
              v-model="skills[skillId]"
              @update:model-value="updateSkill(skillId, $event)"
              :min="0"
              :max="3000"
              :step="1"
              class="w-20"
              size="small"
            />
            <Button
              @click="removeSkill(skillId)"
              icon="pi pi-times"
              size="small"
              severity="danger"
              text
            />
          </div>
        </div>
      </div>

      <!-- Add New Skill -->
      <div class="mt-4 pt-4 border-t">
        <div class="flex space-x-2">
          <Dropdown
            v-model="newSkillId"
            :options="availableSkills"
            option-label="name"
            option-value="id"
            placeholder="Select skill"
            class="flex-1"
            filter
          />
          <InputNumber
            v-model="newSkillValue"
            placeholder="Value"
            :min="0"
            :max="3000"
            class="w-24"
          />
          <Button
            @click="addSkill"
            icon="pi pi-plus"
            :disabled="!newSkillId || newSkillValue === null"
            v-tooltip="'Add skill'"
          />
        </div>
      </div>
    </div>

    <!-- Quick Setup Modal -->
    <Dialog
      v-model:visible="showQuickSetup"
      header="Quick Character Setup"
      :style="{ width: '600px' }"
      modal
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2"
            >Character Level</label
          >
          <InputNumber v-model="quickLevel" :min="1" :max="220" class="w-full" />
        </div>

        <div>
          <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2"
            >Profession</label
          >
          <Dropdown
            v-model="quickProfession"
            :options="professions"
            option-label="name"
            option-value="id"
            placeholder="Select profession"
            class="w-full"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2"
            >Focus Skills</label
          >
          <MultiSelect
            v-model="quickFocusSkills"
            :options="weaponSkills"
            option-label="name"
            option-value="id"
            placeholder="Select weapon skills to focus on"
            class="w-full"
          />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end space-x-2">
          <Button @click="showQuickSetup = false" label="Cancel" severity="secondary" />
          <Button @click="applyQuickSetup" label="Apply" />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import InputNumber from 'primevue/inputnumber';
import Dropdown from 'primevue/dropdown';
import MultiSelect from 'primevue/multiselect';
import Dialog from 'primevue/dialog';
import { SKILL_NAMES } from '@/types/weapon';
import type { CharacterSkills } from '@/types/weapon';

interface Props {
  skills: CharacterSkills;
}

interface Emits {
  (e: 'update:skills', skills: CharacterSkills): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
const toast = useToast();

// Local state
const skills = ref<CharacterSkills>({ ...props.skills });
const showAllSkills = ref(false);
const showQuickSetup = ref(false);
const newSkillId = ref<number | null>(null);
const newSkillValue = ref<number | null>(null);

// Quick setup
const quickLevel = ref(100);
const quickProfession = ref<number | null>(null);
const quickFocusSkills = ref<number[]>([]);

// Available skills for dropdown
const availableSkills = computed(() => {
  return Object.entries(SKILL_NAMES)
    .filter(([id]) => !skills.value[parseInt(id)])
    .map(([id, name]) => ({ id: parseInt(id), name }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

// Weapon skills for quick setup
const weaponSkills = computed(() => {
  const weaponSkillIds = [
    100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 152,
  ];
  return weaponSkillIds
    .map((id) => ({ id, name: SKILL_NAMES[id] }))
    .filter((skill) => skill.name)
    .sort((a, b) => a.name.localeCompare(b.name));
});

const professions = [
  { id: 1, name: 'Soldier' },
  { id: 2, name: 'Martial Artist' },
  { id: 3, name: 'Engineer' },
  { id: 4, name: 'Fixer' },
  { id: 5, name: 'Agent' },
  { id: 6, name: 'Adventurer' },
  { id: 7, name: 'Trader' },
  { id: 8, name: 'Bureaucrat' },
  { id: 9, name: 'Enforcer' },
  { id: 10, name: 'Doctor' },
  { id: 11, name: 'Nano-Technician' },
  { id: 12, name: 'Meta-Physicist' },
];

// Display skills (show top 5 by default, all if expanded)
const displayedSkills = computed(() => {
  const entries = Object.entries(skills.value).map(
    ([id, value]) => [parseInt(id), value] as [number, number]
  );
  entries.sort((a, b) => b[1] - a[1]); // Sort by value descending

  return showAllSkills.value ? entries : entries.slice(0, 5);
});

const getSkillName = (skillId: number): string => {
  return SKILL_NAMES[skillId] || `Unknown Skill ${skillId}`;
};

const updateSkill = (skillId: number, value: number | null) => {
  if (value === null || value <= 0) {
    delete skills.value[skillId];
  } else {
    skills.value[skillId] = value;
  }
  emit('update:skills', { ...skills.value });
};

const removeSkill = (skillId: number) => {
  delete skills.value[skillId];
  emit('update:skills', { ...skills.value });
};

const addSkill = () => {
  if (newSkillId.value && newSkillValue.value !== null && newSkillValue.value > 0) {
    skills.value[newSkillId.value] = newSkillValue.value;
    emit('update:skills', { ...skills.value });

    // Reset form
    newSkillId.value = null;
    newSkillValue.value = null;

    toast.add({
      severity: 'success',
      summary: 'Skill Added',
      detail: `${getSkillName(newSkillId.value)} added`,
      life: 2000,
    });
  }
};

const clearAllSkills = () => {
  skills.value = {};
  emit('update:skills', {});
};

const loadFromProfile = () => {
  // TODO: Implement TinkerProfile integration
  toast.add({
    severity: 'info',
    summary: 'Coming Soon',
    detail: 'TinkerProfile integration will be available in a future update',
    life: 3000,
  });
};

const applyQuickSetup = () => {
  const newSkills: CharacterSkills = {};

  if (quickLevel.value) {
    newSkills[54] = quickLevel.value; // Level
  }

  // Add base stats based on level (rough estimates)
  if (quickLevel.value) {
    const baseStatValue = Math.floor(quickLevel.value * 4); // Rough estimate
    newSkills[16] = baseStatValue; // Strength
    newSkills[17] = baseStatValue; // Stamina
    newSkills[18] = baseStatValue; // Agility
    newSkills[19] = baseStatValue; // Sense
    newSkills[20] = baseStatValue; // Intelligence
    newSkills[21] = baseStatValue; // Psychic
  }

  // Add focus skills with higher values
  quickFocusSkills.value.forEach((skillId) => {
    if (quickLevel.value) {
      newSkills[skillId] = Math.floor(quickLevel.value * 5); // Higher for focus skills
    }
  });

  skills.value = newSkills;
  emit('update:skills', { ...skills.value });
  showQuickSetup.value = false;

  toast.add({
    severity: 'success',
    summary: 'Quick Setup Applied',
    detail: `Character setup for level ${quickLevel.value}`,
    life: 3000,
  });
};

// Watch for prop changes
watch(
  () => props.skills,
  (newSkills) => {
    skills.value = { ...newSkills };
  },
  { deep: true }
);
</script>
