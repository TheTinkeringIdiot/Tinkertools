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
        <div class="flex gap-4 flex-wrap">
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
          <div class="flex items-center">
            <RadioButton
              id="aosetups-url"
              v-model="importMethod"
              name="importMethod"
              value="aosetups"
            />
            <label for="aosetups-url" class="ml-2 text-surface-900 dark:text-surface-50">
              Import from AOSetups
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
      
      <!-- AOSetups URL -->
      <div v-if="importMethod === 'aosetups'" class="field">
        <label for="aosetups-url" class="font-medium text-surface-900 dark:text-surface-50 mb-2 block">
          AOSetups Profile URL
        </label>
        <InputText
          id="aosetups-url"
          v-model="aosetupsUrl"
          class="w-full"
          placeholder="https://www.aosetups.com/equip/63d44b91a247b52f79ea5ff6"
        />
        <small class="text-surface-600 dark:text-surface-400">
          Enter the full AOSetups profile URL
        </small>
        <div v-if="aosetupsError" class="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
          {{ aosetupsError }}
        </div>
      </div>
      
      <!-- Format Detection -->
      <div v-if="detectedFormat" class="field">
        <div v-if="detectedFormat && detectedFormat.includes('Unsupported')" class="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <i class="pi pi-times-circle text-red-600 dark:text-red-400"></i>
          <div class="text-red-700 dark:text-red-300">
            <strong>{{ detectedFormat }}</strong>
            <p class="text-sm mt-1">This profile format is not supported. Please create a new profile or import from AOSetups.</p>
          </div>
        </div>
        <div v-else class="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
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
          <!-- Single Profile Options -->
          <div v-if="!isBulkImport" class="flex items-center">
            <Checkbox
              id="set-active-import"
              v-model="importOptions.setAsActive"
              binary
            />
            <label for="set-active-import" class="ml-2 text-surface-900 dark:text-surface-50">
              Set as active profile after import
            </label>
          </div>
          
          <!-- Bulk Import Options -->
          <div v-if="isBulkImport" class="space-y-2">
            <div class="flex items-center">
              <Checkbox
                id="skip-duplicates"
                v-model="importOptions.skipDuplicates"
                binary
              />
              <label for="skip-duplicates" class="ml-2 text-surface-900 dark:text-surface-50">
                Skip profiles with duplicate names
              </label>
            </div>
            <div class="flex items-center">
              <Checkbox
                id="overwrite-existing"
                v-model="importOptions.overwriteExisting"
                binary
                :disabled="importOptions.skipDuplicates"
              />
              <label for="overwrite-existing" class="ml-2 text-surface-900 dark:text-surface-50">
                Overwrite existing profiles with same name
              </label>
            </div>
          </div>
          
          <!-- Common Options -->
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
      
      <!-- Bulk Import Results -->
      <div v-if="bulkImportResult" class="field">
        <div class="space-y-3">
          <!-- Summary -->
          <div class="flex items-center gap-2 p-3 border rounded-lg" 
               :class="bulkImportResult.successCount > 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'">
            <i :class="bulkImportResult.successCount > 0 ? 'pi pi-check-circle text-green-600 dark:text-green-400' : 'pi pi-times-circle text-red-600 dark:text-red-400'"></i>
            <span :class="bulkImportResult.successCount > 0 ? 'text-green-700 dark:text-green-300 font-medium' : 'text-red-700 dark:text-red-300 font-medium'">
              Bulk Import Complete: {{ bulkImportResult.successCount }}/{{ bulkImportResult.totalProfiles }} profiles imported successfully
            </span>
          </div>
          
          <!-- Stats -->
          <div class="grid grid-cols-3 gap-2 text-sm">
            <div class="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
              <div class="font-semibold text-green-700 dark:text-green-300">{{ bulkImportResult.successCount }}</div>
              <div class="text-green-600 dark:text-green-400">Successful</div>
            </div>
            <div class="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
              <div class="font-semibold text-red-700 dark:text-red-300">{{ bulkImportResult.failureCount }}</div>
              <div class="text-red-600 dark:text-red-400">Failed</div>
            </div>
            <div class="text-center p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
              <div class="font-semibold text-orange-700 dark:text-orange-300">{{ bulkImportResult.skippedCount }}</div>
              <div class="text-orange-600 dark:text-orange-400">Skipped</div>
            </div>
          </div>
          
          <!-- Detailed Results -->
          <div v-if="bulkImportResult.results.length > 0" class="max-h-40 overflow-y-auto border border-surface-200 dark:border-surface-700 rounded">
            <div v-for="result in bulkImportResult.results" :key="result.profileName" 
                 class="flex items-center gap-2 p-2 border-b border-surface-100 dark:border-surface-800 last:border-b-0">
              <i v-if="result.success" class="pi pi-check text-green-600 dark:text-green-400"></i>
              <i v-else-if="result.skipped" class="pi pi-minus text-orange-600 dark:text-orange-400"></i>
              <i v-else class="pi pi-times text-red-600 dark:text-red-400"></i>
              
              <div class="flex-1 min-w-0">
                <div class="font-medium text-sm text-surface-900 dark:text-surface-50 truncate">
                  {{ result.profileName }}
                </div>
                <div v-if="result.error" class="text-xs text-red-600 dark:text-red-400 truncate">
                  {{ result.error }}
                </div>
                <div v-else-if="result.skipped" class="text-xs text-orange-600 dark:text-orange-400">
                  Skipped (duplicate name)
                </div>
                <div v-else-if="result.warnings && result.warnings.length > 0" class="text-xs text-orange-600 dark:text-orange-400">
                  {{ result.warnings[0] }}
                </div>
                <div v-else-if="result.success" class="text-xs text-green-600 dark:text-green-400">
                  Imported successfully
                </div>
              </div>
            </div>
          </div>
          
          <!-- Metadata -->
          <div class="text-sm text-surface-600 dark:text-surface-400">
            <p><strong>Source:</strong> {{ bulkImportResult.metadata.source }}</p>
            <p v-if="bulkImportResult.metadata.exportVersion"><strong>Export Version:</strong> {{ bulkImportResult.metadata.exportVersion }}</p>
            <p v-if="bulkImportResult.metadata.exportDate"><strong>Export Date:</strong> {{ new Date(bulkImportResult.metadata.exportDate).toLocaleDateString() }}</p>
          </div>
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
          :label="isBulkImport ? 'Import Profiles' : 'Import Profile'"
          icon="pi pi-upload"
          :disabled="!hasData || importing || (detectedFormat && detectedFormat.includes('Unsupported'))"
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
import InputText from 'primevue/inputtext';
import RadioButton from 'primevue/radiobutton';
import Textarea from 'primevue/textarea';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import type { ProfileImportResult, BulkImportResult } from '@/lib/tinkerprofiles';

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
const importMethod = ref<'file' | 'text' | 'aosetups'>('file');
const selectedFile = ref<File | null>(null);
const importText = ref('');
const aosetupsUrl = ref('');
const aosetupsError = ref('');
const detectedFormat = ref<string | null>(null);
const importing = ref(false);
const importResult = ref<ProfileImportResult | null>(null);
const bulkImportResult = ref<BulkImportResult | null>(null);
const isBulkImport = ref(false);

