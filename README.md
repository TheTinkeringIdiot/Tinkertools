# TinkerTools

A suite of web-based utilities for Anarchy Online players, providing character planning, item research, and game database tools.

## Overview

TinkerTools is a collection of six specialized tools designed to help Anarchy Online players optimize their characters and gameplay:

- **TinkerItems** - Comprehensive item database with advanced search and filtering
- **TinkerNanos** - Nano program management and skill requirement planning
- **TinkerFite** - Weapon analysis, comparison, and damage calculations
- **TinkerPlants** - Implant and symbiant planning with visual cluster configuration
- **TinkerPocket** - Pocket boss tracking and collection management
- **TinkerNukes** - Nanotechnician offensive nano specialization planner

## Features

- **Privacy-First Design** - All character data stored locally; no accounts required
- **Real Game Data** - Complete database of items, nanos, symbiants, and NPCs
- **Modern Interface** - Responsive design with dark mode support
- **Performance Optimized** - Fast queries and instant UI updates
- **Offline Capable** - Character data accessible without server connection

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL 12+

### Frontend Development

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Run tests
npm test
```

### Backend Development

```bash
# Setup virtual environment
python -m venv backend/venv
source backend/venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Copy environment config
cp backend/.env.example backend/.env.local

# Start API server (http://localhost:8000)
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Database Setup

```bash
# Initialize database
cd database
./setup.sh

# Run schema tests
psql -U tinkertools_user -d tinkertools -f tests/test_schema.sql
```

## Tech Stack

- **Frontend**: Vue 3, TypeScript, Vite, TailwindCSS, PrimeVue (Aura theme)
- **Backend**: FastAPI, SQLAlchemy (async), Pydantic, asyncpg
- **Database**: PostgreSQL with 23 core tables for game data
- **Testing**: Vitest (frontend), pytest (backend)

## Documentation

- **[CLAUDE.md](CLAUDE.md)** - Detailed development guide and commands
- **[Requirements](docs/Requirements.md)** - Complete feature requirements (47 total)
- **[Work Plan](docs/work_plan.md)** - Implementation tasks and roadmap
- **[Database](DATABASE.md)** - Schema documentation and design
- **[API Docs](http://localhost:8000/docs)** - Interactive API documentation (when backend running)

## Architecture

This is a monorepo containing:
- `/frontend` - Vue 3 application with TypeScript
- `/backend` - FastAPI REST API with async PostgreSQL
- `/database` - Schema, migrations, and test scripts
- `/docs` - Architecture and design documentation

For detailed architecture information, see the docs folder.

## Development

See [CLAUDE.md](CLAUDE.md) for:
- Complete command reference
- Testing strategy and patterns
- Code conventions and best practices
- Performance requirements
- Database queries and optimization

## Project Status

Active development. See [docs/work_plan.md](docs/work_plan.md) for current implementation tasks and roadmap.

## License

MIT
