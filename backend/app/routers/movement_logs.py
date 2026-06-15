from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from app.database import query
from app.models.movement_log import MovementLogsResponse, MovementLog
import csv
import io
from app.config import get_settings

settings = get_settings()

router = APIRouter(prefix="/api/movement-logs", tags=["movement-logs"])


def _row_to_log(r: dict) -> dict:
    image_url = settings.resolve_image_url(r.get("image_path"))
        
    ts = r.get("timestamp")
    if ts and hasattr(ts, "strftime"):
        ts_str = ts.strftime("%Y-%m-%d %H:%M:%S")
    else:
        ts_str = str(ts) if ts else None

    return {
        "id": r["id"],
        "emp_code": r["emp_code"],
        "emp_name": r["emp_name"],
        "camera_name": r["camera_name"],
        "timestamp": ts_str,
        "direction": r["direction"],
        "confidence": r["confidence"],
        "flag": None,
        "image_url": image_url,
    }


@router.get("")
def list_logs(
    search: str = "",
    date: str = "",
    camera: str = "",
    direction: str = "",
    page: int = 1,
    page_size: int = 20,
):
    conditions = ["1=1"]
    params: dict = {}

    if date:
        conditions.append("toDate(timestamp) = toDate({date:String})")
        params["date"] = date
    if camera and camera != "all":
        conditions.append("camera_id IN (SELECT id FROM cameras WHERE lower(name) LIKE {camera:String})")
        params["camera"] = f"%{camera.lower()}%"
    if direction and direction.lower() in ("in", "out"):
        conditions.append("direction = {direction:String}")
        params["direction"] = direction.upper()
    if search:
        conditions.append(
            "(lower(emp_name) LIKE {search:String} OR lower(emp_code) LIKE {search:String} OR camera_id IN (SELECT id FROM cameras WHERE lower(name) LIKE {search:String}))"
        )
        params["search"] = f"%{search.lower()}%"
    
    where = " AND ".join(conditions)
    
    total_rows = query(f"SELECT count() AS cnt FROM movement_logs WHERE {where}", params)
    total = total_rows[0]["cnt"]

    offset = (page - 1) * page_size
    
    # Fetch camera mapping once
    cams = {c["id"]: c["name"] for c in query("SELECT id, name FROM cameras")}
    
    rows = query(
        f"""
        SELECT id, emp_code, emp_name, camera_id, timestamp, direction, confidence, image_path
        FROM movement_logs
        WHERE {where} 
        ORDER BY timestamp DESC LIMIT {page_size} OFFSET {offset}
        """,
        params,
    )
    
    # Inject camera name manually
    for r in rows:
        r["camera_name"] = cams.get(r["camera_id"], "Unknown Camera")

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": [_row_to_log(r) for r in rows],
    }


@router.get("/timeline/{emp_code}")
def employee_timeline(emp_code: str, date: str = ""):
    params = {"emp_code": emp_code}
    date_filter = "AND toDate(timestamp) = toDate({date:String})" if date else "AND toDate(timestamp) = today()"
    if date:
        params["date"] = date

    # Fetch all records for the period and deduplicate consecutively in Python
    rows = query(
        f"""
        SELECT 
            id, emp_code, emp_name, camera_name, timestamp, direction, confidence, image_path
        FROM movement_logs
        WHERE emp_code = {{emp_code:String}} {date_filter} 
        ORDER BY timestamp ASC
        """,
        params,
    )
    
    # 1. Find the first 'IN' timestamp to establish start of day
    first_in_ts = None
    for r in rows:
        if r["direction"].upper() == "IN":
            first_in_ts = r["timestamp"]
            break
            
    if not first_in_ts:
        # If no IN found today, show nothing or just the records as is?
        # User says "first for IN count complasary", so if no IN, maybe empty?
        # But for now, we'll just skip the filtering if no IN exists to avoid an empty screen.
        pass
    else:
        # Filter out anything before the first IN
        rows = [r for r in rows if r["timestamp"] >= first_in_ts]

    result = []
    if not rows:
        return result

    # Simple consecutive deduplication: If same camera and direction within a short period, group them.
    # CRITICAL: We ensure the VERY FIRST 'IN' is its own entry and not grouped.
    current_group = None
    is_first_event = True
    
    for r in rows:
        log = _row_to_log(r)
        ts = r["timestamp"]
        cam = r["camera_name"]
        dir_ = r["direction"]
        
        # Grouping condition:
        # 1. Not the first event of the day
        # 2. Same camera and direction
        # We group all consecutive identical detections to keep the timeline clean
        if not is_first_event and current_group and current_group["camera_name"] == cam and current_group["direction"] == dir_:
            # Update 'last seen' and 'timestamp' to show the LATEST detection as requested
            current_group["last_seen_time"] = ts.strftime("%H:%M:%S") if hasattr(ts, "strftime") else str(ts)
            current_group["timestamp"] = ts.strftime("%Y-%m-%d %H:%M:%S") if hasattr(ts, "strftime") else str(ts)
        else:
            # New location, direction change, or first event
            log["first_seen_time"] = ts.strftime("%H:%M:%S") if hasattr(ts, "strftime") else str(ts)
            log["last_seen_time"] = log["first_seen_time"]
            current_group = log
            result.append(current_group)
            is_first_event = False
            
    # Return reversed if user prefers latest first, but keeping ASC for "first IN show" request
    return result


@router.get("/export")
def export_logs(date: str = "", camera: str = "", direction: str = ""):
    conditions = ["1=1"]
    params: dict = {}
    if date:
        conditions.append("toDate(timestamp) = toDate({date:String})")
        params["date"] = date
    if camera and camera != "all":
        conditions.append("camera_id IN (SELECT id FROM cameras WHERE lower(name) LIKE {camera:String})")
        params["camera"] = f"%{camera.lower()}%"
    if direction and direction.lower() in ("in", "out"):
        conditions.append("direction = {direction:String}")
        params["direction"] = direction.upper()

    where = " AND ".join(conditions)
    
    # Fetch camera mapping once
    cams = {c["id"]: c["name"] for c in query("SELECT id, name FROM cameras")}
    
    rows = query(
        f"""
        SELECT id, emp_code, emp_name, camera_id, timestamp, direction, confidence, image_path
        FROM movement_logs
        WHERE {where} ORDER BY timestamp DESC
        """, params
    )
    
    for r in rows:
        r["camera_name"] = cams.get(r["camera_id"], "Unknown Camera")

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["id", "emp_code", "emp_name", "camera_name", "timestamp", "direction", "confidence", "flag", "image_url"])
    writer.writeheader()
    for r in rows:
        writer.writerow(_row_to_log(r))

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=movement_logs.csv"},
    )
