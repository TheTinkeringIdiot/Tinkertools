<!--
SpellParameters - Display spell parameters with type-specific formatting
Handles links, percentages, and other parameter types with pill-style badges
-->
<template>
  <div class="spell-parameters">
    <div class="parameters-list">
      <router-link
        v-for="param in linkParameters"
        :key="param.key"
        :to="param.linkUrl || ''"
        class="parameter-link"
        :title="`${param.key}: ${param.displayValue}`"
      >
        <span class="parameter-badge link-badge">
          <span class="parameter-icon">🔗</span>
          <span class="parameter-text">{{ param.displayValue }}</span>
        </span>
      </router-link>

      <span
        v-for="param in nonLinkParameters"
        :key="param.key"
        class="parameter-badge"
        :class="getParameterClass(param.type)"
        :title="`${param.key}: ${param.displayValue}`"
      >
        <span v-if="getParameterIcon(param.type)" class="parameter-icon">
          {{ getParameterIcon(param.type) }}
        </span>
        <span class="parameter-text">{{ param.displayValue }}</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { FormattedParameter } from '@/services/spell-data-utils';

// ============================================================================
// Props
// ============================================================================

interface Props {
  parameters: FormattedParameter[];
  maxVisible?: number;
  showIcons?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  parameters: () => [],
  maxVisible: 6,
  showIcons: true,
});

// ============================================================================
// Computed Properties
// ============================================================================

const visibleParameters = computed(() => {
  return props.parameters.slice(0, props.maxVisible);
});

const linkParameters = computed(() => {
  return visibleParameters.value.filter((param) => param.type === 'link');
});

const nonLinkParameters = computed(() => {
  return visibleParameters.value.filter((param) => param.type !== 'link');
});

// ============================================================================
// Methods
// ============================================================================

function getParameterClass(type: string): string {
  const classMap: Record<string, string> = {
    percentage: 'percentage-badge',
    stat: 'stat-badge',
    number: 'number-badge',
    text: 'text-badge',
  };
  return classMap[type] || 'text-badge';
}

function getParameterIcon(type: string): string {
  if (!props.showIcons) return '';

  const iconMap: Record<string, string> = {
    percentage: '%',
    stat: '📊',
    number: '#',
    text: '💬',
  };
  return iconMap[type] || '';
}
</script>

<style scoped>
.spell-parameters {
  display: inline-block;
}

.parameters-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.parameter-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 600;
  border-radius: 12px;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.parameter-link {
  text-decoration: none;
}

.parameter-link:hover .link-badge {
  transform: scale(1.05);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.link-badge {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: white;
  cursor: pointer;
}

.percentage-badge {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: white;
}

.stat-badge {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
}

.number-badge {
  background: rgba(100, 116, 139, 0.1);
  color: #475569;
  border: 1px solid #cbd5e1;
}

.text-badge {
  background: rgba(107, 114, 128, 0.1);
  color: #4b5563;
  border: 1px solid #d1d5db;
}

/* Dark mode support */
.dark .number-badge {
  background: rgba(100, 116, 139, 0.2);
  color: #94a3b8;
  border-color: #475569;
}

.dark .text-badge {
  background: rgba(107, 114, 128, 0.2);
  color: #9ca3af;
  border-color: #4b5563;
}

.parameter-icon {
  font-size: 8px;
  opacity: 0.8;
}

.parameter-text {
  font-weight: 600;
}

/* Responsive behavior */
@media (max-width: 640px) {
  .parameter-badge {
    font-size: 9px;
    padding: 1px 4px;
  }

  .parameter-icon {
    font-size: 7px;
  }
}
</style>
