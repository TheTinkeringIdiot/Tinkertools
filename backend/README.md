# TinkerTools Backend API

FastAPI-based REST API providing game data services for the TinkerTools suite of Anarchy Online utilities.

## Overview

The TinkerTools API serves as the backend for six web-based utilities:
- **TinkerItems** - Item database and search
- **TinkerNanos** - Nano program management  
- **TinkerFite** - Weapon analysis and comparison
- **TinkerPlants** - Implant and symbiant planning
- **TinkerPocket** - Pocket boss and collection tracking
- **TinkerNukes** - Nanotechnician offensive nano specialization

## Technology Stack

- **FastAPI** - Modern Python web framework
- **SQLAlchemy** (synchronous, Core queries on the store's tables) - Database access
- **PostgreSQL** - Primary database
- **Pydantic** - Data validation and serialization
- **uvicorn** - ASGI server

## Prerequisites

- Python 3.11+
- PostgreSQL 13+
- Virtual environment tool (venv, conda, etc.)

## Local Development Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd Tinkertools/backend
```

### 2. Create Virtual Environment
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Environment Configuration
Create `backend/.env.local` (git-ignored) with your local settings:
```env
DATABASE_URL=postgresql://tinker_user:dev_password@localhost:5432/tinkertools
CORS_ORIGINS=http://localhost:5173
APP_ENV=development
LOG_LEVEL=INFO
```
Load it with `set -a && . ./.env.local && set +a`.

### 5. Import Game Data
Game data lives in the content-addressed store (schema `cas`), built from extracted client builds:
```bash
python import_cli.py import-cas --extracts-dir ~/projects/AO/extracts --workers 8
python tools/verify_cas.py --store --extracts-dir ~/projects/AO/extracts
```
The importer creates the schema, its extensions and its tables. `IMPORT_README.md` is the guide: prerequisites, verification, adding a build, the files the importer reads, legacy item ids.

### 6. Start Development Server
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- **API Base URL**: http://localhost:8000
- **Interactive Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

Every route below also exists under `/api/v1/<version>/...` (a build slug from `/versions`, or `ao` / `prk`).

### Core Resources
- `GET /api/v1/versions` - Game versions served
- `GET /api/v1/items`, `/items/search`, `/items/{aoid}` - Items
- `GET /api/v1/items/{aoid}/interpolate`, `POST /api/v1/items/batch/interpolate` - Items at a quality level
- `GET /api/v1/items/{aoid}/revisions`, `POST /api/v1/items/revisions/batch` - Item change history
- `GET /api/v1/nanos`, `/nanos/search`, `/nanos/strains`, `/nanos/profession/{id}`, `/nanos/offensive/{id}` - Nano programs
- `POST /api/v1/weapons/analyze` - Weapons a character can use
- `POST /api/v1/implants/lookup` - Implant by slot and clusters
- `GET /api/v1/symbiants`, `/symbiants/{aoid}`, `/symbiants/{aoid}/dropped-by` - Symbiants
- `GET /api/v1/mobs`, `/mobs/{id}`, `/mobs/{id}/drops` - Mobs and pocket bosses (`is_pocket_boss` filter)
- `POST /api/v1/perks/batch/lookup` - Perks by AOID

### System Endpoints
- `GET /health` - Health check
- `POST /api/v1/cache/clear` - Clear the response cache

## Architecture

Routes read the store through `app/store` (see the module docstring of `app/store/__init__.py`): a request names a build, queries start from the revisions present in that build, and items are loaded in a constant number of queries. `GET /versions` lists the store's builds; `POST /legacy-item-ids/resolve` translates internal item ids of the old database from a map the importer loads (`IMPORT_README.md`, "Legacy item ids").

## Development Commands

### Code Quality
```bash
# Format code with Black
black app/

# Sort imports
isort app/

# Lint with Ruff
ruff check app/

# Type checking (if using mypy)
mypy app/
```

### Testing
```bash
# Run tests
pytest

# Run with coverage
pytest --cov=app

# Run specific test file
pytest app/tests/test_endpoints.py
```

## Database Management

The store's tables are defined in `database/cas/*.sql` and created or upgraded by `import_cli.py import-cas`. Never `DROP SCHEMA cas`; use `import-cas --reset --yes` on a scratch schema (see `IMPORT_README.md`).

```bash
# Connect to database
psql -U tinker_user -d tinkertools
```

## Performance Considerations

- Complex stat queries target: < 500ms
- Filters run on the store's search projections (`stat_entry`, `requirement`, `effect_entry`, `atkdef_entry`), which are indexed
- Synchronous SQLAlchemy; FastAPI runs the routes in its thread pool
- In-process response cache for static game data (`app/core/cache.py`), cleared with `POST /api/v1/cache/clear`

## Configuration

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `CORS_ORIGINS` - Allowed frontend origins
- `APP_ENV` - Environment (development/production)
- `LOG_LEVEL` - Logging level (DEBUG/INFO/WARNING/ERROR)

### Application Settings
Configuration is managed through `app/core/config.py` using Pydantic Settings.

## Production Deployment

### Manual Deployment
```bash
# Install production dependencies
pip install -r requirements.txt

# Run with Gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

**Memory per worker.** Every worker is a process with a response cache of its own (`RESPONSE_CACHE_MAX_BYTES`, default 256 MB). A busy worker settles at about 130 MB when ready, plus the cache bound, plus up to 150 MB the allocator keeps: **550 MB with the default** (measured; `app/core/cache.py` has the figures). Size the host as workers x that, so `-w 4` needs 2.2 GB for the API alone, or lower the bound: 64 MB gives about 335 MB per worker. `MALLOC_ARENA_MAX=2` in the environment takes about 60 MB off each. Workers do not share cached responses, so each warms up on its own.

Replacing the production database of before the content-addressed store: `IMPORT_README.md`, "Production cutover". The deployment scripts and configuration have not been updated for it yet.

## Monitoring and Observability

### Health Checks
- `GET /health` - Basic health status

### Logging
Structured logging with configurable levels. Logs include:
- Request/response timing
- Database query performance
- Error tracking and stack traces

## Contributing

1. Follow existing code patterns and conventions
2. Write tests for new functionality
3. Use type hints consistently
4. Follow FastAPI best practices
5. Update documentation for API changes

## Architecture Notes

### Data Privacy
- All user/character data stored client-side only
- Server contains only static game reference data
- No user accounts or authentication required

## Troubleshooting

### Common Issues

**Database Connection Errors**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Verify database exists
psql -U postgres -l | grep tinkertools
```

For additional help, check the main project documentation in `../docs/` or the issue tracker.