# Perk System Enhancements

## Overview

TinkerTools has received significant enhancements to the perk system, focusing on complete item detail loading, accurate bonus calculations, and improved UI responsiveness. These enhancements provide users with comprehensive perk information including detailed stat bonuses, spell effects, and seamless integration with the IP calculation system.

## Key Enhancements

### Complete Perk Item Detail Loading

#### Backend (`backend/app/store/curated.py` (`lookup_perks`))

`POST /perks/batch/lookup` returns, for each AOID that is a perk the requested game version serves, the perk's item (stats, spell data, actions) followed by its curated fields (name, counter, type, series, professions, breeds, level and AI level requirements). Perks are read from the content-addressed store in three queries whatever the number of AOIDs; a build without the `perks` feature has none.

### Perk Bonus Calculation System

#### New Service (`frontend/src/services/perk-bonus-calculator.ts`)

A comprehensive service for calculating stat bonuses from perk items:

**Features**
- **Spell Data Parsing**: Extracts stat modifications from spell_data (events 1, 14)
- **Multiple Spell IDs**: Supports stat bonus spells (53045, 53012, 53014, 53175)
- **Error Recovery**: Extensive error handling and validation
- **Performance Optimized**: LRU caching and performance monitoring
- **Type Safety**: Full TypeScript interface definitions

**Key Functions**
- `calculatePerkBonuses(perks)`: Main function for computing aggregated bonuses
- `parseItemForStatBonuses(perk)`: Parse individual perk for stat bonuses
- `calculatePerkBonusesWithErrors(perks)`: Calculation with detailed error reporting

**Performance Requirements**
- Sub-200ms calculation time for 30+ perks (meets NFR1.2)
- Comprehensive caching system
- Individual error handling prevents cascade failures

#### Test Coverage (`frontend/src/services/__tests__/perk-bonus-calculator.test.ts`)

**Comprehensive Test Suite**
- Basic functionality tests
- Performance benchmarks (30-50 perks under 200ms)
- Error recovery scenarios
- Cache effectiveness validation
- Integration tests with mixed valid/invalid data

### UI Integration Enhancements

#### Enhanced Perk Table (`frontend/src/components/profiles/perks/PerkTable.vue`)

**New Features**
- **Dynamic Effect Display**: Real-time calculation of perk stat bonuses
- **Item Data Integration**: Uses complete item data when available
- **Error Handling**: Graceful handling of missing or invalid perk data
- **Performance Optimized**: Efficient effect parsing with error recovery

**Key Changes**
- `getPerkEffects()`: New method using perk-bonus-calculator service
- Dynamic effect parsing replaces placeholder text
- Skill name formatting with bonus amounts

#### Enhanced Skill Slider (`frontend/src/components/profiles/skills/SkillSlider.vue`)

**New Features**
- **Perk Bonus Display**: Shows perk contributions to skill values
- **Enhanced Tooltips**: Includes perk bonuses in skill breakdowns
- **Visual Indicators**: Clear display of perk vs equipment bonuses

**Integration Points**
- Perk bonus calculation in skill totals
- Tooltip breakdown includes perk contributions
- Visual distinction between bonus types

### IP Integration System

#### Enhanced IP Integrator (`frontend/src/lib/tinkerprofiles/ip-integrator.ts`)

**Key Changes**
- **Perk Service Integration**: Uses new perk-bonus-calculator service
- **Item-Based Processing**: Processes complete item data from perks
- **Error Recovery**: Graceful handling of missing item data
- **Performance Optimized**: Efficient perk bonus aggregation

**Data Flow**
1. Extract item data from PerkEntry and ResearchEntry objects
2. Use perk-bonus-calculator to extract stat bonuses
3. Aggregate bonuses by skill name
4. Integrate with IP calculation system

#### Enhanced Store Integration (`frontend/src/stores/tinkerProfiles.ts`)

**New Features**
- **Perk Change Monitoring**: Watches PerksAndResearch for changes
- **Automatic Recalculation**: Triggers equipment bonus recalculation on perk changes
- **Race Condition Prevention**: Proper flag management to prevent recursive updates

**Implementation Details**
- New perk watcher in equipment change monitoring
- `isUpdatingFromPerkChanges` flag for update coordination
- Integration with existing equipment bonus system

## Data Flow Architecture

### Perk Loading Sequence