const importOptions = reactive({
  setAsActive: true,
  validate: true,
  // Bulk import options
  skipDuplicates: false,
  overwriteExisting: false
});

// Computed
const hasData = computed(() => {
  return (importMethod.value === 'file' && selectedFile.value) ||
         (importMethod.value === 'text' && importText.value.trim().length > 0) ||
         (importMethod.value === 'aosetups' && aosetupsUrl.value.trim().length > 0 && !aosetupsError.value);
});

const currentData = computed(() => {
  if (importMethod.value === 'file' && selectedFile.value) {
    return selectedFile.value;
  }
  return importText.value.trim();
});

// Methods
function extractAOSetupsId(url: string): string | null {
  // Extract profile ID from AOSetups URL
  const match = url.match(/aosetups\.com\/equip\/([a-f0-9]{24})/i);
  return match ? match[1] : null;
}

function validateAOSetupsUrl(url: string): void {
  aosetupsError.value = '';
  
  if (!url.trim()) {
    return;
  }
  
  if (!url.includes('aosetups.com')) {
    aosetupsError.value = 'URL must be from aosetups.com';
    return;
  }
  
  const profileId = extractAOSetupsId(url);
  if (!profileId) {
    aosetupsError.value = 'Invalid AOSetups profile URL format';
    return;
  }
}

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
        updateBulkImportFlag(content);
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

    // Check for multi-profile bulk export format
    if (parsed.version === "1.0" && parsed.profileCount && parsed.profiles && Array.isArray(parsed.profiles)) {
      const profileCount = parsed.profileCount;
      const actualCount = parsed.profiles.length;
      return `TinkerProfiles Bulk Export (${actualCount} profile${actualCount !== 1 ? 's' : ''})`;
    }

    // Check for v4.0.0 TinkerProfile format (SUPPORTED)
    if (parsed.Character && parsed.skills && parsed.version === '4.0.0') {
      return 'TinkerProfile v4.0.0';
    }

    // Check for v3.0.0 or other legacy TinkerProfile formats (UNSUPPORTED)
    if (parsed.Character && (parsed.Skills || parsed.version !== '4.0.0')) {
      return 'Unsupported Legacy Format';
    }

    // Check for AOSetups format
    if (parsed.character && parsed.implants && parsed.weapons && parsed.clothes) {
      return 'AOSetups';
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

    return 'Unknown Format';

  } catch {
    return 'Unknown Format';
  }
}

