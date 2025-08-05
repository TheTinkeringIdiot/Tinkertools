# Local Development Setup (Task 1)

This guide walks through getting the Task 1 foundation running locally. No servers are started automatically.

## Prerequisites
- Node.js 18+ and npm
- Python 3.11+ (recommended)
- PostgreSQL 14+ (for local dev; no schema applied in Task 1)

---

## 1) Frontend

1. Install dependencies from the repository root:
   npm install

2. Start the dev server:
   npm run dev

3. Open the app in your browser:
   http://localhost:5173

4. Type checking:
   npm run type-check

5. Lint and format:
   npm run lint
   npm run format

6. Tests:
   npm test
   npm run test:ui

---

## 2) Backend

1. Create and activate a virtual environment:
   python -m venv backend/venv
   source backend/venv/bin/activate

2. Install requirements:
   pip install -r backend/requirements.txt

3. Create a local .env from the example:
   cp backend/.env.example backend/.env

4. Run the API locally:
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

5. Health check:
   Visit http://localhost:8000/health
   Expected JSON: {"status":"ok"}

CORS is configured via CORS_ORIGINS (defaults to http://localhost:5173).

---

## 3) PostgreSQL (No DDL in Task 1)

- Create a local database and user that match backend/.env.example.
- Example async connection URL:
  postgresql+asyncpg://tinker_user:dev_password@localhost:5432/tinker_tools

- No Alembic migrations are created in Task 1; they will be initialized in Task 2.

---

## Notes

- UI uses PrimeVue (Aura theme) + TailwindCSS with postcss-nesting.
- Testing via Vitest + jsdom with a sample smoke test.
- Backend uses FastAPI with pydantic-settings and async SQLAlchemy session setup.
- Do not commit local .env or database dumps. See .gitignore for ignores.
