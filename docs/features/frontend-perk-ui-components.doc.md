# Frontend Perk UI Components

## Overview

TinkerTools now includes a comprehensive set of Vue 3 components for displaying and managing perk data in TinkerProfiles. The components provide an intuitive interface for viewing perk point allocation, perk details, and perk effects across SL (Standard), AI (Alien), and LE (Research) perk types.

## Key Components

### PerkTable (`frontend/src/components/profiles/perks/PerkTable.vue`)

A data table component that displays perk information in a structured format:

#### Features
- **Multi-Type Support**: Handles SL, AI, and LE perk types with appropriate styling
- **Interactive Elements**: Sortable columns and hover effects
- **Point Tracking**: Shows perk levels and point consumption (except for LE perks)
- **Effects Display**: Shows perk effects and bonuses
- **Empty State**: Graceful handling when no perks are present
- **Accessibility**: Full ARIA support and keyboard navigation

#### Component Structure
```vue
<PerkTable
  :perks="perkList"
  :perkType="'SL' | 'AI' | 'LE'"
  :editable="boolean"
  @add-perks="handleAddPerks"
  @upgrade="handleUpgrade"
  @remove="handleRemove"
/>
```

#### Columns
- **Perk Name**: Name with type-specific icon (star for SL, bolt for AI, book for LE)
- **Level**: Current level with max level indicator (X/10)
- **Points**: Points used (shown for SL and AI, hidden for LE)
- **Effects**: Perk effects and stat bonuses
- **Actions**: Upgrade and remove buttons (when editable)

### PerkPointsSummary (`frontend/src/components/profiles/perks/PerkPointsSummary.vue`)

A compact horizontal component that provides an overview of perk point allocation:

#### Features
- **Multi-Type Overview**: Shows SL points, AI points, and LE research count
- **Progress Visualization**: Progress bars for point usage with overflow indication
- **Character Context**: Displays character level and alien level
- **Responsive Design**: Adapts to mobile and desktop layouts
- **Status Indicators**: Color-coded progress bars and warning states

#### Component Structure
```vue
<PerkPointsSummary
  :slPointsUsed="number"
  :maxSLPoints="number"
  :aiPointsUsed="number"
  :maxAIPoints="number"
  :researchCount="number"
  :characterLevel="number"
  :alienLevel="number"
/>
```

#### Visual Elements
- **SL Points**: Blue progress bar with star icon
- **AI Points**: Cyan progress bar with bolt icon
- **LE Research**: Purple badge with book icon
- **Character Info**: Level display with optional AI level

### Enhanced PerkTabs (`frontend/src/components/profiles/perks/PerkTabs.vue`)

Updated tab container that integrates the new perk components:

#### Enhancements
- **Component Integration**: Uses PerkTable and PerkPointsSummary
- **Improved Layout**: Better spacing and visual hierarchy
- **Type-Specific Styling**: Consistent styling across all perk types
- **Data Binding**: Proper data flow from profile to components

## Data Flow

1. **Profile Loading**: TinkerProfile data loaded with perk information
2. **Data Processing**: Perk data processed and categorized by type (SL/AI/LE)
3. **Point Calculation**: Points used and available calculated based on character level
4. **Component Rendering**: Data passed to PerkTable and PerkPointsSummary components
5. **User Interaction**: Component events bubble up to parent for state management

## Implementation Files

### Core Component Files
- `frontend/src/components/profiles/perks/PerkTable.vue` - Main perk data table
- `frontend/src/components/profiles/perks/PerkPointsSummary.vue` - Point allocation summary
- `frontend/src/components/profiles/perks/PerkTabs.vue` - Tab container (enhanced)

### Type Definitions
- `frontend/src/lib/tinkerprofiles/perk-types.ts` - TypeScript interfaces for perk data
- Type-safe component props and events

### Integration Points
- `frontend/src/views/TinkerProfileDetail.vue` - Main profile view integration
- Data binding and event handling for perk management

## Styling and Design

### Visual Hierarchy
- **Type Differentiation**: Each perk type has distinct color coding
  - SL Perks: Primary blue theme with star icons
  - AI Perks: Cyan theme with bolt icons
  - LE Perks: Purple theme with book icons

### Responsive Design
- **Mobile Optimization**: Components adapt to narrow screens
- **Flexible Layouts**: Grid and flexbox layouts adjust to available space
- **Touch-Friendly**: Larger touch targets for mobile interaction

### Accessibility Features
- **ARIA Labels**: Comprehensive labeling for screen readers
- **Keyboard Navigation**: Full keyboard support for all interactive elements
- **Color Contrast**: High contrast ratios for text readability
- **Focus Management**: Clear focus indicators throughout

## Usage Examples

### Basic Perk Table
```vue
<template>
  <PerkTable
    :perks="profile.slPerks"
    perkType="SL"
    :editable="canEdit"
    @add-perks="openPerkSelector"
    @upgrade="upgradePerk"
    @remove="removePerk"
  />
</template>
```

### Points Summary
```vue
<template>
  <PerkPointsSummary
    :slPointsUsed="calculateSLPoints(profile.slPerks)"
    :maxSLPoints="calculateMaxSLPoints(profile.level)"
    :aiPointsUsed="calculateAIPoints(profile.aiPerks)"
    :maxAIPoints="calculateMaxAIPoints(profile.alienLevel)"
    :researchCount="profile.researchPerks.length"
    :characterLevel="profile.level"
    :alienLevel="profile.alienLevel"
  />
</template>
```

### Complete Integration
```vue
<template>
  <div class="perk-management">
    <PerkPointsSummary v-bind="pointsData" />

    <TabView>
      <TabPanel header="SL Perks">
        <PerkTable :perks="profile.slPerks" perkType="SL" />
      </TabPanel>
      <TabPanel header="AI Perks">
        <PerkTable :perks="profile.aiPerks" perkType="AI" />
      </TabPanel>
      <TabPanel header="LE Research">
        <PerkTable :perks="profile.researchPerks" perkType="LE" />
      </TabPanel>
    </TabView>
  </div>
</template>
```

## State Management

### Point Calculation
- **SL Points**: Based on character level using game formulas
- **AI Points**: Based on alien level progression
- **Research Limit**: No point limit, only active research count

### Data Validation
- **Level Constraints**: Perks cannot exceed character/alien level requirements
- **Point Limits**: Prevents over-allocation of points
- **Type Validation**: Ensures perks match their declared type

## Performance Considerations

- **Virtual Scrolling**: Large perk lists handled efficiently
- **Computed Properties**: Reactive calculations for points and limits
- **Component Optimization**: Minimal re-renders on data changes
- **Lazy Loading**: Components loaded only when needed

## Future Enhancements

### Planned Features
- **Drag and Drop**: Reorder perks within lists
- **Bulk Operations**: Select and modify multiple perks
- **Search and Filter**: Find specific perks quickly
- **Export/Import**: Share perk configurations

### Enhancement Opportunities
- **Animation**: Smooth transitions for state changes
- **Tooltips**: Detailed perk information on hover
- **Comparison Mode**: Compare different perk configurations
- **Optimization Suggestions**: AI-powered perk recommendations