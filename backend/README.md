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
- **SQLAlchemy** (async) - Database ORM
- **PostgreSQL** - Primary database
- **Redis** - Caching layer
- **Pydantic** - Data validation and serialization
- **uvicorn** - ASGI server

## Prerequisites

- Python 3.9+
- PostgreSQL 12+
- Redis (optional, for caching)
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

### 4. Database Setup
Ensure PostgreSQL is running and create the database:
```bash
# Run from project root
cd ../database
./setup.sh
```

### 5. Environment Configuration
Copy the example environment file and configure:
```bash
cp .env.example .env
```

Edit `.env` with your local settings:
```env
DATABASE_URL=postgresql://tinker_user:dev_password@localhost:5432/tinkertools
CORS_ORIGINS=http://localhost:5173
APP_ENV=development
LOG_LEVEL=INFO
REDIS_URL=redis://localhost:6379/0
```

### 6. Import Game Data
Import the game data using the CLI tool:
```bash
python import_cli.py --items items.json --nanos nanos.json --symbiants symbiants.csv
```

### 7. Start Development Server
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- **API Base URL**: http://localhost:8000
- **Interactive Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

### Core Resources
- `GET /api/v1/items` - Search and filter items
- `GET /api/v1/nanos` - Nano program database
- `GET /api/v1/spells` - Spell and nano data
- `GET /api/v1/symbiants` - Symbiant database
- `GET /api/v1/pocket-bosses` - Pocket boss information
- `GET /api/v1/stat-values` - Game statistics reference

### System Endpoints
- `GET /health` - Health check
- `GET /api/v1/cache/stats` - Cache statistics
- `GET /api/v1/performance/stats` - Performance metrics

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

### Migrations (Alembic)
```bash
# Generate migration
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head

# View migration history
alembic history
```

### Manual Database Operations
```bash
# Connect to database
psql -U tinker_user -d tinkertools

# Run schema tests
psql -U tinker_user -d tinkertools -f ../database/tests/test_schema.sql
```

## Performance Considerations

### Query Optimization
- Complex stat queries target: < 500ms
- All endpoints use proper database indexes
- Async SQLAlchemy for concurrent request handling

### Caching Strategy
- Redis for frequently accessed data
- Application-level caching for static game data
- Cache invalidation on data updates

### Resource Limits
- Connection pooling configured for production load
- Async I/O for database operations
- Proper error handling and timeouts

## Configuration

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `CORS_ORIGINS` - Allowed frontend origins
- `APP_ENV` - Environment (development/production)
- `LOG_LEVEL` - Logging level (DEBUG/INFO/WARNING/ERROR)
- `REDIS_URL` - Redis connection string

### Application Settings
Configuration is managed through `app/core/config.py` using Pydantic Settings.

## Production Deployment

### Docker Support
```bash
# Build image
docker build -t tinkertools-api .

# Run container
docker run -p 8000:8000 tinkertools-api
```

### Manual Deployment
```bash
# Install production dependencies
pip install -r requirements.txt

# Run with Gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

## Monitoring and Observability

### Health Checks
- `GET /health` - Basic health status
- `GET /api/v1/performance/stats` - Detailed performance metrics

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

### Legacy Compatibility
- Database schema matches existing Django model structure
- Maintains compatibility with existing data exports
- Supports gradual migration from legacy systems

## Troubleshooting

### Common Issues

**Database Connection Errors**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Verify database exists
psql -U postgres -l | grep tinkertools
```

**Import Errors**
```bash
# Check data file format
head -n 5 items.json

# Verify database schema
psql -U tinker_user -d tinkertools -c "\dt"
```

**Performance Issues**
```bash
# Check database indexes
psql -U tinker_user -d tinkertools -c "\di"

# Monitor query performance
tail -f /var/log/postgresql/postgresql.log
```

For additional help, check the main project documentation in `../docs/` or the issue tracker.