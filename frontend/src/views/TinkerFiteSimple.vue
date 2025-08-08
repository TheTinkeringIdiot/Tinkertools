<template>
  <div class="min-h-screen bg-gray-50">
    <div class="container mx-auto px-4 py-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-4">TinkerFite - Weapon Selection</h1>
      <p class="text-gray-600 mb-8">Skill-based weapon filtering for Anarchy Online</p>
      
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-semibold mb-4">Debug Information</h2>
        <div class="space-y-2">
          <p><strong>Current Route:</strong> /fite</p>
          <p><strong>Component:</strong> TinkerFiteSimple (working)</p>
          <p><strong>Status:</strong> Basic route is functional</p>
        </div>
        
        <div class="mt-6">
          <h3 class="font-medium mb-2">Test Backend Connection</h3>
          <button 
            @click="testBackend"
            class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            :disabled="loading"
          >
            {{ loading ? 'Testing...' : 'Test Weapon Data' }}
          </button>
          
          <div v-if="backendResult" class="mt-4 p-3 bg-gray-100 rounded">
            <pre>{{ backendResult }}</pre>
          </div>
          
          <div v-if="error" class="mt-4 p-3 bg-red-100 text-red-800 rounded">
            Error: {{ error }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const loading = ref(false)
const backendResult = ref<string>('')
const error = ref<string>('')

const testBackend = async () => {
  loading.value = true
  error.value = ''
  backendResult.value = ''
  
  try {
    const response = await fetch('http://localhost:8000/api/v1/items?item_class=1&page_size=3')
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    backendResult.value = `Found ${data.total} weapons, showing first 3:\n` +
      data.items.map((item: any) => `- ${item.name} (QL ${item.ql})`).join('\n')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error'
  } finally {
    loading.value = false
  }
}
</script>