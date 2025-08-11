<!--
Profile Import Modal
Modal for importing profiles from various formats
-->
<template>
  <Dialog
    :visible="visible"
    modal
    header="Import Profile"
    :style="{ width: '700px' }"
    @update:visible="$emit('update:visible', $event)"
  >
    <div class="space-y-6">
      <!-- Import Method Selection -->
      <div class="field">
        <label class="font-semibold text-surface-900 dark:text-surface-50 mb-3 block">
          Import Method
        </label>
        <div class="flex gap-4">
          <div class="flex items-center">
            <RadioButton
              id="file-upload"
              v-model="importMethod"
              name="importMethod"
              value="file"
            />
            <label for="file-upload" class="ml-2 text-surface-900 dark:text-surface-50">
              Upload File
            </label>
          </div>
          <div class="flex items-center">
            <RadioButton
              id="paste-text"
              v-model="importMethod"
              name="importMethod"
              value="text"
            />
            <label for="paste-text" class="ml-2 text-surface-900 dark:text-surface-50">
              Paste Text
            </label>
          </div>
        </div>
      </div>
      
      <!-- File Upload -->
      <div v-if="importMethod === 'file'" class="field">
        <label class="font-medium text-surface-900 dark:text-surface-50 mb-2 block">
          Select Profile File
        </label>
        <FileUpload
          mode="basic"
          name="profileFile"
          accept=".json,.txt"
          :maxFileSize="1000000"
          :auto="false"
          choose-label="Choose File"
          class="w-full"
          @select="onFileSelect"
          @clear="onFileClear"
        />
        <small class="text-surface-600 dark:text-surface-400">
          Supported formats: JSON (.json), Text (.txt). Max size: 1MB
        </small>
      </div>
      
      <!-- Text Paste -->
      <div v-if="importMethod === 'text'" class="field">
        <label for="import-text" class="font-medium text-surface-900 dark:text-surface-50 mb-2 block">
          Paste Profile Data
        </label>
        <Textarea
          id="import-text"
          v-model="importText"
          rows="10"
          class="w-full font-mono text-sm"
          placeholder="Paste your profile JSON data here..."
        />
        <small class="text-surface-600 dark:text-surface-400">
          Paste profile data in JSON format
        </small>
      </div>
      
      <!-- Format Detection -->
      <div v-if="detectedFormat" class="field">
        <div class="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <i class="pi pi-info-circle text-blue-600 dark:text-blue-400"></i>
          <span class="text-blue-700 dark:text-blue-300">
            Detected format: <strong>{{ detectedFormat }}</strong>
          </span>
        </div>
      </div>
      
      <!-- Import Options -->
      <div v-if="hasData" class="field">
        <label class="font-semibold text-surface-900 dark:text-surface-50 mb-3 block">
          Import Options
        </label>
        <div class="space-y-2">
          <div class="flex items-center">
            <Checkbox
              id="set-active-import"
              v-model="importOptions.setAsActive"
              binary
            />
            <label for="set-active-import" class="ml-2 text-surface-900 dark:text-surface-50">
              Set as active profile after import
            </label>
          </div>
          <div class="flex items-center">
            <Checkbox
              id="validate-import"
              v-model="importOptions.validate"
              binary
            />
            <label for="validate-import" class="ml-2 text-surface-900 dark:text-surface-50">
              Validate profile data before import
            </label>
          </div>
        </div>
      </div>
      
      <!-- Import Results -->
      <div v-if="importResult" class="field">
        <div v-if="importResult.success" class="space-y-3">
          <div class="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <i class="pi pi-check-circle text-green-600 dark:text-green-400"></i>
            <span class="text-green-700 dark:text-green-300 font-medium">
              Profile imported successfully!
            </span>
          </div>
          
          <div v-if="importResult.warnings.length > 0" class="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
            <h4 class="font-semibold text-orange-700 dark:text-orange-400 mb-2">
              <i class="pi pi-exclamation-triangle mr-2"></i>Warnings:
            </h4>
            <ul class="list-disc list-inside space-y-1">
              <li v-for="warning in importResult.warnings" :key="warning" class="text-orange-600 dark:text-orange-400 text-sm">
                {{ warning }}
              </li>
            </ul>
          </div>
          
          <div class="text-sm text-surface-600 dark:text-surface-400">
            <p><strong>Source:</strong> {{ importResult.metadata.source }}</p>
            <p v-if="importResult.metadata.migrated"><strong>Migrated:</strong> Yes</p>
          </div>
        </div>
        
        <div v-else class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <h4 class="font-semibold text-red-700 dark:text-red-400 mb-2">
            <i class="pi pi-times-circle mr-2"></i>Import Failed:
          </h4>
          <ul class="list-disc list-inside space-y-1">
            <li v-for="error in importResult.errors" :key="error" class="text-red-600 dark:text-red-400 text-sm">
              {{ error }}
            </li>
          </ul>
        </div>
      </div>
      
      <!-- Actions -->
      <div class="flex justify-end gap-2 pt-4">
        <Button
          label="Cancel"
          severity="secondary"
          outlined
          @click="cancel"
        />
        <Button
          label="Import Profile"
          icon="pi pi-upload"
          :disabled="!hasData || importing"
          :loading="importing"
          @click="importProfile"
        />
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import Dialog from 'primevue/dialog';
import FileUpload from 'primevue/fileupload';
import RadioButton from 'primevue/radiobutton';
import Textarea from 'primevue/textarea';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import type { ProfileImportResult } from '@/lib/tinkerprofiles';

