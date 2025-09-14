from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.api.routes.health import router as health_router
from app.api.routes.items import router as items_router
from app.api.routes.implants import router as implants_router
from app.api.routes.nanos import router as nanos_router
from app.api.routes.spells import router as spells_router
from app.api.routes.symbiants import router as symbiants_router
from app.api.routes.pocket_bosses import router as pocket_bosses_router
from app.api.routes.stat_values import router as stat_values_router
from app.api.routes.cache import router as cache_router
from app.api.routes.performance import router as performance_router
from app.api.routes.aosetups import router as aosetups_router
from app.api.routes.equipment_bonuses import router as equipment_bonuses_router

app = FastAPI(
    title="TinkerTools API",
    description="API for TinkerTools - Anarchy Online game data utilities",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS - Allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=False,  # Set to False when using allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "code": f"HTTP_{exc.status_code}"
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation error",
            "code": "VALIDATION_ERROR",
            "details": exc.errors()
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "code": "INTERNAL_ERROR"
        }
    )

# Include routers
app.include_router(health_router, prefix="")
app.include_router(items_router, prefix="/api/v1")
app.include_router(implants_router, prefix="/api/v1")
app.include_router(nanos_router, prefix="/api/v1")
app.include_router(spells_router, prefix="/api/v1")
app.include_router(symbiants_router, prefix="/api/v1")
app.include_router(pocket_bosses_router, prefix="/api/v1")
app.include_router(stat_values_router, prefix="/api/v1")
app.include_router(cache_router, prefix="/api/v1")
app.include_router(performance_router, prefix="/api/v1")
app.include_router(aosetups_router, prefix="/api/v1")
app.include_router(equipment_bonuses_router, prefix="/api/v1")

@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "TinkerTools API",
        "version": "1.0.0",
        "documentation": "/docs",
        "health": "/health"
    }
