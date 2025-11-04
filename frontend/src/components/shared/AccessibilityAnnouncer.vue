<template>
  <div>
    <!-- Polite announcements -->
    <div id="polite-announcer" aria-live="polite" aria-atomic="true" class="sr-only">
      {{ politeMessage }}
    </div>

    <!-- Assertive announcements -->
    <div id="assertive-announcer" aria-live="assertive" aria-atomic="true" class="sr-only">
      {{ assertiveMessage }}
    </div>

    <!-- Status announcements -->
    <div id="status-announcer" role="status" aria-live="polite" aria-atomic="true" class="sr-only">
      {{ statusMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const politeMessage = ref('');
const assertiveMessage = ref('');
const statusMessage = ref('');

// Custom event handlers for announcements
const handlePoliteAnnouncement = (event: CustomEvent) => {
  politeMessage.value = event.detail.message;
  clearMessage('polite');
};

const handleAssertiveAnnouncement = (event: CustomEvent) => {
  assertiveMessage.value = event.detail.message;
  clearMessage('assertive');
};

const handleStatusAnnouncement = (event: CustomEvent) => {
  statusMessage.value = event.detail.message;
  clearMessage('status');
};

const clearMessage = (type: 'polite' | 'assertive' | 'status') => {
  setTimeout(() => {
    if (type === 'polite') politeMessage.value = '';
    else if (type === 'assertive') assertiveMessage.value = '';
    else if (type === 'status') statusMessage.value = '';
  }, 1000);
};

onMounted(() => {
  // Listen for custom announcement events
  window.addEventListener('announce-polite', handlePoliteAnnouncement as EventListener);
  window.addEventListener('announce-assertive', handleAssertiveAnnouncement as EventListener);
  window.addEventListener('announce-status', handleStatusAnnouncement as EventListener);
});

onUnmounted(() => {
  window.removeEventListener('announce-polite', handlePoliteAnnouncement as EventListener);
  window.removeEventListener('announce-assertive', handleAssertiveAnnouncement as EventListener);
  window.removeEventListener('announce-status', handleStatusAnnouncement as EventListener);
});
</script>

<style scoped>
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