// Props & Emits
const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  'imported': [result: ProfileImportResult];
}>();

// Services
const profilesStore = useTinkerProfilesStore();

// State
const importMethod = ref<'file' | 'text'>('file');
const selectedFile = ref<File | null>(null);
const importText = ref('');
const detectedFormat = ref<string | null>(null);
const importing = ref(false);
const importResult = ref<ProfileImportResult | null>(null);

const importOptions = reactive({
  setAsActive: true,
  validate: true
});

// Computed
const hasData = computed(() => {
  return (importMethod.value === 'file' && selectedFile.value) ||
         (importMethod.value === 'text' && importText.value.trim().length > 0);
});

const currentData = computed(() => {
  if (importMethod.value === 'file' && selectedFile.value) {
    return selectedFile.value;
  }
  return importText.value.trim();
});

// Methods
function onFileSelect(event: any) {
  const file = event.files[0];
  if (file) {
    selectedFile.value = file;
    
    // Read file content to detect format
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        const content = e.target.result as string;
        detectedFormat.value = detectFormat(content);
      }
    };
    reader.readAsText(file);
  }
}

function onFileClear() {
  selectedFile.value = null;
  detectedFormat.value = null;
}

function detectFormat(data: string): string {
  try {
    const parsed = JSON.parse(data);
    
    // Check for TinkerProfile format
    if (parsed.Character && parsed.Skills && parsed.version) {
      return 'TinkerProfile JSON';
    }
    
    // Check for legacy format
    if (parsed.character && parsed.skills) {
      return 'Legacy JSON';
    }
    
    // Check for AO format
    if (parsed.CharacterName && parsed.Profession && parsed.Skills) {
      return 'Anarchy Online Export';
    }
    
    // Check for nano-compatible profile
    if (parsed.name && parsed.profession && parsed.skills && parsed.stats) {
      return 'Nano-Compatible Profile';
    }
    
    return 'Generic JSON';
    
  } catch {
    return 'Unknown Format';
  }
}

async function importProfile() {
  if (!hasData.value) return;
  
  importing.value = true;
  importResult.value = null;
  
  try {
    let data: string;
    
    if (importMethod.value === 'file' && selectedFile.value) {
      // Read file content
      const reader = new FileReader();
      data = await new Promise((resolve, reject) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(selectedFile.value!);
      });
    } else {
      data = importText.value.trim();
    }
    
    // Import the profile
    const result = await profilesStore.importProfile(data);
    importResult.value = result;
    
    if (result.success) {
      // Set as active if requested
      if (importOptions.setAsActive && result.profile) {
        await profilesStore.setActiveProfile(result.profile.id);
      }
      
      emit('imported', result);
      
      // Close dialog after a delay to show success message
      setTimeout(() => {
        emit('update:visible', false);
      }, 2000);
    }
    
  } catch (error) {
    importResult.value = {
      success: false,
      errors: [error instanceof Error ? error.message : 'Import failed'],
      warnings: [],
      metadata: {
        source: 'unknown',
        migrated: false
      }
    };
  } finally {
    importing.value = false;
  }
}

function cancel() {
  emit('update:visible', false);
  resetForm();
}

function resetForm() {
  importMethod.value = 'file';
  selectedFile.value = null;
  importText.value = '';
  detectedFormat.value = null;
  importResult.value = null;
  importOptions.setAsActive = true;
  importOptions.validate = true;
}

// Watchers
watch(() => importText.value, (newText) => {
  if (newText.trim()) {
    detectedFormat.value = detectFormat(newText);
  } else {
    detectedFormat.value = null;
  }
});

watch(() => importMethod.value, () => {
  // Clear data when switching methods
  selectedFile.value = null;
  importText.value = '';
  detectedFormat.value = null;
  importResult.value = null;
});

watch(() => props.visible, (visible) => {
  if (!visible) {
    resetForm();
  }
});
</script>

<style scoped>
.field {
  margin-bottom: 1rem;
}

.field label {
  display: block;
  margin-bottom: 0.5rem;
}
</style>