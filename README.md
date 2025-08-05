# Tinkertools — Task 1: Project Foundation Setup

This repository has been initialized per the approved Architect spec for Task 1. It includes a Vue 3 + Vite + TypeScript frontend with Pinia, Vue Router, TailwindCSS, and PrimeVue (Aura theme), plus a FastAPI backend scaffold with async PostgreSQL via asyncpg and SQLAlchemy.

Key choices:
- UI: PrimeVue with Aura theme and PrimeIcons to validate component library integration quickly.
- Styling: TailwindCSS with postcss-nesting for modern CSS authoring ergonomics.
- Tooling: Vite, TypeScript strict settings, flat ESLint config (eslint-plugin-vue + typescript-eslint strictTypeChecked + stylisticTypeChecked), Prettier.
- Testing: Vitest with jsdom and @vue/test-utils; a smoke test and utility function are included.
- Backend: FastAPI app with CORS; health check route; pydantic-settings configuration; async engine/session via SQLAlchemy; declarative base ready for models.
- Database: Alembic is selected for migrations; initialization deferred to Task 2. Async PostgreSQL URL format documented.

Directory layout (Task 1):
- frontend/: Vite + Vue 3 TypeScript app, router, Pinia, Tailwind, PrimeVue, tests
- backend/: FastAPI scaffold with config, health route, async DB session/base
- database/: Placeholder README for upcoming Alembic migrations (Task 2)

## Local Development Quickstart

Frontend
1) Install dependencies at repository root:
   npm install
2) Start the frontend dev server:
   npm run dev
3) Open http://localhost:5173 in your browser.

Backend
1) Create and activate a Python virtual environment:
   python -m venv backend/venv
   source backend/venv/bin/activate
2) Install Python dependencies:
   pip install -r backend/requirements.txt
3) Create a local .env:
   cp backend/.env.example backend/.env
4) Run the API:
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
5) Health check:
   GET http://localhost:8000/health should return {"status":"ok"}.

PostgreSQL (no DDL in Task 1)
- Create a local database and user matching backend/.env.example:
  postgresql+asyncpg://tinker_user:dev_password@localhost:5432/tinker_tools
- No migrations are created in Task 1; Alembic initialization and schema will be handled in Task 2.

## NPM Scripts (root)
- dev: npm run dev:frontend
- dev:frontend: cd frontend && vite
- build: cd frontend && vite build
- preview: cd frontend && vite preview --host
- type-check: cd frontend && vue-tsc --noEmit -p tsconfig.json
- lint: cd frontend && eslint .
- format: cd frontend && prettier --write .
- test: cd frontend && vitest run
- test:ui: cd frontend && vitest

## Notes
- Servers are not started automatically by Task 1; only files and npm install are performed.
- See SETUP.md for step-by-step instructions.