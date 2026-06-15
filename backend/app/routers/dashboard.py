from fastapi import APIRouter
from app.database import query
from datetime import date, timedelta
from app.config import get_settings

settings = get_settings()

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_stats():
    # Helper to get camera stats for a specific date
    def get_cam_stats(d_str):
        return query(f"""
            SELECT 
                countIf(status = 'Active') as active,
                countIf(status != 'Active') as offline
            FROM (
                SELECT name, status FROM cameras
                UNION DISTINCT
                SELECT c.name as name, 'Active' as status 
                FROM movement_logs ml
                JOIN cameras c ON ml.camera_id = c.id
                WHERE toDate(timestamp) = toDate('{d_str}')
                  AND c.name NOT IN (SELECT name FROM cameras)
            )
        """)[0]

    # Helper to get presence for a specific date (All unique people seen)
    def get_presence(d_str):
        return query(f"""
            SELECT count(DISTINCT emp_code) AS cnt 
            FROM movement_logs 
            WHERE toDate(timestamp) = toDate('{d_str}')
              AND emp_code NOT LIKE 'Unknown%'
              AND emp_code NOT LIKE 'Face_%'
              AND emp_code NOT LIKE 'UF%'
        """)[0]["cnt"]

    # Helper to get unknown faces for a specific date
    def get_unknown(d_str):
        return query(f"SELECT count() AS cnt FROM face_mappings WHERE status = 'New' AND toDate(created_at) = toDate('{d_str}')")[0]["cnt"]

    today_str = date.today().strftime("%Y-%m-%d")
    yesterday_str = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")

    # Today's Data
    total_emp = query("SELECT count() AS cnt FROM employees")[0]["cnt"]
    cam_today = get_cam_stats(today_str)
    presence_today = get_presence(today_str)
    unknown_today = get_unknown(today_str)

    # Yesterday's Data for trends
    total_emp_yesterday = query(f"SELECT count() AS cnt FROM employees WHERE toDate(created_at) < toDate('{today_str}')")[0]["cnt"]
    cam_yesterday = get_cam_stats(yesterday_str)
    presence_yesterday = get_presence(yesterday_str)
    unknown_yesterday = get_unknown(yesterday_str)

    # Calculate trends
    emp_trend = total_emp - total_emp_yesterday
    
    presence_trend_pct = 0
    if presence_yesterday > 0:
        presence_trend_pct = round(((presence_today - presence_yesterday) / presence_yesterday) * 100)
    elif presence_today > 0:
        presence_trend_pct = 100

    unknown_trend = unknown_today - unknown_yesterday

    # Calculate processing delay (how long since the last log was recorded)
    delay_row = query("SELECT dateDiff('minute', max(timestamp), now('Asia/Kolkata')) as delay FROM movement_logs")
    delay = delay_row[0]['delay'] if delay_row and delay_row[0]['delay'] is not None else 0

    return {
        "total_employees": {
            "value": total_emp,
            "trend": f"{'+' if emp_trend >= 0 else ''}{emp_trend} vs yesterday"
        },
        "active_cameras": {
            "value": cam_today["active"],
            "offline": cam_today["offline"],
            "trend": f"{cam_today['offline']} offline vs yesterday" if cam_today["offline"] > 0 else "All online"
        },
        "present_today": {
            "value": presence_today,
            "trend": f"{'+' if presence_trend_pct >= 0 else ''}{presence_trend_pct}% vs yesterday"
        },
        "unknown_faces": {
            "value": unknown_today,
            "trend": f"{'+' if unknown_trend >= 0 else ''}{unknown_trend} vs yesterday"
        },
        "processing_delay": max(0, delay)
    }


@router.get("/movement-trends")
def get_movement_trends():
    """Hourly entry/exit counts for today (Full 24h scale)."""
    rows = query(
        """
        SELECT
            toHour(timestamp) AS hour,
            countIf(direction = 'IN') AS entries,
            countIf(direction = 'OUT') AS exits
        FROM movement_logs
        WHERE toDate(timestamp) = today()
          AND emp_code NOT LIKE 'Unknown%'
          AND emp_code NOT LIKE 'Face_%'
        GROUP BY hour
        ORDER BY hour
        """
    )
    # Fill all 24 hours to keep the graph stable
    data_map = {r["hour"]: r for r in rows}
    result = []
    for h in range(24):
        label = f"{h:02d}:00"
        row = data_map.get(h, {})
        result.append({
            "time": label, 
            "entries": row.get("entries", 0), 
            "exits": row.get("exits", 0)
        })
    return result