function updateBulkImportFlag(data: string) {
  try {
    const parsed = JSON.parse(data);
    isBulkImport.value = !!(parsed.version === "1.0" && parsed.profileCount && parsed.profiles && Array.isArray(parsed.profiles));
  } catch {
    isBulkImport.value = false;
  }
}

async function importProfile() {
  if (!hasData.value) return;
  
  importing.value = true;
  importResult.value = null;
  bulkImportResult.value = null;
  
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
    } else if (importMethod.value === 'aosetups') {
      // Extract profile ID and fetch from AOSetups API
      console.log('[AOSetups Import] Starting import from URL:', aosetupsUrl.value);
      
      const profileId = extractAOSetupsId(aosetupsUrl.value);
      if (!profileId) {
        const error = 'Invalid AOSetups URL';
        console.error('[AOSetups Import] Error:', error);
        throw new Error(error);
      }
      
      console.log('[AOSetups Import] Extracted profile ID:', profileId);
      console.log('[AOSetups Import] Fetching from backend proxy...');
      
      const response = await fetch(`http://localhost:8000/api/v1/aosetups/profile/${profileId}`);
      if (!response.ok) {
        const error = `Failed to fetch profile: ${response.status} ${response.statusText}`;
        console.error('[AOSetups Import] Fetch error:', error);
        console.error('[AOSetups Import] Response details:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url
        });
        throw new Error(error);
      }
      
      console.log('[AOSetups Import] Successfully fetched profile data');
      const aosetupsData = await response.json();
      console.log('[AOSetups Import] Profile data:', aosetupsData);
      data = JSON.stringify(aosetupsData);
    } else {
      data = importText.value.trim();
    }
    
    if (isBulkImport.value) {
      // Handle bulk import
      const result = await profilesStore.importAllProfiles(data, {
        skipDuplicates: importOptions.skipDuplicates,
        overwriteExisting: importOptions.overwriteExisting
      });
      bulkImportResult.value = result;
      
      // Console log the bulk import result
      console.log('[Bulk Import] Complete bulk import result:', result);
      console.log('[Bulk Import] Summary:', {
        totalProfiles: result.totalProfiles,
        successCount: result.successCount,
        failureCount: result.failureCount,
        skippedCount: result.skippedCount
      });
      if (result.results.length > 0) {
        console.log('[Bulk Import] Detailed results:', result.results);
      }
      
      if (result.successCount > 0) {
        // Emit success for the first successfully imported profile (for compatibility)
        const firstSuccess = result.results.find(r => r.success);
        if (firstSuccess && firstSuccess.profileId) {
          emit('imported', {
            success: true,
            profile: { id: firstSuccess.profileId } as any,
            errors: [],
            warnings: [],
            metadata: { source: result.metadata.source, migrated: false }
          });
        }
        
        // Close dialog after longer delay to show bulk results
        setTimeout(() => {
          emit('update:visible', false);
        }, 4000);
      }
    } else {
      // Handle single profile import
      console.log(`[${importMethod.value === 'aosetups' ? 'AOSetups' : importMethod.value} Import] Processing profile data...`);

      // Pre-validate for unsupported v3.0.0 format
      if (importMethod.value !== 'aosetups') {
        try {
          const parsed = JSON.parse(data);
          if (parsed.Character && parsed.Skills && parsed.version === '3.0.0') {
            throw new Error(`TinkerProfile v3.0.0 format is no longer supported. Please recreate your profile or import from AOSetups instead.

v4.0.0 introduces major architectural changes that are incompatible with v3.0.0.
Visit the TinkerProfiles page to create a new profile or use the AOSetups import feature.`);
          }
        } catch (parseError) {
          // If it's not JSON or our specific v3.0.0 error, continue with normal import flow
          if (parseError instanceof Error && parseError.message.includes('v3.0.0 format is no longer supported')) {
            throw parseError;
          }
        }
      }

      const result = await profilesStore.importProfile(data);
      importResult.value = result;
      
      // Console log the complete import result
      console.log(`[${importMethod.value === 'aosetups' ? 'AOSetups' : importMethod.value} Import] Complete import result:`, result);
      
      if (result.success) {
        console.log(`[${importMethod.value === 'aosetups' ? 'AOSetups' : importMethod.value} Import] Import successful!`, {
          profileName: result.profile?.Character?.Name,
          profileId: result.profile?.id,
          warnings: result.warnings
        });
        
        // Set as active if requested
        if (importOptions.setAsActive && result.profile) {
          await profilesStore.setActiveProfile(result.profile.id);
          console.log(`[${importMethod.value === 'aosetups' ? 'AOSetups' : importMethod.value} Import] Set as active profile`);
        }
        
        emit('imported', result);
        
        // Close dialog after a delay to show success message
        setTimeout(() => {
          emit('update:visible', false);
        }, 2000);
      } else {
        console.error(`[${importMethod.value === 'aosetups' ? 'AOSetups' : importMethod.value} Import] Import failed with errors:`, result.errors);
        console.warn(`[${importMethod.value === 'aosetups' ? 'AOSetups' : importMethod.value} Import] Import warnings:`, result.warnings);
      }
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Import failed';
    const importSource = importMethod.value === 'aosetups' ? 'AOSetups' : 
                        importMethod.value === 'file' ? 'File' : 'Text';
    
    console.error(`[${importSource} Import] Import failed:`, error);
    console.error(`[${importSource} Import] Error details:`, {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      importMethod: importMethod.value,
      isBulkImport: isBulkImport.value
    });
    
    if (isBulkImport.value) {
      bulkImportResult.value = {
        totalProfiles: 0,
        successCount: 0,
        failureCount: 1,
        skippedCount: 0,
        results: [{
          profileName: 'Unknown',
          success: false,
          skipped: false,
          error: errorMessage
        }],
        metadata: {
          source: 'unknown'
        }
      };
      console.log('[Bulk Import] Error result:', bulkImportResult.value);
    } else {
      importResult.value = {
        success: false,
        errors: [errorMessage],
        warnings: [],
        metadata: {
          source: 'unknown',
          migrated: false
        }
      };
      console.log(`[${importSource} Import] Error result:`, importResult.value);
    }
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
  aosetupsUrl.value = '';
  aosetupsError.value = '';
  detectedFormat.value = null;
  importResult.value = null;
  bulkImportResult.value = null;
  isBulkImport.value = false;
  importOptions.setAsActive = true;
  importOptions.validate = true;
  importOptions.skipDuplicates = false;
  importOptions.overwriteExisting = false;
}

// Watchers
watch(() => importText.value, (newText) => {
  if (newText.trim()) {
    detectedFormat.value = detectFormat(newText);
    updateBulkImportFlag(newText);
  } else {
    detectedFormat.value = null;
    isBulkImport.value = false;
  }
});

// Watch AOSetups URL for validation
watch(() => aosetupsUrl.value, (newUrl) => {
  validateAOSetupsUrl(newUrl);
});

watch(() => importMethod.value, () => {
  // Clear data when switching methods
  selectedFile.value = null;
  importText.value = '';
  aosetupsUrl.value = '';
  aosetupsError.value = '';
  detectedFormat.value = null;
  importResult.value = null;
  bulkImportResult.value = null;
  isBulkImport.value = false;
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