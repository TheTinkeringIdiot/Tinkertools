<!--
TinkerPlants - Implant Planning Tool
Grid-based implant selection following the legacy TinkerPlants format
-->
<template>
  <div class="tinker-plants h-full flex flex-col">
    <!-- Header -->
    <div class="bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 p-4">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div class="flex items-center gap-4">
          <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-50">
            <i class="pi pi-cog mr-2" aria-hidden="true"></i>
            TinkerPlants
          </h1>
          <Badge 
            value="Implant Planner" 
            severity="info"
            aria-label="Implant planning and construction tool"
          />
        </div>
        
        <!-- Controls -->
        <div class="flex flex-col sm:flex-row gap-3">
          <!-- Quality Level Control -->
          <div class="flex items-center gap-2">
            <label for="ql-input" class="text-sm font-medium text-surface-700 dark:text-surface-300 whitespace-nowrap">
              Set QL To:
            </label>
            <InputNumber 
              id="ql-input"
              v-model="qualityLevel"
              :min="1"
              :max="300"
              :step="1"
              :use-grouping="false"
              class="header-ql-input"
              aria-describedby="ql-help"
              @input="onGlobalQLChange"
            />
            <span id="ql-help" class="sr-only">
              Quality Level for implants, from 1 to 300
            </span>
          </div>
          
          <!-- Clear All Button -->
          <Button
            @click="clearAllImplants"
            label="Clear All"
            icon="pi pi-trash"
            size="small"
            severity="secondary"
            outlined
            aria-label="Clear all selected implants"
          />
          
          <!-- Calculate Button -->
          <Button
            @click="calculateBuild"
            label="Calculate"
            icon="pi pi-calculator"
            size="small"
            :disabled="!hasAnyImplants"
            aria-label="Calculate implant construction requirements"
          />
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 overflow-auto p-4">
      <div class="max-w-6xl mx-auto">
        <!-- Implant Grid -->
        <div class="bg-surface-0 dark:bg-surface-950 border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden">
          <!-- Grid Header -->
          <div class="tinker-plants-grid gap-0 bg-surface-100 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
            <div class="p-3 font-semibold text-surface-900 dark:text-surface-50 border-r border-surface-200 dark:border-surface-700">
              Slot
            </div>
            <div class="p-3 font-semibold text-surface-900 dark:text-surface-50 text-center border-r border-surface-200 dark:border-surface-700">
              Shiny
            </div>
            <div class="p-3 font-semibold text-surface-900 dark:text-surface-50 text-center border-r border-surface-200 dark:border-surface-700">
              Bright  
            </div>
            <div class="p-3 font-semibold text-surface-900 dark:text-surface-50 text-center border-r border-surface-200 dark:border-surface-700">
              Faded
            </div>
            <div class="p-3 font-semibold text-surface-900 dark:text-surface-50 text-center">
              QL
            </div>
          </div>
          
          <!-- Grid Rows -->
          <div 
            v-for="(slot, index) in implantSlots" 
            :key="slot.id"
            class="tinker-plants-grid gap-0 border-b border-surface-200 dark:border-surface-700 last:border-b-0"
          >
            <!-- Slot Name -->
            <div class="p-3 border-r border-surface-200 dark:border-surface-700 flex items-center">
              <span class="font-medium text-surface-900 dark:text-surface-50">
                {{ slot.name }}
              </span>
            </div>
            
            <!-- Shiny Dropdown -->
            <div class="p-2 border-r border-surface-200 dark:border-surface-700">
              <Dropdown
                :id="`${slot.id}-shiny`"
                v-model="implantSelections[slot.id].shiny"
                :options="getSkillOptions(slot.name, 'shiny')"
                option-label="label"
                option-value="value"
                placeholder="None"
                show-clear
                class="w-full"
                :aria-label="`Select shiny skill cluster for ${slot.name} slot`"
                @change="onImplantChange(slot.id, 'shiny', $event.value)"
              />
            </div>
            
            <!-- Bright Dropdown -->
            <div class="p-2 border-r border-surface-200 dark:border-surface-700">
              <Dropdown
                :id="`${slot.id}-bright`"
                v-model="implantSelections[slot.id].bright"
                :options="getSkillOptions(slot.name, 'bright')"
                option-label="label"
                option-value="value"
                placeholder="None"
                show-clear
                class="w-full"
                :aria-label="`Select bright skill cluster for ${slot.name} slot`"
                @change="onImplantChange(slot.id, 'bright', $event.value)"
              />
            </div>
            
            <!-- Faded Dropdown -->
            <div class="p-2 border-r border-surface-200 dark:border-surface-700">
              <Dropdown
                :id="`${slot.id}-faded`"
                v-model="implantSelections[slot.id].faded"
                :options="getSkillOptions(slot.name, 'faded')"
                option-label="label"
                option-value="value"
                placeholder="None"
                show-clear
                class="w-full"
                :aria-label="`Select faded skill cluster for ${slot.name} slot`"
                @change="onImplantChange(slot.id, 'faded', $event.value)"
              />
            </div>
            
            <!-- QL Input -->
            <div class="p-2 flex items-center">
              <InputNumber
                :id="`${slot.id}-ql`"
                v-model="implantSelections[slot.id].ql"
                :min="1"
                :max="300"
                :step="1"
                class="w-full ql-input"
                :aria-label="`Quality Level for ${slot.name} implant`"
                @input="onQLChange(slot.id, $event.value)"
              />
            </div>
          </div>
        </div>

        <!-- Results Section -->
        <div v-if="showResults" class="mt-6 space-y-4">
          <!-- Stat Summary -->
          <div class="bg-surface-0 dark:bg-surface-950 border border-surface-200 dark:border-surface-700 rounded-lg p-4">
            <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-3 flex items-center gap-2">
              <i class="pi pi-chart-bar text-primary-500"></i>
              Stat Bonuses
            </h3>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              <div 
                v-for="(bonus, statName) in calculatedBonuses" 
                :key="statName"
                class="text-center p-2 bg-surface-50 dark:bg-surface-900 rounded"
              >
                <div class="text-xs text-surface-600 dark:text-surface-400 uppercase tracking-wide">
                  {{ statName }}
                </div>
                <div class="text-lg font-bold text-primary-600 dark:text-primary-400">
                  +{{ bonus }}
                </div>
              </div>
            </div>
          </div>

          <!-- Construction Requirements -->
          <div class="bg-surface-0 dark:bg-surface-950 border border-surface-200 dark:border-surface-700 rounded-lg p-4">
            <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-3 flex items-center gap-2">
              <i class="pi pi-wrench text-primary-500"></i>
              Construction Requirements
            </h3>
            <div class="space-y-2">
              <div 
                v-for="requirement in constructionRequirements" 
                :key="`${requirement.slot}-${requirement.type}`"
                class="flex justify-between items-center py-1 border-b border-surface-100 dark:border-surface-800 last:border-b-0"
              >
                <span class="text-surface-700 dark:text-surface-300">
                  {{ requirement.slot }} - {{ requirement.type }}
                </span>
                <span class="font-mono text-surface-900 dark:text-surface-50">
                  {{ requirement.clusters.join(', ') }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading Overlay -->
    <div
      v-if="loading"
      class="absolute inset-0 bg-black/20 flex items-center justify-center z-50"
      role="status"
      aria-label="Loading implant data"
    >
      <div class="bg-surface-0 dark:bg-surface-950 p-4 rounded-lg shadow-lg">
        <LoadingSpinner size="medium" loadingText="Loading implant data..." showText />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue';
import { useAccessibility } from '@/composables/useAccessibility';
import Badge from 'primevue/badge';
import Button from 'primevue/button';
import Dropdown from 'primevue/dropdown';
import InputNumber from 'primevue/inputnumber';
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue';

// Accessibility
const { announce, setLoading } = useAccessibility();

// State
const loading = ref(false);
const qualityLevel = ref(200);
const showResults = ref(false);

// Implant slots in the order from legacy TinkerPlants
const implantSlots = ref([
  { id: 'Eye', name: 'Eye' },
  { id: 'Head', name: 'Head' },
  { id: 'Ear', name: 'Ear' },
  { id: 'Right Arm', name: 'Right Arm' },
  { id: 'Chest', name: 'Chest' },
  { id: 'Left Arm', name: 'Left Arm' },
  { id: 'Right Wrist', name: 'Right Wrist' },
  { id: 'Waist', name: 'Waist' },
  { id: 'Left Wrist', name: 'Left Wrist' },
  { id: 'Right Hand', name: 'Right Hand' },
  { id: 'Leg', name: 'Leg' },
  { id: 'Left Hand', name: 'Left Hand' },
  { id: 'Feet', name: 'Feet' }
]);

// Implant values data from docs/implant_values.json
const implantValues = ref({
  "Eye": {
    "shiny": [
      "Empty",
      "Aimed Shot",
      "Elec. Engi",
      "Map Navig",
      "RangeInc. Weapon",
      "Rifle",
      "Tutoring",
      "Vehicle Air"
    ],
    "bright": [
      "Empty",
      "Chemistry",
      "Comp. Liter",
      "Grenade",
      "Heavy Weapons",
      "Intelligence",
      "Mech. Engi",
      "Mult. Melee",
      "Nano Progra",
      "NanoC. Init",
      "Perception",
      "Pharma Tech",
      "Psycho Modi",
      "Quantum FT",
      "Ranged Ener",
      "Sensory Impr",
      "Treatment",
      "Vehicle Grnd",
      "Vehicle Hydr"
    ],
    "faded": [
      "Empty",
      "Assault Rif",
      "Bow",
      "Concealment",
      "Matter Crea",
      "Multi Ranged",
      "Pistol",
      "Psychology",
      "Sharp Obj",
      "Sneak Atck",
      "Time & Space",
      "Weapon Smt"
    ]
  },
  "Head": {
    "shiny": [
      "Empty",
      "Bio.Metamor",
      "Bow Spc Att",
      "Chemistry",
      "Comp. Liter",
      "Disease AC",
      "First Aid",
      "Intelligence",
      "Matt.Metam",
      "Matter Crea",
      "Max Nano",
      "Mech. Engi",
      "Melee Ener",
      "Nano Progra",
      "Nano Resist",
      "NanoC. Init",
      "Pharma Tech",
      "Psychic",
      "Psycho Modi",
      "Psychology",
      "Quantum FT",
      "Ranged Ener",
      "Sensory Impr",
      "Time & Space",
      "Treatment",
      "Vehicle Grnd",
      "Vehicle Hydr"
    ],
    "bright": [
      "Empty",
      "Dimach",
      "Elec. Engi",
      "Map Navig",
      "Nano Pool",
      "Ranged. Init",
      "Weapon Smt"
    ],
    "faded": [
      "Empty",
      "Perception",
      "Sense",
      "Trap Disarm",
      "Tutoring",
      "Vehicle Air"
    ]
  },
  "Ear": {
    "shiny": [
      "Empty",
      "Add. Xp",
      "Max NCU",
      "Perception"
    ],
    "bright": [
      "Empty",
      "Concealment",
      "Nano Point Cost Modifier",
      "Psychology",
      "Tutoring",
      "Vehicle Air"
    ],
    "faded": [
      "Empty",
      "Intelligence",
      "Map Navig",
      "Psychic",
      "Psycho Modi",
      "Vehicle Grnd",
      "Vehicle Hydr"
    ]
  },
  "Right Arm": {
    "shiny": [
      "Empty",
      "1h Blunt",
      "1h Edged Weapon",
      "2h Blunt",
      "2h Edged",
      "Assault Rif",
      "Bow",
      "Break & Entry",
      "Burst",
      "Fling Shot",
      "Full Auto",
      "Grenade",
      "Heavy Weapons",
      "MG / SMG",
      "Piercing",
      "Shotgun",
      "Strength"
    ],
    "bright": [
      "Empty",
      "Add All Def.",
      "Add All Off",
      "Brawling",
      "Chemical AC",
      "Nano Delta",
      "Physic. Init",
      "Swimming"
    ],
    "faded": [
      "Empty",
      "Fast Attack",
      "Mech. Engi",
      "Parry",
      "Radiation AC",
      "RangeInc. NF",
      "RangeInc. Weapon",
      "Riposte"
    ]
  },
  "Chest": {
    "shiny": [
      "Empty",
      "Body Dev",
      "Dimach",
      "Energy AC",
      "Max Health",
      "Melee/Ma AC",
      "Nano Pool",
      "Sense",
      "Stamina"
    ],
    "bright": [
      "Empty",
      "Bio.Metamor",
      "Imp/Proj AC",
      "Matt.Metam",
      "Psychic"
    ],
    "faded": [
      "Empty",
      "2h Blunt",
      "Adventuring",
      "Break & Entry",
      "Disease AC",
      "MG / SMG",
      "Max Nano",
      "Nano Formula Interrupt Modifier",
      "NanoC. Init",
      "Sensory Impr",
      "Skill Time Lock Modifier",
      "Strength"
    ]
  },
  "Left Arm": {
    "shiny": [
      "Empty",
      "Add All Def.",
      "Add All Off",
      "Brawling",
      "Heal Delta",
      "RangeInc. NF"
    ],
    "bright": [
      "Empty",
      "2h Blunt",
      "2h Edged",
      "Bow",
      "Break & Entry",
      "Piercing",
      "Radiation AC",
      "Strength"
    ],
    "faded": [
      "Empty",
      "Chemical AC",
      "Matt.Metam",
      "Nano Point Cost Modifier",
      "Physic. Init",
      "Swimming"
    ]
  },
  "Right Wrist": {
    "shiny": [
      "Empty",
      "Nano Delta",
      "Parry",
      "Pistol",
      "Ranged. Init",
      "Riposte",
      "Run Speed",
      "Sharp Obj"
    ],
    "bright": [
      "Empty",
      "1h Blunt",
      "1h Edged Weapon",
      "Aimed Shot",
      "Burst",
      "Full Auto",
      "Max NCU",
      "Multi Ranged",
      "Nano Resist",
      "Rifle",
      "Sneak Atck"
    ],
    "faded": [
      "Empty",
      "Add. Chem. Dam.",
      "Add. Energy Dam.",
      "Add. Fire Dam.",
      "Add. Melee Dam.",
      "Add. Poison Dam.",
      "Add. Proj. Dam.",
      "Add.Rad. Dam.",
      "Bow Spc Att",
      "Fling Shot",
      "Melee Ener",
      "Mult. Melee"
    ]
  },
  "Waist": {
    "shiny": [
      "Empty",
      "Chemical AC",
      "Cold AC",
      "Fire AC",
      "Nano Point Cost Modifier",
      "Radiation AC"
    ],
    "bright": [
      "Empty",
      "Adventuring",
      "Body Dev",
      "Duck-Exp",
      "Max Health",
      "Max Nano",
      "Melee/Ma AC",
      "Sense"
    ],
    "faded": [
      "Empty",
      "2h Edged",
      "Agility",
      "Bio.Metamor",
      "Brawling",
      "Dimach",
      "Dodge-Rng",
      "Energy AC",
      "Evade-ClsC",
      "Full Auto",
      "Imp/Proj AC",
      "Melee. Init",
      "Nano Pool",
      "Piercing",
      "Shotgun",
      "Stamina"
    ]
  },
  "Left Wrist": {
    "shiny": [
      "Empty",
      "Mult. Melee",
      "Multi Ranged",
      "Shield Energy AC",
      "Shield Fire AC",
      "Shield Projectile AC",
      "Shield Radiation AC"
    ],
    "bright": [
      "Empty",
      "Add. Chem. Dam.",
      "Add. Energy Dam.",
      "Add. Fire Dam.",
      "Add. Melee Dam.",
      "Add. Poison Dam.",
      "Add. Proj. Dam.",
      "Add.Rad. Dam.",
      "Melee Ener",
      "Parry",
      "Riposte",
      "Run Speed"
    ],
    "faded": [
      "Empty",
      "Nano Resist",
      "Rifle",
      "Shield Chemical AC",
      "Shield Cold AC",
      "Shield Melee AC",
      "Shield Poison AC"
    ]
  },
  "Right Hand": {
    "shiny": [
      "Empty",
      "Add. Chem. Dam.",
      "Add. Energy Dam.",
      "Add. Fire Dam.",
      "Add. Melee Dam.",
      "Add. Poison Dam.",
      "Add. Proj. Dam.",
      "Add.Rad. Dam.",
      "Martial Arts",
      "Trap Disarm",
      "Weapon Smt"
    ],
    "bright": [
      "Empty",
      "Assault Rif",
      "Bow Spc Att",
      "Cold AC",
      "Fast Attack",
      "First Aid",
      "Fling Shot",
      "MG / SMG",
      "Matter Crea",
      "Pistol",
      "Sharp Obj",
      "Shotgun",
      "Time & Space"
    ],
    "faded": [
      "Empty",
      "1h Blunt",
      "1h Edged Weapon",
      "Aimed Shot",
      "Burst",
      "Chemistry",
      "Comp. Liter",
      "Elec. Engi",
      "Fire AC",
      "Grenade",
      "Heavy Weapons",
      "Nano Progra",
      "Pharma Tech",
      "Quantum FT",
      "Ranged. Init",
      "Treatment"
    ]
  },
  "Leg": {
    "shiny": [
      "Empty",
      "Adventuring",
      "Agility",
      "Dodge-Rng",
      "Duck-Exp",
      "Imp/Proj AC",
      "Nano Formula Interrupt Modifier",
      "Skill Time Lock Modifier",
      "Swimming"
    ],
    "bright": [
      "Empty",
      "Disease AC",
      "Energy AC",
      "Evade-ClsC",
      "Melee. Init",
      "Stamina"
    ],
    "faded": [
      "Empty",
      "Add. Xp",
      "Body Dev",
      "Heal Delta",
      "Max Health",
      "Max NCU",
      "Melee/Ma AC",
      "Run Speed",
      "Shield Energy AC",
      "Shield Fire AC",
      "Shield Projectile AC",
      "Shield Radiation AC"
    ]
  },
  "Left Hand": {
    "shiny": [
      "Empty",
      "Fast Attack",
      "Shield Chemical AC",
      "Shield Cold AC",
      "Shield Melee AC",
      "Shield Poison AC"
    ],
    "bright": [
      "Empty",
      "Fire AC",
      "Nano Formula Interrupt Modifier",
      "RangeInc. NF",
      "Shield Energy AC",
      "Shield Fire AC",
      "Shield Projectile AC",
      "Shield Radiation AC",
      "Skill Time Lock Modifier",
      "Trap Disarm"
    ],
    "faded": [
      "Empty",
      "Cold AC",
      "First Aid",
      "Martial Arts",
      "Ranged Ener"
    ]
  },
  "Feet": {
    "shiny": [
      "Empty",
      "Concealment",
      "Evade-ClsC",
      "Melee. Init",
      "Physic. Init",
      "Sneak Atck"
    ],
    "bright": [
      "Empty",
      "Add. Xp",
      "Agility",
      "Dodge-Rng",
      "Heal Delta",
      "Martial Arts",
      "RangeInc. Weapon",
      "Shield Chemical AC",
      "Shield Cold AC",
      "Shield Melee AC",
      "Shield Poison AC"
    ],
    "faded": [
      "Empty",
      "Add All Def.",
      "Add All Off",
      "Duck-Exp",
      "Nano Delta"
    ]
  }
});

// Initialize implant selections
const implantSelections = reactive<Record<string, { shiny: string | null; bright: string | null; faded: string | null; ql: number }>>({});

// Initialize all slots
implantSlots.value.forEach(slot => {
  implantSelections[slot.id] = {
    shiny: null,
    bright: null,
    faded: null,
    ql: qualityLevel.value
  };
});

// Helper function to get slot-specific skill options
const getSkillOptions = (slotName: string, clusterType: 'shiny' | 'bright' | 'faded') => {
  const slotData = implantValues.value[slotName as keyof typeof implantValues.value];
  if (!slotData) return [];
  
  const skills = slotData[clusterType] || [];
  return skills.map(skill => ({ value: skill, label: skill }));
};

// Computed properties
const hasAnyImplants = computed(() => {
  return Object.values(implantSelections).some(selection => 
    selection.shiny || selection.bright || selection.faded
  );
});

const calculatedBonuses = computed(() => {
  // Mock calculation - in real implementation this would calculate stat bonuses
  const bonuses: Record<string, number> = {};
  
  Object.values(implantSelections).forEach(selection => {
    [selection.shiny, selection.bright, selection.faded].forEach(skillName => {
      if (skillName && skillName !== 'Empty') {
        // Mock bonus calculation based on individual QL and cluster type
        const bonus = Math.floor(selection.ql / 10);
        bonuses[skillName] = (bonuses[skillName] || 0) + bonus;
      }
    });
  });
  
  return bonuses;
});

const constructionRequirements = computed(() => {
  const requirements: Array<{ slot: string; type: string; clusters: string[] }> = [];
  
  Object.entries(implantSelections).forEach(([slotId, selection]) => {
    const slot = implantSlots.value.find(s => s.id === slotId);
    if (!slot) return;
    
    ['shiny', 'bright', 'faded'].forEach(type => {
      const skillName = selection[type as keyof typeof selection];
      if (skillName && skillName !== 'Empty') {
        requirements.push({
          slot: slot.name,
          type: type.charAt(0).toUpperCase() + type.slice(1),
          clusters: [skillName]
        });
      }
    });
  });
  
  return requirements;
});

// Event handlers
const onImplantChange = (slotId: string, type: string, value: string | null) => {
  announce(`${type} cluster ${value ? 'selected' : 'cleared'} for ${implantSlots.value.find(s => s.id === slotId)?.name} slot`);
};

const onQLChange = (slotId: string, value: number | null) => {
  if (value !== null) {
    announce(`Quality Level set to ${value} for ${implantSlots.value.find(s => s.id === slotId)?.name} slot`);
  }
};

const onGlobalQLChange = (event: any) => {
  const newQL = event.value;
  if (newQL !== null && newQL !== undefined) {
    // Ensure the value is within valid bounds before applying to all fields
    const clampedQL = Math.max(1, Math.min(300, newQL));
    
    // Update all slot QL values with the clamped value
    Object.keys(implantSelections).forEach(slotId => {
      implantSelections[slotId].ql = clampedQL;
    });
    announce(`All Quality Levels set to ${clampedQL}`);
  }
};

const clearAllImplants = () => {
  Object.keys(implantSelections).forEach(slotId => {
    implantSelections[slotId] = {
      shiny: null,
      bright: null,
      faded: null,
      ql: qualityLevel.value
    };
  });
  showResults.value = false;
  announce('All implants cleared');
};

const calculateBuild = () => {
  if (!hasAnyImplants.value) return;
  
  setLoading(true, 'Calculating implant build...');
  
  // Simulate calculation delay
  setTimeout(() => {
    showResults.value = true;
    setLoading(false);
    announce(`Build calculated. Total stat bonuses: ${Object.keys(calculatedBonuses.value).length} different stats affected`);
  }, 1000);
};

// Lifecycle
onMounted(async () => {
  setLoading(true, 'Loading implant planner...');
  
  try {
    // In a real implementation, this would load actual skill clusters and implant data
    await new Promise(resolve => setTimeout(resolve, 500));
    announce('Implant planner loaded successfully');
  } catch (error) {
    console.error('Failed to load implant data:', error);
    announce('Failed to load implant data', 'assertive');
  } finally {
    setLoading(false);
  }
});
</script>

<style scoped>
/* Custom grid layout with reduced QL column and expanded dropdown columns */
.tinker-plants-grid {
  display: grid;
  grid-template-columns: 1fr 2fr 2fr 2fr 100px;
}

/* QL input styling for centered text and proper padding */
.ql-input :deep(.p-inputnumber) {
  width: 100%;
}

.ql-input :deep(.p-inputnumber-input) {
  text-align: center !important;
  padding-left: 0.5rem !important;
  padding-right: 0.5rem !important;
  background-color: var(--p-inputtext-background) !important;
  color: var(--p-inputtext-color) !important;
  border: 1px solid var(--p-inputtext-border-color) !important;
  width: 100% !important;
}

/* Header QL input styling - compact width and consistent appearance */
.header-ql-input {
  width: 80px;
}

.header-ql-input :deep(.p-inputnumber) {
  width: 80px;
}

.header-ql-input :deep(.p-inputnumber-input) {
  text-align: center !important;
  width: 80px !important;
  padding-left: 0.5rem !important;
  padding-right: 0.5rem !important;
  background-color: var(--p-inputtext-background) !important;
  color: var(--p-inputtext-color) !important;
  border: 1px solid var(--p-inputtext-border-color) !important;
}

/* Screen reader only utility */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>