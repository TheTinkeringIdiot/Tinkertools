# TinkerTools Interpolation System Tests

This document describes the comprehensive test suite for the TinkerTools item interpolation system, which replicates the functionality of the legacy InterpItem.py system.

## 🎯 Test Coverage Overview

The test suite covers all aspects of the interpolation system:

### Backend Tests (Python/FastAPI)
- **Unit Tests**: Core interpolation logic and service methods
- **API Tests**: HTTP endpoints and request/response handling  
- **Integration Tests**: End-to-end workflow with real database

### Frontend Tests (TypeScript/Vue)
- **Service Tests**: Client-side interpolation service and caching
- **Composable Tests**: Vue reactive state management and UI integration

## 📁 Test File Structure

```
backend/app/tests/
├── test_interpolation_service.py      # Core service unit tests
├── test_interpolation_endpoints.py    # API endpoint tests
└── test_interpolation_integration.py  # Integration tests

frontend/src/
├── services/__tests__/
│   └── interpolation-service.test.ts  # Frontend service tests
└── composables/__tests__/
    └── useInterpolation.test.ts        # Vue composable tests
```

## 🧪 Backend Test Details

### test_interpolation_service.py (340+ lines)
**Purpose**: Tests core interpolation algorithms and service logic

**Key Test Categories**:
- **Core Interpolation Logic**
  - `test_interpolation_constants()` - Verifies INTERP_STATS and INTERPOLATABLE_SPELLS
  - `test_interpolate_value_calculation()` - Tests basic interpolation math
  - `test_interpolate_value_rounding()` - Ensures proper value rounding

- **Item Variant Discovery**
  - `test_find_item_variants()` - Database queries for same-named items
  - `test_find_interpolation_bounds()` - Finding correct low/high items for QL

- **Stat Interpolation**
  - `test_interpolate_stats_basic()` - Core stat interpolation logic
  - `test_interpolate_stats_same_values()` - Handling identical values
  - `test_interpolate_stats_no_interpolation()` - Non-interpolating cases

- **Spell Parameter Interpolation**
  - `test_interpolate_single_spell_stat_amount()` - Stat|Amount spells (53012, 53014)
  - `test_interpolate_single_spell_skill_amount()` - Skill|Amount spells (53026, 53028)
  - `test_interpolate_single_spell_stat_percent()` - Stat|Percent spells (53184, 53237)

- **Criteria Interpolation**
  - `test_interpolate_criteria_basic()` - Action criteria interpolation
  - `test_interpolate_criteria_non_interpolatable_stat()` - Non-INTERP_STATS handling
  - `test_interpolate_criteria_mismatched_operators()` - Edge case handling

- **Integration & Error Handling**
  - Tests for nano items, Control Points, missing items
  - Range calculations and boundary conditions
  - Database transaction handling

**Parametrized Tests**:
- `test_interp_stats_membership()` - Validates INTERP_STATS constant
- `test_interpolatable_spells_membership()` - Validates spell ID constants
- `test_interpolate_value_parametrized()` - Multiple interpolation scenarios

### test_interpolation_endpoints.py (250+ lines)
**Purpose**: Tests FastAPI HTTP endpoints and API contracts

**Key Test Categories**:
- **GET /items/{aoid}/interpolate**
  - Success scenarios with proper response format
  - Error handling (item not found, service exceptions)
  - Input validation (QL bounds, invalid AOID)
  - Performance monitoring and logging

- **GET /items/{aoid}/interpolation-info**
  - Interpolation metadata retrieval
  - Non-interpolatable item handling
  - Error responses and status codes

- **POST /items/interpolate**
  - JSON request body handling
  - Input validation and error responses
  - Alternative endpoint functionality

- **Edge Cases & Performance**
  - Boundary QL values (1, 500)
  - Large AOID values
  - Concurrent request handling
  - Response header validation
  - Request timing and logging

### test_interpolation_integration.py (350+ lines)
**Purpose**: End-to-end testing with real database interactions

**Key Test Categories**:
- **Full Workflow Testing**
  - Complete API-to-database interpolation process
  - Real SQLAlchemy model interactions
  - Database transaction management

- **Test Data Fixtures**
  - `sample_weapon_items()` - Multi-QL weapon items with stats
  - `sample_nano_item()` - Non-interpolatable nano item
  - `sample_spell_data()` - Items with interpolatable spells
  - `sample_action_data()` - Items with interpolatable action criteria

- **Boundary & Edge Case Testing**
  - Quality level boundaries (min/max)
  - Non-interpolatable items (nanos, Control Points)
  - Items with identical QLs
  - Missing/invalid items

- **Performance & Reliability**
  - Multiple concurrent requests
  - Memory usage validation
  - Database error handling
  - Transaction rollback scenarios

## 🎨 Frontend Test Details

### interpolation-service.test.ts (400+ lines)
**Purpose**: Tests client-side interpolation service and API integration

**Key Test Categories**:
- **Core Service Methods**
  - `interpolateItem()` - Main interpolation function
  - `getInterpolationInfo()` - Metadata retrieval
  - `isItemInterpolatable()` - Interpolation capability check
  - `getInterpolationRange()` - QL range calculation

- **Caching System**
  - Item interpolation caching by (aoid, ql) key
  - Interpolation info caching by aoid
  - Cache TTL and cleanup functionality
  - Cache statistics and management

