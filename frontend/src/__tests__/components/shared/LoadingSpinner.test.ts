import { describe, it, expect } from 'vitest';
import { mountWithContext, standardCleanup } from '@/__tests__/helpers';
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue';

describe('LoadingSpinner', () => {
  it('renders with default props', () => {
    const wrapper = mountWithContext(LoadingSpinner);
    
    expect(wrapper.exists()).toBe(true);
    expect(wrapper.attributes('role')).toBe('status');
    expect(wrapper.attributes('aria-label')).toBe('Loading: Loading...');
    expect(wrapper.attributes('aria-live')).toBe('polite');
  });

  it('renders with custom loading text', () => {
    const wrapper = mountWithContext(LoadingSpinner, {
      props: {
        loadingText: 'Loading items...'
      }
    });
    
    expect(wrapper.attributes('aria-label')).toBe('Loading: Loading items...');
    expect(wrapper.find('.sr-only').text()).toBe('Loading items...');
  });

  it('shows text when showText is true', () => {
    const wrapper = mountWithContext(LoadingSpinner, {
      props: {
        loadingText: 'Please wait...',
        showText: true
      }
    });
    
    const textElement = wrapper.find('.ml-2');
    expect(textElement.exists()).toBe(true);
    expect(textElement.text()).toBe('Please wait...');
    
    // Should not have sr-only text when visible text is shown
    expect(wrapper.find('.sr-only').exists()).toBe(false);
  });

  it('applies correct size classes for small spinner', () => {
    const wrapper = mountWithContext(LoadingSpinner, {
      props: {
        size: 'small'
      }
    });
    
    const container = wrapper.find('[role="status"]');
    expect(container.classes()).toContain('p-2');
    
    const spinner = wrapper.find('.animate-spin');
    expect(spinner.classes()).toContain('w-4');
    expect(spinner.classes()).toContain('h-4');
  });

  it('applies correct size classes for large spinner', () => {
    const wrapper = mountWithContext(LoadingSpinner, {
      props: {
        size: 'large'
      }
    });
    
    const container = wrapper.find('[role="status"]');
    expect(container.classes()).toContain('p-8');
    
    const spinner = wrapper.find('.animate-spin');
    expect(spinner.classes()).toContain('w-8');
    expect(spinner.classes()).toContain('h-8');
  });

  it('applies medium size classes by default', () => {
    const wrapper = mountWithContext(LoadingSpinner);
    
    const container = wrapper.find('[role="status"]');
    expect(container.classes()).toContain('p-4');
    
    const spinner = wrapper.find('.animate-spin');
    expect(spinner.classes()).toContain('w-6');
    expect(spinner.classes()).toContain('h-6');
  });

  it('has proper spinner animation and styling', () => {
    const wrapper = mountWithContext(LoadingSpinner);
    
    const spinner = wrapper.find('.animate-spin');
    expect(spinner.exists()).toBe(true);
    expect(spinner.classes()).toContain('border-2');
    expect(spinner.classes()).toContain('border-surface-300');
    expect(spinner.classes()).toContain('border-t-primary-500');
    expect(spinner.classes()).toContain('rounded-full');
    expect(spinner.attributes('aria-hidden')).toBe('true');
  });

  it('adjusts text size based on spinner size', () => {
    const wrapperSmall = mountWithContext(LoadingSpinner, {
      props: {
        size: 'small',
        showText: true,
        loadingText: 'Loading...'
      }
    });

    const textSmall = wrapperSmall.find('.ml-2');
    expect(textSmall.classes()).toContain('text-sm');

    const wrapperMedium = mountWithContext(LoadingSpinner, {
      props: {
        size: 'medium',
        showText: true,
        loadingText: 'Loading...'
      }
    });

    const textMedium = wrapperMedium.find('.ml-2');
    expect(textMedium.classes()).toContain('text-base');
  });

  it('provides proper aria attributes for accessibility', () => {
    const wrapper = mountWithContext(LoadingSpinner, {
      props: {
        loadingText: 'Loading user data...'
      }
    });
    
    const container = wrapper.find('[role="status"]');
    expect(container.attributes('role')).toBe('status');
    expect(container.attributes('aria-label')).toBe('Loading: Loading user data...');
    expect(container.attributes('aria-live')).toBe('polite');
  });
});