@router.get("/camera-activity")
def get_camera_activity():
    """All cameras activity for today, including those with 0 detections."""
    rows = query(
        """
        WITH all_cams AS (
            SELECT id, name FROM cameras
        )
        SELECT
            ac.name AS camera,
            count(ml.id) AS activity
        FROM all_cams ac
        LEFT JOIN movement_logs ml 
            ON ml.camera_id = ac.id 
            AND toDate(ml.timestamp) = today()
            AND ml.emp_code NOT LIKE 'Unknown%'
            AND ml.emp_code NOT LIKE 'Face_%'
        GROUP BY ac.name
        ORDER BY activity DESC
        """
    )
    return rows


@router.get("/recent-detections")
def get_recent_detections():
    """Last 15 employee 'IN' movements."""
    rows = query(
        """
        SELECT
            ml.id,
            ml.emp_name AS name,
            coalesce(nullIf(c.name, ''), nullIf(ml.camera_name, ''), 'Unknown Camera') AS camera,
            ml.direction,
            formatDateTime(ml.timestamp, '%Y-%m-%d %H:%i:%S') AS timestamp_str,
            ml.image_path,
            ml.confidence
        FROM movement_logs ml
        LEFT JOIN cameras c ON ml.camera_id = c.id
        WHERE ml.emp_name NOT LIKE 'Unknown%'
          AND ml.emp_name NOT LIKE 'Face_%'
          AND ml.emp_code NOT LIKE 'Unknown%'
          AND ml.emp_code NOT LIKE 'Face_%'
        ORDER BY ml.timestamp DESC
        LIMIT 15
        """
    )
    return [
        {
            "id": r["id"],
            "name": r["name"],
            "camera": r["camera"],
            "direction": r["direction"],
            "timestamp": r["timestamp_str"],
            "image_url": settings.resolve_image_url(r.get("image_path")),
            "confidence": r["confidence"],
        }
        for r in rows
    ]


@router.get("/present-list")
def get_present_list():
    """List of employees who have checked in today."""
    rows = query(
        """
        SELECT DISTINCT emp_code, emp_name 
        FROM movement_logs 
        WHERE toDate(timestamp) = today() 
          AND emp_code NOT LIKE 'Unknown%'
          AND emp_code NOT LIKE 'Face_%'
        ORDER BY emp_name ASC
        """
    )
    return rows


@router.get("/camera-feeds")
def get_camera_feeds():
    """Live camera metadata for dashboard feed cards."""
    rows = query(
        """
        WITH all_cams AS (
            SELECT id, name, status FROM cameras
        )
        SELECT
            ac.name,
            ac.status,
            countIf(ml.id > 0) AS people,
            argMax(ml.image_path, ml.timestamp) AS last_image
        FROM all_cams ac
        LEFT JOIN movement_logs ml
            ON ml.camera_id = ac.id
            AND toDate(ml.timestamp) = today()
            AND ml.emp_code NOT LIKE 'Unknown%'
            AND ml.emp_code NOT LIKE 'Face_%'
        GROUP BY ac.name, ac.status, ac.id
        ORDER BY ac.id DESC, ac.name ASC
        LIMIT 12
        """
    )
    return [
        {
            "name": r["name"],
            "status": r["status"].lower(),
            "people": r["people"],
            "last_image_url": settings.resolve_image_url(r.get("last_image")),
        }
        for r in rows
    ]


@router.get("/failed-detections")
def get_failed_detections():
    """Count of flagged low-confidence events in the last hour."""
    rows = query(
        """
        SELECT
            countIf(confidence < 70) AS failed,
            countIf(confidence >= 70 AND confidence < 80) AS low_confidence
        FROM movement_logs
        WHERE timestamp >= now('Asia/Kolkata') - INTERVAL 1 HOUR
        """
    )
    r = rows[0] if rows else {}
    return {"failed_detections": r.get("failed", 0), "low_confidence": r.get("low_confidence", 0)}
