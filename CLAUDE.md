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
backend\venv\Scripts\activate     # Windows

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

Claude Code uses `backend/.env.claude` for sensitive configuration values. This file:
- Contains actual database credentials and paths needed for development
- Is excluded from git tracking via `.gitignore` 
- Should NEVER be committed to the repository

**Usage for Claude Code:**
- Always use the virtual environment at `backend/venv` for Python operations
- Use the DATABASE_URL from `.env.claude` for database connections
- Load environment from `.env.claude` when running backend commands

**Security Notes:**
- The `.env.claude` file contains real credentials and must never be committed
- Multiple layers of protection are in place:
  - `.gitignore` excludes all `.env.claude*` files
  - Pre-commit checks can validate no secrets are being committed
  - Clear documentation prevents accidental inclusion

**Example backend startup command:**
```bash
# Load environment from .env.claude and start backend
cd backend && source venv/bin/activate && \
export $(cat .env.claude | xargs) && \
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
- Server contains only game reference data
- No user accounts or authentication required

## Important Project Decisions

1. **Monorepo Structure**: Frontend and backend in single repository for easier development
2. **Direct Deployment**: No containerization initially (can add Docker later if needed)
3. **Client-Side User Data**: Privacy-first approach with no server-side user data
4. **Legacy Data Compatibility**: Schema designed to match existing Django model structure
5. **TypeScript Strict Mode**: Enforced for better type safety and maintainability

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
- Unit tests: Minimum 80% coverage
- Integration tests: All API endpoints
- E2E tests: Critical user workflows
- Performance tests: Query optimization validation

## Resources

- **Requirements**: docs/Requirements.md (47 total requirements)
- **Work Plan**: docs/work_plan.md (18 implementation tasks)
- **Database Documentation**: DATABASE.md
- **Architecture Documents**: docs/ folder
- **API Documentation**: Available at http://localhost:8000/docs when backend is running
- You are able to use Playwright MCP server to evaluate the application in a web browser