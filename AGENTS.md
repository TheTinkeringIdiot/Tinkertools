# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Build/Lint/Test Commands (Non-Obvious)
- Frontend: cd frontend && vite build (sourcemap false for prod); cd frontend && vitest run --coverage (Pinia mock in setup.ts for polymorphic stores).
- Backend: cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 (from backend/ for relative imports); cd backend && pytest -v --cov=app (venv activate for asyncpg).
- Lint: cd frontend && eslint . (vue/multi-word off for legacy); cd backend && ruff check --fix --select E,F,W (pinned 0.5.7).
- Database: cd database && ./setup.sh (psql superuser for polymorphic migrations, no timestamps on core tables).
- Gotcha: All frontend commands from frontend/ for '@' alias resolution; backend from backend/ to avoid polymorphic model import errors.

## Code Style (Non-Obvious)
- Imports: Use '@' alias for src/ (vite.config.ts/tsconfig.json); singleQuote true in prettier for TS/Vue.
- Naming: vue/multi-word-component-names off for legacy like TinkerNanos.vue; UPPER_SNAKE for AO constants like SKILL_COST_FACTORS.
- Types: tsconfig strict true but implicit any in game composables for polymorphic unions (Item | Nano).
- Styling: Tailwind custom surface/primary scales for unified dark mode (class-based).
- Error Handling: api-client batch 50ms wait/retry backoff for 500s; Pydantic 422 with custom messages for polymorphic validation.

## Critical Patterns & Architecture Gotchas
- Utilities: Use ip-calculator.ts for AO IP trickle-down (validate calcIPAdjustableRange); symbiantHelpers.enrichSymbiant() for nano placeholders (raw DB incomplete).
- Non-Standard: Client-side debounced blending in useInterpolation.ts (privacy, no server stats); backend decorators.py TTL per query with manual invalidation on polymorphic updates.
- Architecture: Pinia/api-client coupling for JSONB polymorphic deserialization; middleware caching assumes stateless (invalidate on source metadata); client LocalStorage only for privacy (<500ms queries via GIN indexes, no timestamps).
- Testing: Mock Pinia in Vitest for jsdom (fetches fail without backend); Playwright headed for E2E webview restrictions; k6 for <500ms perf.