- **Utility Functions**
  - `canItemBeInterpolated()` - Client-side heuristics
  - `itemToInterpolatedItem()` - Type conversion
  - `isInterpolatableStat()` - Stat ID validation

- **Error Handling**
  - Network error graceful handling
  - Malformed API response handling
  - Timeout and retry logic

- **State Management**
  - Reactive state updates
  - Loading state management
  - Error state clearing

### useInterpolation.test.ts (500+ lines)
**Purpose**: Tests Vue composable for reactive interpolation state

**Key Test Categories**:
- **Basic Functionality**
  - Composable initialization and default state
  - AOID and options handling
  - Auto-load behavior control

- **Computed Properties**
  - `isInterpolatable` - Reactive interpolation capability
  - `canInterpolate` - Validation of current state
  - `qualityRange` - QL bounds calculation
  - `isTargetQlValid` - QL validation
  - `interpolationStatus` - Current operation status

- **Core Methods**
  - `loadInterpolationInfo()` - Info loading with error handling
  - `interpolateToQl()` - Main interpolation with debouncing
  - `setItem()` / `setItemFromObject()` - Item configuration
  - `retry()` - Error recovery functionality

- **Debouncing & Performance**
  - Request debouncing (default 300ms)
  - Multiple rapid request handling
  - Timer cleanup on component unmount

- **Utility Methods**
  - `clear()` - State reset
  - `getSuggestedQualityLevels()` - UI helper
  - Quality range calculations

- **Watchers & Reactivity**
  - AOID change watching
  - State synchronization
  - Error clearing on success

## 🚀 Running the Tests

### Quick Start
```bash
# Run all interpolation tests
./run_interpolation_tests.sh

# Backend only
cd backend && pytest app/tests/test_interpolation*.py -v

# Frontend only  
cd frontend && npm test interpolation
```

### Individual Test Suites
```bash
# Backend service unit tests
cd backend && pytest app/tests/test_interpolation_service.py -v

# Backend API endpoint tests
cd backend && pytest app/tests/test_interpolation_endpoints.py -v

# Backend integration tests
cd backend && pytest app/tests/test_interpolation_integration.py -v

# Frontend service tests
cd frontend && npm test src/services/__tests__/interpolation-service.test.ts

# Frontend composable tests
cd frontend && npm test src/composables/__tests__/useInterpolation.test.ts
```

### Test Coverage
```bash
# Backend coverage report
cd backend && pytest app/tests/test_interpolation*.py --cov=app.services.interpolation --cov=app.models.interpolated_item --cov-report=html

# View coverage report
open backend/htmlcov/index.html
```

## 📊 Test Metrics

### Test Counts
- **Backend Tests**: 50+ individual test cases
- **Frontend Tests**: 40+ individual test cases
- **Total Coverage**: 90+ test scenarios

### Key Areas Covered
- ✅ Core interpolation algorithms (legacy InterpItem.py logic)
- ✅ Stat interpolation (INTERP_STATS constant)
- ✅ Spell parameter interpolation (specific spell IDs)
- ✅ Action criteria interpolation
- ✅ API endpoint validation and error handling
- ✅ Database integration and transaction handling
- ✅ Client-side caching and state management
- ✅ Vue reactive composable functionality
- ✅ Error recovery and retry logic
- ✅ Performance and concurrent access
- ✅ Edge cases and boundary conditions

## 🔍 Test Data Requirements

### Database Setup
Tests require a PostgreSQL database with the following:
- `items` table with multiple QL variants of the same item
- `stat_values` and `item_stats` for stat interpolation testing
- `spells`, `spell_data` for spell parameter testing
- `actions`, `criteria` for action criteria testing

### Environment Variables
```bash
export DATABASE_URL=postgresql://aodbuser:password@localhost:5432/tinkertools
```

## 🐛 Debugging Failed Tests

### Common Issues
1. **Database Connection**: Ensure PostgreSQL is running and accessible
2. **Missing Test Data**: Integration tests create their own test data
3. **Mock Failures**: Check that API client mocks are properly configured
4. **Timing Issues**: Some tests use fake timers for debouncing

### Debug Commands
```bash
# Run with verbose output and stop on first failure
pytest app/tests/test_interpolation_service.py -v -x

# Run specific test with detailed output
pytest app/tests/test_interpolation_service.py::TestInterpolationService::test_interpolate_value_calculation -v -s

# Frontend debugging
npm test -- --watch src/services/__tests__/interpolation-service.test.ts
```

## 📝 Test Maintenance

### Adding New Tests
1. **Backend**: Add to appropriate test class in existing files
2. **Frontend**: Follow existing test structure and mocking patterns
3. **Integration**: Add new fixtures for complex test scenarios

### Updating Tests
When modifying interpolation logic:
1. Update corresponding unit tests
2. Verify integration tests still pass
3. Update test documentation
4. Run full test suite before committing

## 🎯 Quality Assurance

The interpolation test suite ensures:
- **Legacy Compatibility**: Exact replication of InterpItem.py behavior
- **Data Integrity**: Correct interpolation calculations at all QLs
- **Error Resilience**: Graceful handling of edge cases and failures
- **Performance**: Acceptable response times for complex operations
- **Type Safety**: Full TypeScript coverage for frontend components
- **API Contract**: Stable API interface for client applications

This comprehensive test suite provides confidence that the interpolation system maintains the exact functionality and behavior of the legacy system while providing modern architecture benefits.