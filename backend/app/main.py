from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import dashboard, cameras, employees, movement_logs, face_mapping, users, reports, settings as settings_router, detections
from app.routers import auth
from app.routers import image_proxy
from fastapi.staticfiles import StaticFiles
import os

settings = get_settings()

app = FastAPI(
    title="Attendance System API",
    description="FastAPI backend for employee attendance tracking with ClickHouse analytics",
    version="1.0.0",
)

# CORS — allow all for development/reliability
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auth (no prefix in router, prefix defined inside auth.py as /auth) ──────
app.include_router(auth.router)

# ── Business routers ─────────────────────────────────────────────────────────
app.include_router(dashboard.router)
app.include_router(cameras.router)
app.include_router(employees.router)
app.include_router(movement_logs.router)
app.include_router(face_mapping.router)
app.include_router(users.router)
app.include_router(reports.router)
app.include_router(settings_router.router)
app.include_router(detections.router)
app.include_router(image_proxy.router)

# Mapping the AI Face_Database folder to /api/images/detections
FACE_DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../Machine_code/Face_Database"))
os.makedirs(FACE_DB_PATH, exist_ok=True)
app.mount("/api/images/detections", StaticFiles(directory=FACE_DB_PATH), name="detections")
print(f"✅ Mounted detection images from {FACE_DB_PATH}")


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "attendance-api", "db": settings.clickhouse_database}


@app.get("/")
def root():
    return {
        "message": "Attendance System API",
        "docs": "/docs",
        "redoc": "/redoc",
    }
