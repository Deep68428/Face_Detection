"""
Runtime Configuration Settings
"""
import threading
from pathlib import Path
import os

# ──────────────────────────────────────────────────────────────────────────────
# Load .env if present (so credentials stay out of source code)
# ──────────────────────────────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass  # dotenv optional

# ============================================================================
# CAMERA CONFIGURATION
# ============================================================================
CAMERAS = {}  # Will be populated dynamically from ClickHouse
# Format: {"Camera-Name": {"id": 1, "location": "73 East", "rtsp_url": "rtsp://..."}}

# ============================================================================
# CLICKHOUSE CONNECTION  (reads from .env or falls back to defaults)
# ============================================================================
CLICKHOUSE_HOST     = os.getenv("CLICKHOUSE_HOST", "216.48.180.4")
CLICKHOUSE_PORT     = int(os.getenv("CLICKHOUSE_PORT", "8123"))
CLICKHOUSE_USER     = os.getenv("CLICKHOUSE_USER", "ethics")
CLICKHOUSE_PASSWORD = os.getenv("CLICKHOUSE_PASSWORD", "ethics@2026")
CLICKHOUSE_DATABASE = os.getenv("CLICKHOUSE_DATABASE", "attendance_phase_1")

# ============================================================================
# MACHINE TRACKING SETTINGS
# ============================================================================
MACHINE_ID          = os.getenv("MACHINE_ID", "default-machine")
LOCATION_FILTER     = os.getenv("LOCATION_FILTER", "")


# ============================================================================
# DATABASE PATHS
# ============================================================================
BASE_DIR = Path(__file__).parent.parent
DATABASE_ROOT = BASE_DIR / "Face_Database"
FACE_DB_PATH  = BASE_DIR / "config"
LOGS_ROOT     = BASE_DIR / "Detection_Logs"
LOGS_IMAGES_ROOT = BASE_DIR / "Detection_Logs_Images"

# ============================================================================
# FACE RECOGNITION SETTINGS
# ============================================================================
CROP_SCALE           = 1.7
SIMILARITY_THRESHOLD = 0.45 # Standard default
COOLDOWN_SECONDS     = 300
OUT_GAP_SECONDS      = 300

# Dynamic Settings Refresh
def refresh_dynamic_settings(client):
    global SIMILARITY_THRESHOLD
    if not client: return
    try:
        res = client.query("SELECT confidence_threshold FROM config_settings WHERE id = 1")
        if res and res.result_rows:
            # Convert percentage (75) to float (0.75)
            SIMILARITY_THRESHOLD = float(res.result_rows[0][0]) / 100.0
            print(f"🔄 AI Similarity Threshold updated from DB: {SIMILARITY_THRESHOLD}")
    except Exception: pass

# ============================================================================
# DISPLAY SETTINGS
# ============================================================================
DISPLAY_DURATION = 3.0
SHOW_WINDOWS     = True

# ============================================================================
# STREAM SETTINGS
# ============================================================================
MAX_RETRIES           = 5
RETRY_DELAY           = 3
PROCESS_EVERY_N_FRAMES = 40

# ============================================================================
# IMAGE SAVING
# ============================================================================
SAVE_DETECTED_FACES   = True
MIN_CONFIDENCE_TO_SAVE = 0.7

# ============================================================================
# RUNTIME VARIABLES (Auto-initialized)
# ============================================================================
CURRENT_DATE_FOLDER = None
CURRENT_DATE_STR    = None
DAILY_EXCEL_FILE    = None

# ============================================================================
# THREAD SAFETY
# ============================================================================
excel_write_lock  = threading.Lock()
frame_data_lock   = threading.Lock()
detections_lock   = threading.Lock()

# ============================================================================
# SHARED DATA STRUCTURES
# ============================================================================
frame_data          = {}   # {camera_name: {frame, faces, recognized_faces, timestamp}}
recent_detections   = {}   # {camera_name: [{name, time, timestamp}]}
last_detection_time = {}   # {name_camera: datetime}
