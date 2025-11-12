# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TinkerTools is a suite of six web-based utilities for the MMORPG Anarchy Online:
- **TinkerItems** - Item database and search
- **TinkerNanos** - Nano program management
- **TinkerFite** - Weapon analysis and comparison
- **TinkerPlants** - Implant and symbiant planning
- **TinkerPocket** - Pocket boss and collection tracking
- **TinkerNukes** - Nanotechnician offensive nano specialization

## Development Commands

### Frontend (Vue 3 + TypeScript + Vite)
```bash
# Install dependencies (from repository root)
npm install

# Start development server
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Formatting
npm run format

# Run tests
npm test

# Interactive test UI
npm run test:ui

# Build for production
npm run build
```

### Backend (FastAPI + Python)
```bash
# Setup virtual environment
python -m venv backend/venv
source backend/venv/bin/activate  # Linux/Mac
DATABASE_URL is in .env.local. The `source` command does not export it. 

# Install dependencies
pip install -r backend/requirements.txt

# Copy environment configuration
cp backend/.env.example backend/.env

# Run development server
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Format code with Black
black app/

# Lint with Ruff
ruff check app/

# Run tests (when implemented)
pytest
```

### Database (PostgreSQL)
```bash
# Setup database (first time only)
cd database
./setup.sh

# Reset database
./setup.sh reset

# Create backup
./backup.sh backup

# Run schema tests
psql -U tinkertools_user -d tinkertools -f database/tests/test_schema.sql
```

## Claude Code Configuration

This section provides configuration information specifically for Claude Code (claude.ai/code).

### Environment Configuration

  Claude Code uses `backend/.env.local` for local environment settings. This file:
  - Contains database connection strings and development paths
  - Is excluded from git tracking via `.gitignore`
  - Should remain local to your machine

  **Usage for Claude Code:**
  - Always use the virtual environment at `backend/venv` for Python operations
  - Use the DATABASE_URL from `.env.local` for database connections
  - Load environment from `.env.local` when running backend commands

  **Note:** The `.env.local` file is git-ignored and stays local.


