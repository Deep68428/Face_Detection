from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.database import query, execute, insert_rows
from app.models.camera import Camera, CameraCreate, CameraUpdate

router = APIRouter(prefix="/api/cameras", tags=["cameras"])


def _row_to_camera(r: dict) -> dict:
    last_act = r.get("actual_last_active") or r.get("last_active")
    if last_act and hasattr(last_act, "strftime"):
        last_act_str = last_act.strftime("%d/%m/%Y %H:%M:%S")
    else:
        last_act_str = str(last_act) if last_act else "Never"

    return {
        "id": r["id"],
        "name": r["name"],
        "location": r["location"],
        "status": r["status"],
        "ip": r["ip"],
        "confidence_override": r["confidence_override"],
        "priority": r["priority"],
        "work_start": r["work_start"],
        "work_end": r["work_end"],
        "last_active": last_act_str,
    }


@router.get("")
def list_cameras(search: str = ""):
    # Use a CTE to combine defined cameras with active ones from logs
    sql = """
        WITH active_cams AS (
            SELECT camera_name, max(timestamp) as last_seen
            FROM movement_logs
            GROUP BY camera_name
        )
        SELECT 
            c.id as id, 
            c.name as name, 
            c.location as location, 
            c.status as status, 
            c.ip as ip, 
            coalesce(c.confidence_override, 75) as confidence_override, 
            coalesce(c.priority, 'Medium') as priority, 
            coalesce(nullIf(c.work_start, ''), '09:00') as work_start, 
            coalesce(nullIf(c.work_end, ''), '18:00') as work_end,
            greatest(coalesce(ac.last_seen, c.last_active), c.last_active) as actual_last_active
        FROM cameras c
        LEFT JOIN active_cams ac ON ac.camera_name = c.name
    """
    params = {}
    if search:
        # Wrap the CTE results to filter them
        sql = f"SELECT * FROM ({sql}) WHERE name ILIKE {{search:String}} OR location ILIKE {{search:String}}"
        params["search"] = f"%{search}%"
        
    sql += " ORDER BY id DESC"
    rows = query(sql, params)
    return [_row_to_camera(r) for r in rows]


@router.post("", status_code=201)
def create_camera(data: CameraCreate):
    location = data.location
    
    if location == "73 East":
        result = query("SELECT max(id) AS max_id FROM cameras WHERE location = '73 East'")
        next_id = (result[0]["max_id"] or 0) + 1
    else:
        # For other offices, assign separate ranges (100, 200, 300, etc.) to keep them clean
        locations_res = query("SELECT DISTINCT location FROM cameras WHERE location != '73 East' ORDER BY location ASC")
        loc_list = [r["location"] for r in locations_res]
        if location not in loc_list:
            loc_list.append(location)
            loc_list.sort()
            
        loc_index = loc_list.index(location) + 1
        base_id = loc_index * 100
        
        result = query("SELECT max(id) AS max_id FROM cameras WHERE location = {loc:String}", {"loc": location})
        max_id = result[0]["max_id"]
        
        if max_id and max_id >= base_id:
            next_id = max_id + 1
        else:
            next_id = base_id + 1

    insert_rows(
        "cameras",
        ["id", "name", "location", "status", "ip", "confidence_override", "priority", "work_start", "work_end"],
        [[
            next_id, data.name, data.location, data.status, data.ip,
            data.confidence_override, data.priority, data.work_start, data.work_end,
        ]],
    )
    rows = query("SELECT * FROM cameras WHERE id = {id:UInt32}", {"id": next_id})
    return _row_to_camera(rows[0])


@router.put("/{camera_id}")
def update_camera(camera_id: int, data: CameraUpdate):
    # ClickHouse doesn't support UPDATE on MergeTree; we use ALTER TABLE UPDATE
    execute(
        f"""
        ALTER TABLE cameras UPDATE
            name = '{data.name}',
            location = '{data.location}',
            status = '{data.status}',
            ip = '{data.ip}',
            confidence_override = {data.confidence_override},
            priority = '{data.priority}',
            work_start = '{data.work_start}',
            work_end = '{data.work_end}'
        WHERE id = {camera_id}
        """
    )
    rows = query("SELECT * FROM cameras WHERE id = {id:UInt32}", {"id": camera_id})
    if not rows:
        raise HTTPException(status_code=404, detail="Camera not found")
    return _row_to_camera(rows[0])


@router.delete("/{camera_id}", status_code=204)
def delete_camera(camera_id: int):
    execute(f"ALTER TABLE cameras DELETE WHERE id = {camera_id}")
    return None


class CameraStatusUpdate(BaseModel):
    status: str

@router.patch("/{camera_name}/status")
def update_camera_status(camera_name: str, data: CameraStatusUpdate):
    execute(
        f"""
        ALTER TABLE cameras UPDATE
            status = '{data.status}',
            last_active = now()
        WHERE name = '{camera_name}'
        """
    )
    return {"message": f"Camera {camera_name} status updated to {data.status}"}