1. **Backend**: Perk service loads complete item details with all relationships
2. **API Response**: Full ItemDetail with perk metadata returned to frontend
3. **Frontend Storage**: Complete item data stored in PerkEntry/ResearchEntry
4. **Bonus Calculation**: Perk-bonus-calculator extracts stat bonuses from item data
5. **UI Display**: Components show detailed effects and integrate with skill calculations

### Bonus Calculation Flow

1. **Item Extraction**: Extract item data from perk entries
2. **Spell Parsing**: Parse spell_data for stat modification spells
3. **Stat Mapping**: Convert stat IDs to skill names using skill mappings
4. **Aggregation**: Combine bonuses by skill name
5. **Integration**: Apply bonuses to skill calculations and IP system

## Implementation Files

### Backend Files
- `backend/app/api/routes/perks.py` - Batch perk lookup endpoint
- `backend/app/store/curated.py` - `lookup_perks`: perks with complete item details

### Frontend Core Files
- `frontend/src/services/perk-bonus-calculator.ts` - New bonus calculation service
- `frontend/src/services/__tests__/perk-bonus-calculator.test.ts` - Comprehensive test suite
- `frontend/src/lib/tinkerprofiles/ip-integrator.ts` - Enhanced IP integration
- `frontend/src/stores/tinkerProfiles.ts` - Enhanced store with perk monitoring

### Frontend Component Files
- `frontend/src/components/profiles/perks/PerkTable.vue` - Enhanced effect display
- `frontend/src/components/profiles/skills/SkillSlider.vue` - Perk bonus integration

### Type Definition Files
- `frontend/src/lib/tinkerprofiles/perk-types.ts` - Enhanced with item data support

## Performance Characteristics

### Backend Performance
- **Constant query count**: three queries per batch lookup, whatever the number of perks

### Frontend Performance
- **Calculation Speed**: Sub-200ms for 30+ perks (verified by tests)
- **Caching Strategy**: LRU caching for parsed spell data and aggregated bonuses
- **Memory Management**: Bounded cache sizes prevent memory leaks
- **Error Isolation**: Individual perk failures don't break calculation for others

### UI Responsiveness
- **Real-Time Updates**: Immediate effect display when perks change
- **Efficient Parsing**: Optimized spell data parsing with caching
- **Progressive Enhancement**: Fallback behavior for missing data

## Error Handling Strategy

### Comprehensive Error Recovery
- **Individual Perk Isolation**: Errors in one perk don't affect others
- **Graceful Degradation**: Missing data handled without breaking UI
- **Detailed Logging**: Error tracking for debugging and monitoring
- **User-Friendly Fallbacks**: Meaningful messages and continued operation

### Error Types Handled
- Missing or corrupt item data
- Invalid spell data structures
- Unknown stat IDs
- Network failures during data loading
- Cache corruption scenarios

## Future Enhancement Opportunities

### Short-Term Improvements
- **Effect Tooltips**: Detailed spell effect descriptions
- **Performance Monitoring**: Real-time performance metrics display
- **Validation Feedback**: Visual indicators for perk requirement validation

### Long-Term Enhancements
- **Effect Simulation**: Preview bonus effects before acquisition
- **Optimization Suggestions**: AI-powered perk recommendation system
- **Export/Import**: Share perk configurations between profiles
- **Advanced Filtering**: Search perks by effect types or bonuses

## Migration and Compatibility

### Backwards Compatibility
- **Legacy Support**: Existing perk entries continue to work without item data
- **Progressive Enhancement**: New features activate when item data is available
- **Schema Evolution**: New schemas extend existing ones without breaking changes

### Data Migration
- **Automatic Enhancement**: Existing perks automatically gain new features when item data loads
- **No Manual Migration**: Users don't need to manually update their profiles
- **Graceful Fallbacks**: Missing data handled transparently

## Testing and Quality Assurance

### Test Coverage
- **Unit Tests**: Comprehensive testing of perk-bonus-calculator (100+ test cases)
- **Performance Tests**: Validated sub-200ms requirement for 30+ perks
- **Error Scenarios**: Extensive testing of error recovery mechanisms
- **Integration Tests**: End-to-end testing of perk data flow

### Quality Metrics
- **Performance Compliance**: Meets all established performance requirements
- **Error Recovery**: 100% error scenario coverage
- **Type Safety**: Full TypeScript coverage with strict type checking
- **Code Coverage**: High test coverage across all new functionality