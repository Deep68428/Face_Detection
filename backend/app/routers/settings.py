from fastapi import APIRouter, HTTPException
from app.database import query, execute
from pydantic import BaseModel

router = APIRouter(prefix="/api/settings", tags=["settings"])

class SettingsUpdate(BaseModel):
    confidence_threshold: int
    start_time: str
    end_time: str
    auto_detect_unknown: bool
    real_time_processing: bool
    track_after_hours: bool

# Initial DDL to create settings table if not exists
# Using a single row with id=1 to store global settings
def init_settings_table():
    execute("""
        CREATE TABLE IF NOT EXISTS config_settings (
            id UInt8,
            confidence_threshold Int32,
            start_time String,
            end_time String,
            auto_detect_unknown UInt8,
            real_time_processing UInt8,
            track_after_hours UInt8
        ) ENGINE = MergeTree() ORDER BY id
    """)
    # Insert default if empty
    existing = query("SELECT id FROM config_settings WHERE id = 1")
    if not existing:
        execute("""
            INSERT INTO config_settings (id, confidence_threshold, start_time, end_time, auto_detect_unknown, real_time_processing, track_after_hours)
            VALUES (1, 45, '09:00', '19:00', 1, 1, 0)
        """)

@router.get("/")
def get_settings():
    init_settings_table()
    rows = query("SELECT * FROM config_settings WHERE id = 1")
    if not rows:
        return {
            "confidence_threshold": 75,
            "start_time": "09:30",
            "end_time": "19:00",
            "auto_detect_unknown": True,
            "real_time_processing": True,
            "track_after_hours": False
        }
    r = rows[0]
    return {
        "confidence_threshold": r["confidence_threshold"],
        "start_time": r["start_time"],
        "end_time": r["end_time"],
        "auto_detect_unknown": bool(r["auto_detect_unknown"]),
        "real_time_processing": bool(r["real_time_processing"]),
        "track_after_hours": bool(r["track_after_hours"])
    }

@router.post("/")
def update_settings(s: SettingsUpdate):
    init_settings_table()
    # ClickHouse doesn't support easy UPDATE, so we DELETE and INSERT
    execute("ALTER TABLE config_settings DELETE WHERE id = 1")
    execute(f"""
        INSERT INTO config_settings (id, confidence_threshold, start_time, end_time, auto_detect_unknown, real_time_processing, track_after_hours)
        VALUES (1, {s.confidence_threshold}, '{s.start_time}', '{s.end_time}', {int(s.auto_detect_unknown)}, {int(s.real_time_processing)}, {int(s.track_after_hours)})
    """)
    return {"message": "Settings updated successfully"}
