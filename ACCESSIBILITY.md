# TinkerTools Accessibility Guide

TinkerTools has been designed with accessibility as a core principle, ensuring that all users can effectively use the application regardless of their abilities or the assistive technologies they may use.

## Accessibility Standards Compliance

TinkerTools aims to meet **WCAG 2.1 AA** (Web Content Accessibility Guidelines) compliance standards. This includes:

- **Perceivable**: Information and UI components are presentable in ways users can perceive
- **Operable**: UI components and navigation are operable
- **Understandable**: Information and UI operation are understandable  
- **Robust**: Content can be interpreted by assistive technologies

## Key Accessibility Features

### 1. Skip Navigation
- **Skip to main content** link appears when tabbing through the page
- Allows keyboard users to bypass navigation and go directly to main content
- Located at the top of every page with proper focus styling

### 2. Semantic HTML and ARIA Landmarks
- **Header**: Site header with navigation (`role="banner"`)
- **Navigation**: Main navigation menu (`role="navigation"`)
- **Main**: Primary content area (`role="main"`)
- **Status regions**: Live regions for screen reader announcements

### 3. Keyboard Navigation
- **Full keyboard accessibility** - all interactive elements are reachable and operable via keyboard
- **Arrow key navigation** within data tables and lists
- **Tab order** follows logical flow through interface
- **Escape key** support for dismissing modal dialogs and returning focus
- **Enter/Space** activation for buttons and interactive elements

### 4. Screen Reader Support
- **ARIA labels** and descriptions for all form controls
- **Live regions** for dynamic content updates and status messages
- **Proper heading structure** (h1-h6) for logical content hierarchy
- **Alternative text** for meaningful icons and images
- **Hidden decorative elements** marked with `aria-hidden="true"`

### 5. Form Accessibility
- **Explicit labels** associated with all form controls via `for` attribute
- **Help text** and instructions linked via `aria-describedby`
- **Error messages** announced to screen readers
- **Required field indicators** clearly marked
- **Fieldset and legend** grouping for related form controls

### 6. Visual Design
- **High contrast** color schemes in both light and dark modes
- **Color is not the only indicator** - icons and text provide additional context
- **Focus indicators** clearly visible on all interactive elements
- **Responsive design** that works at 200% zoom and on small screens
- **Large touch targets** (minimum 44px × 44px) for mobile accessibility

## Implemented Components

### AccessibilityAnnouncer
Global component that manages screen reader announcements:
- **Polite announcements**: For status updates and non-urgent information
- **Assertive announcements**: For errors and urgent notifications
- **Status announcements**: For loading states and progress updates

### LoadingSpinner
Accessible loading indicator:
- **ARIA live region** announces loading state
- **Customizable text** for context-specific loading messages  
- **Screen reader support** with hidden text fallbacks
- **Visual and text indicators** available

### Keyboard Navigation Composables
Reusable functionality for keyboard interactions:
- **useKeyboardNavigation**: General arrow key navigation
- **useTableKeyboardNavigation**: Specialized for data tables
- **useMenuKeyboardNavigation**: Specialized for menus and dropdowns

## Testing Accessibility

### Automated Testing
Run accessibility tests using:
```bash
npm run test:accessibility
```

### Manual Testing Checklist

#### Keyboard Navigation
- [ ] Tab through all interactive elements
- [ ] Use arrow keys in data tables and lists
- [ ] Test Escape key functionality
- [ ] Verify Enter/Space activation
- [ ] Check focus is always visible

#### Screen Reader Testing
- [ ] Test with NVDA (Windows), VoiceOver (Mac), or ORCA (Linux)
- [ ] Verify all content is announced properly
- [ ] Check live region announcements work
- [ ] Test form label associations
- [ ] Verify heading structure is logical

#### Visual Testing
- [ ] Test at 200% zoom level
- [ ] Check color contrast ratios
- [ ] Verify focus indicators are visible
- [ ] Test with Windows High Contrast Mode
- [ ] Check both light and dark themes

#### Mobile Testing
- [ ] Test with mobile screen readers
- [ ] Verify touch targets are large enough
- [ ] Check swipe gestures work properly
- [ ] Test orientation changes

## Browser and Assistive Technology Support

### Supported Browsers
- **Chrome 90+** with NVDA, JAWS, VoiceOver
- **Firefox 88+** with NVDA, JAWS, ORCA
- **Safari 14+** with VoiceOver
- **Edge 90+** with NVDA, JAWS

### Supported Screen Readers
- **NVDA** (Windows) - Primary testing target
- **JAWS** (Windows) - Secondary support
- **VoiceOver** (macOS/iOS) - Full support
- **ORCA** (Linux) - Basic support
- **TalkBack** (Android) - Mobile support

## Common Accessibility Patterns

### Data Tables
```vue
<DataTable 
  ref="tableRef"
  :value="data"
  role="table"
  :aria-label="`Table showing ${data.length} items`"
  data-keyboard-nav-container
>
  <!-- Table content -->
</DataTable>
```

### Form Controls
```vue
<div class="form-field">
  <label 
    for="field-id" 
    class="field-label"
  >
    Field Name:
  </label>
  <InputText
    id="field-id"
    v-model="value"
    aria-describedby="field-help"
  />
  <span id="field-help" class="sr-only">
    Additional help text for screen readers
  </span>
</div>
```

### Screen Reader Announcements
```typescript
import { useAccessibility } from '@/composables/useAccessibility';

const { announce, announceError, announceSuccess } = useAccessibility();

// Polite announcement
announce('Data loaded successfully');

// Error announcement
announceError('Failed to save changes');

// Success announcement
announceSuccess('Profile updated');
```

## Accessibility Resources

### Guidelines
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Guidelines](https://webaim.org/)

### Testing Tools
- [axe-core](https://github.com/dequelabs/axe-core) - Automated accessibility testing
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - Built-in Chrome accessibility audit
- [WAVE](https://wave.webaim.org/) - Web accessibility evaluation tool
- [Color Oracle](https://colororacle.org/) - Color blindness simulator

### Screen Readers
- [NVDA](https://www.nvaccess.org/download/) - Free Windows screen reader
- [JAWS](https://www.freedomscientific.com/products/software/jaws/) - Commercial Windows screen reader
- [VoiceOver](https://support.apple.com/guide/voiceover/) - Built-in macOS/iOS screen reader

## Contributing to Accessibility

When contributing to TinkerTools, please:

1. **Test with keyboard navigation** before submitting PRs
2. **Include accessibility considerations** in component design
3. **Add ARIA labels** and descriptions where needed
4. **Follow semantic HTML** practices
5. **Test with screen readers** when possible
6. **Update accessibility tests** for new features

## Reporting Accessibility Issues

If you encounter accessibility barriers while using TinkerTools:

1. **Check this documentation** for known patterns and solutions
2. **Test with the latest version** to ensure the issue still exists  
3. **Report the issue** with details about:
   - Assistive technology used (screen reader, browser, etc.)
   - Steps to reproduce the problem
   - Expected vs. actual behavior
   - Screenshots or recordings if helpful

Accessibility is an ongoing process, and we welcome feedback from users of all abilities to improve the TinkerTools experience.