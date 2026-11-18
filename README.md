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
- PostgreSQL 13+

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

# Create backend/.env.local with DATABASE_URL (see backend/README.md)

# Start API server (http://localhost:8000)
cd backend
set -a && . ./.env.local && set +a
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Database Setup

```bash
# Load the game data from extracted client builds (see backend/IMPORT_README.md)
cd backend
python import_cli.py import-cas --extracts-dir ~/projects/AO/extracts --workers 8
```

## Production

```bash
cp .env.example .env          # set POSTGRES_PASSWORD
docker compose up -d --build  # db, api and web; the site is on http://localhost:8088
scripts/deploy/stack.sh restore tinkertools-store.dump   # load the game data from a dump
```

Three containers (`docker-compose.yml`): PostgreSQL, the API under gunicorn, and Caddy serving the built frontend and proxying `/api`. The server's database is restored from a dump of the development store rather than imported. [DEPLOYMENT.md](DEPLOYMENT.md) is the guide: settings, the dump and restore procedure, and the steps to deploy with Coolify.

## Tech Stack

- **Frontend**: Vue 3, TypeScript, Vite, TailwindCSS, PrimeVue (Aura theme)
- **Backend**: FastAPI, SQLAlchemy Core, Pydantic, psycopg
- **Database**: PostgreSQL, game data in a content-addressed store (schema `cas`)
- **Testing**: Vitest (frontend), pytest (backend)

## Documentation

- **[CLAUDE.md](CLAUDE.md)** - Detailed development guide and commands
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - The container stack, loading a server's data, Coolify
- **[Requirements](docs/Requirements.md)** - Complete feature requirements (47 total)
- **[Work Plan](docs/work_plan.md)** - Implementation tasks and roadmap
- **[Database](DATABASE.md)** - Schema documentation and design
- **[API Docs](http://localhost:8000/docs)** - Interactive API documentation (when backend running)

## Architecture

This is a monorepo containing:
- `/frontend` - Vue 3 application with TypeScript
- `/backend` - FastAPI REST API, the importer and the store's schema (`backend/database/cas/`)
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
