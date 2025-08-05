from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes.health import router as health_router

app = FastAPI(title="Tinkertools API")

# CORS
allow_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins or ["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health_router, prefix="")
