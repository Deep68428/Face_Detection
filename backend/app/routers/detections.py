from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from datetime import datetime
from app.database import query, execute, insert_rows
import uuid

router = APIRouter(prefix="/api/detections", tags=["detections"])

class DetectionLogRequest(BaseModel):
    emp_code: str
    emp_name: str
    camera: str
    timestamp: datetime
    face_centerpoint: list[int]
    image_path: str = ""
    confidence: int = 0

@router.get("/active-mappings")
def get_active_mappings():
    """Fetch face_id -> {code, name} mappings for the AI engine."""
    sql = """
        SELECT 
            face_id, 
            emp_code, 
            emp_name 
        FROM face_mappings
        WHERE status = 'Assigned' AND emp_code IS NOT NULL AND emp_name IS NOT NULL
    """
    rows = query(sql)
    return {r["face_id"]: {"code": r["emp_code"], "name": r["emp_name"]} for r in rows}

@router.post("/log")
def log_detection(data: DetectionLogRequest):
    """
    Server-side implementation of the AI detection logging.
    Centralizes movement logic and DB updates.
    """
    # 1. Prepare data
    detection_id = str(uuid.uuid4())[:16]
    conf_score = int(data.confidence * 100) if data.confidence < 1.1 else int(data.confidence)
    
    cam_row = query("SELECT id FROM cameras WHERE name = {camera:String}", {"camera": data.camera})
    camera_id = cam_row[0]["id"] if cam_row else 0

    # 2. Raw detections table (Async or direct)
    try:
        insert_rows(
            "detections",
            ["id", "name", "camera", "camera_id", "timestamp", "face_centerpoint", "image_path", "confidence"],
            [[detection_id, data.emp_name, data.camera, camera_id, data.timestamp, str(data.face_centerpoint), data.image_path, conf_score]]
        )
    except Exception as e:
        print(f"❌ raw detections error: {e}")

    # 3. Determine direction
    cam_lower = data.camera.lower()
    direction = "OUT" if "outside-left" in cam_lower or "outside-right" in cam_lower else "IN"

    # 4. Strict First-Entry Logic
    if not data.emp_code.startswith("Unknown"):
        # Check if already seen today
        seen = query(
            "SELECT count() as cnt FROM movement_logs WHERE emp_code = {code:String} AND toDate(timestamp) = today() AND direction = 'IN'",
            {"code": data.emp_code}
        )[0]["cnt"]
        
        if seen == 0 and direction == "OUT":
            return {"status": "skipped", "reason": "Initial OUT before first IN"}

    # 5. Insert Movement Log
    try:
        log_id = int(data.timestamp.timestamp() * 1000) % (2**63)
        insert_rows(
            "movement_logs",
            ["id", "emp_code", "emp_name", "camera_name", "camera_id", "timestamp", "direction", "confidence", "image_path"],
            [[log_id, data.emp_code, data.emp_name, data.camera, camera_id, data.timestamp, direction, conf_score, data.image_path]]
        )
    except Exception as e:
        print(f"❌ movement_logs error: {e}")

    # 6. Auto-register face mapping if unknown
    if data.emp_code.startswith("Unknown") or data.emp_code.startswith("Face_"):
        exists = query("SELECT count() as cnt FROM face_mappings WHERE face_id = {id:String}", {"id": data.emp_code})[0]["cnt"]
        if exists == 0:
            insert_rows(
                "face_mappings",
                ["face_id", "emp_code", "detected_at", "detected_time", "confidence", "status", "image_path"],
                [[data.emp_code, None, data.timestamp.strftime("%Y-%m-%d"), data.timestamp.strftime("%H:%M:%S"), conf_score, 1, data.image_path]]
            )

    return {"status": "success", "direction": direction}