**Example backend startup command:**
```bash
# Load environment from .env.local and start backend
cd backend && source venv/bin/activate && \
export $(cat .env.local | xargs) && \
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Architecture Overview

### Technology Stack
- **Frontend**: Vue 3, TypeScript, Vite, Vue Router, Pinia, TailwindCSS, PrimeVue (Aura theme)
- **Backend**: FastAPI, SQLAlchemy (async), Pydantic, asyncpg
- **Database**: PostgreSQL 12+ with 23 core tables plus caching (includes source system)
- **Testing**: Vitest (frontend), pytest (backend)

### Database Schema
The database follows a legacy-compatible design with:
- **Core Tables**: items, spells, symbiants, pocket_bosses, stat_values, criteria, source_types, sources
- **Junction Tables**: For many-to-many relationships (item_stats, spell_criteria, item_sources, etc.)
- **Source System**: Polymorphic design for tracking item origins (crystals, NPCs, missions, etc.)
- **No Timestamps**: Static game data doesn't require audit trails
- **Optimized Indexes**: B-tree for queries, GIN for full-text search

### Key Performance Requirements
- Complex stat queries: < 500ms (REQ-PERF-001)
- Route navigation: < 200ms (REQ-PERF-002)
- Initial page load: < 3 seconds (REQ-PERF-003)

### Data Privacy
- All user/character data stored client-side only (LocalStorage)
- TinkerFite weapon cache uses IndexedDB for larger storage capacity (50MB+ vs LocalStorage 5-10MB)
- Server contains only game reference data
- No user accounts or authentication required

### Client-Side Storage Strategy
- **LocalStorage**: User profiles, preferences, settings (~10-50 KB per profile)
- **IndexedDB**: TinkerFite weapon analysis cache (~5-6 MB for 5 profiles)
  - Uses `idb-keyval` library (500 bytes gzipped)
  - 1 hour TTL, LRU eviction with max 5 cached profiles
  - Automatic cleanup of legacy LocalStorage keys on first load
  - Debug: Chrome DevTools → Application → IndexedDB

## Important Project Decisions

1. **Monorepo Structure**: Frontend and backend in single repository for easier development
2. **Direct Deployment**: No containerization initially (can add Docker later if needed)
3. **Client-Side User Data**: Privacy-first approach with no server-side user data
4. **Legacy Data Compatibility**: Schema designed to match existing Django model structure
5. **TypeScript Strict Mode**: Enforced for better type safety and maintainability
6. **Skills are IDs**: All front end skills are stored and used as ID numbers for everything but display

## Working with the Codebase

### Adding New Features
1. Check docs/work_plan.md for implementation tasks
2. Review relevant design documents in docs/ folder
3. Follow existing code patterns and conventions
4. Write tests for new functionality
5. Update documentation as needed

### Common Patterns
- **API Endpoints**: Follow RESTful conventions with Pydantic models
- **Vue Components**: Use Composition API with TypeScript
- **State Management**: Use Pinia stores for shared state
- **Database Queries**: Use SQLAlchemy ORM with async sessions
- **Error Handling**: Proper HTTP status codes and error messages

### Testing Strategy

**Frontend Testing** (Vitest + Playwright):
The frontend test suite was refactored in November 2025 with an **E2E-first approach** and **aggressive deletion strategy**. We deleted 45 fragile test files (~4,500 lines) and focused on tests that catch real bugs.

**Test Philosophy**:
- ✅ Test **user behavior**, not implementation details
- ✅ Use **real stores** with mocked API only (no Pinia mocks)
- ✅ Use **E2E tests** for critical workflows (not fragile component tests)
- ❌ Deleted all component tests with mocked stores (brittle, false confidence)

**Test Pyramid** (55/40/5 distribution):
1. **Unit/Service Tests** (~23 files, ~400 tests, 95% pass):
   - Pure functions: IP calculator, bonus calculator, weapon DPS
   - Business logic: action criteria, game formulas, stat lookups
   - No external dependencies, fast execution (< 5s)
   - Examples: `action-criteria.test.ts`, `perk-bonus-calculator.test.ts`, `ip-calculator.test.ts`

2. **Integration Tests** (~13 files, ~250 tests, 80% pass):
   - **Real Pinia stores** with **mocked API client** only
   - Tests real state management, reactivity, component integration
   - Caught 4 production bugs that mocked tests missed
   - Examples: `buff-management.integration.test.ts`, `equipment-interaction.integration.test.ts`
   - Infrastructure: `src/__tests__/helpers/integration-test-utils.ts`
   - Fixtures: `profile-fixtures.ts`, `item-fixtures.ts`, `nano-fixtures.ts`

3. **E2E Tests** (~8 files, ~80 tests, 60% pass):
   - **Playwright** browser automation for critical user workflows
   - Tests real browser, real rendering, real user interactions
   - Optional backend (can mock for speed)
   - Examples: `item-search-workflow.test.ts`, `profile-management-workflow.test.ts`
   - Use page object pattern for maintainability

4. **Backend Integration Tests** (~3 files, ~50 tests, skipped):
   - Require real backend running
   - Use `describe.skipIf(!BACKEND_AVAILABLE)` pattern
   - Backend availability check: `helpers/backend-check.ts`

**What We Deleted** (November 2025 refactoring):
- 31 component test files - Fragile selectors, wrong level of testing
- 8 view test files - Same issues as component tests
- 6 store unit test files - Mocking stores defeats the purpose
- 2 composable test files - Thin wrappers, better tested via integration
- 3 transformer test files - Too tightly coupled to implementation

**Production Bugs Fixed** (discovered via integration tests):
1. Equipment bonuses not applied - `ip-integrator.ts` only checked `spell_data`
2. MaxNCU calculation wrong - base + level formula broken
3. Skill auto-creation missing - `modifySkill()` didn't create trainable skills
4. Profile localStorage keys wrong - using legacy format instead of individual keys

**Critical Test Setup Pattern**:
```typescript
// Integration test setup (REQUIRED)
import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';

// CRITICAL: Mock API BEFORE store imports
vi.mock('@/services/api-client');

beforeEach(async () => {
  // Setup PrimeVue + ToastService (stores use toasts)
  const app = createApp({});
  app.use(PrimeVue);
  app.use(ToastService);

  context = await setupIntegrationTest();
  app.use(context.pinia);

  store = useTinkerProfilesStore();
});
```

**Test Execution**:
```bash
# Run all tests (< 30s without E2E)
npm test

# Run with UI
npm run test:ui

# Run E2E tests
npx playwright test

# Run E2E with UI
npx playwright test --ui
```

**Backend Testing** (pytest):
- Unit tests for API endpoints
- Database integration tests
- Query performance validation

**Documentation**:
- **Test Strategy**: `frontend/src/__tests__/TESTING_STRATEGY.md` - Comprehensive guide
- **Refactoring Summary**: `frontend/TEST_REFACTORING_SUMMARY.md` - What was deleted and why
- **Test Examples**: `src/__tests__/integration/`, `src/__tests__/e2e/`

## Resources

- **Requirements**: docs/Requirements.md (47 total requirements)
- **Work Plan**: docs/work_plan.md (18 implementation tasks)
- **Database Documentation**: DATABASE.md
- **Architecture Documents**: docs/ folder
- **API Documentation**: Available at http://localhost:8000/docs when backend is running
- You are able to use Playwright MCP server to evaluate the application in a web browser