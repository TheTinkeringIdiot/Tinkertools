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

## Current Implementation Status

- ✅ Task 1: Project Foundation Setup - Complete
- ✅ Task 2: Database Schema Implementation - Complete
- ✅ Task 3: FastAPI Backend Core - Complete
- ✅ Task 4: Advanced Search and Filtering API - Complete
- ✅ Task 5: Data Import System - Complete
- ✅ Task 6: API Integration and Data Management - Complete
- ✅ Task 7: TinkerItems Application Implementation - Complete
- ✅ Task 8: TinkerNanos Application Implementation - Complete
- ✅ Task 9: TinkerFite Application Implementation - Complete
- ✅ Task 10: TinkerPlants Application Implementation - Complete
- ✅ Task 11: TinkerPocket Application Implementation - Complete
- ⏳ Tasks 12-18: Pending (see docs/work_plan.md for details)

### Recent Accomplishments
- **Dark Mode Consistency**: Complete refactoring of all applications to use unified surface color system
- **Component Library**: All TinkerFite, TinkerPocket, and core components now support proper light/dark themes
- **PrimeVue Integration**: Fixed global component registration and theme switching issues
- **TinkerPocket Implementation**: Complete pocket boss database, collection tracking, and symbiant lookup functionality
- **Source System**: Implemented polymorphic source tracking for item origins (crystals→nanos, future NPCs/missions/bosses)

### Application Status Summary
**Complete Applications:**
- **TinkerItems** ✅ - Item database with advanced search and filtering
- **TinkerNanos** ✅ - Nano program management with school-based organization
- **TinkerFite** ✅ - Weapon analysis with skill-based filtering and comparison
- **TinkerPlants** ✅ - Implant and symbiant planning tools
- **TinkerPocket** ✅ - Pocket boss database and collection tracking

**Remaining Work:**
- **TinkerNukes** ⏳ - Nanotechnician offensive nano specialization (Task 12)
- **Cross-Application Integration** ⏳ - Unified search and data sharing (Tasks 13-15)
- **Performance Optimization** ⏳ - Advanced caching and query optimization (Tasks 16-17)
- **Production Deployment** ⏳ - Final deployment and monitoring setup (Task 18)

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