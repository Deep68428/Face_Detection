from fastapi import APIRouter, HTTPException, Body
from app.database import query, execute, insert_rows
from app.models.employee import Employee, EmployeeCreate, EmployeeUpdate
from app.config import get_settings

settings = get_settings()

router = APIRouter(prefix="/api/employees", tags=["employees"])


def _make_avatar(name: str) -> str:
    parts = name.strip().split()
    return "".join(p[0].upper() for p in parts[:2])


def _row_to_employee(r: dict) -> dict:
    return {
        "code": r["code"],
        "name": r["name"],
        "department": r["department"],
        "face_status": r["face_status"],
        "avatar": r.get("avatar") or _make_avatar(r["name"]),
        "movements_today": r.get("movements_today", 0),
        "created_at": str(r.get("created_at", "")),
        "profile_image_url": settings.resolve_image_url(r.get("last_image")),
    }


@router.get("")
def list_employees(search: str = ""):
    sql = """
        SELECT
            e.code,
            e.name,
            e.department,
            e.face_status,
            e.avatar,
            e.created_at,
            countIf(toDate(ml.timestamp) = today()) AS movements_today,
            argMaxIf(ml.image_path, ml.timestamp, toDate(ml.timestamp) = today()) AS last_image
        FROM employees e
        LEFT JOIN movement_logs ml ON ml.emp_name = e.name
        WHERE (e.name ILIKE {search:String}
            OR e.code ILIKE {search:String}
            OR e.department ILIKE {search:String})
        GROUP BY e.code, e.name, e.department, e.face_status, e.avatar, e.created_at
        ORDER BY e.name ASC
    """
    rows = query(sql, {"search": f"%{search}%"})
    return [_row_to_employee(r) for r in rows]


@router.get("/stats")
def employee_stats():
    """
    Stats based on face_status column:
      Mapped   = has face training data in FAISS (AI can recognise them)
      Unmapped = added to DB manually, no face data yet (AI cannot recognise)
    """
    rows = query("SELECT face_status, count() AS cnt FROM employees GROUP BY face_status")
    mapped   = next((int(r["cnt"]) for r in rows if r["face_status"] == "Mapped"),   0)
    unmapped = next((int(r["cnt"]) for r in rows if r["face_status"] == "Unmapped"), 0)
    total    = mapped + unmapped

    # Also compute how many were seen TODAY (active presence)
    seen = query("SELECT count(DISTINCT emp_name) AS c FROM movement_logs WHERE toDate(timestamp) = today() AND emp_name NOT LIKE 'Unknown%'")
    seen_today = int(seen[0]["c"]) if seen else 0

    return {"mapped": mapped, "unmapped": unmapped, "total": total, "seen_today": seen_today}

@router.get("/seen-today")
def get_seen_today_list():
    """Return a list of employees detected by cameras today with total counts."""
    rows = query("""
        SELECT 
            e.code, 
            e.name, 
            e.department,
            count(ml.id) as total_detections,
            max(ml.timestamp) as last_seen
        FROM employees e
        INNER JOIN movement_logs ml ON ml.emp_name = e.name
        WHERE toDate(ml.timestamp) = today()
        GROUP BY e.code, e.name, e.department
        ORDER BY last_seen DESC
    """)
    result = []
    for r in rows:
        ts = r.get("last_seen")
        if hasattr(ts, "strftime"):
            last_seen_str = ts.strftime("%H:%M")
        else:
            last_seen_str = str(ts).split(" ")[1][:5] if ts and " " in str(ts) else str(ts)
        result.append({
            "code": r["code"],
            "name": r["name"],
            "dept": r["department"],
            "last_seen": last_seen_str,
            "total_detections": r["total_detections"]
        })
    return result


@router.get("/{code}")
def get_employee(code: str):
    rows = query("SELECT * FROM employees WHERE code = {code:String}", {"code": code})
    if not rows:
        raise HTTPException(status_code=404, detail="Employee not found")
    return _row_to_employee(rows[0])


@router.post("", status_code=201)
def create_employee(data: EmployeeCreate):
    # Auto-generate code if not provided
    if not data.code:
        result = query("SELECT max(toInt32OrZero(substring(code, 4))) AS max_id FROM employees")
        n = (result[0]["max_id"] or 0) + 1
        code = f"EMP{n:03d}"
    else:
        code = data.code

    avatar = _make_avatar(data.name)
    insert_rows(
        "employees",
        ["code", "name", "department", "face_status", "avatar"],
        [[code, data.name, data.department, "Unmapped", avatar]],
    )
    rows = query("SELECT * FROM employees WHERE code = {code:String}", {"code": code})
    return _row_to_employee(rows[0])


@router.put("/{code}")
def update_employee(code: str, data: EmployeeUpdate):
    # Determine initials for avatar
    avatar = _make_avatar(data.name)
    
    # 1. Start update mutation
    # Note: mutations in ClickHouse are asynchronous by default.
    execute(
        f"""
        ALTER TABLE employees UPDATE
            name = '{data.name.replace("'", "''")}',
            department = '{data.department.replace("'", "''")}',
            avatar = '{avatar}'
        WHERE code = '{code}'
        """
    )
    
    # 2. Return the "to-be" state immediately so the UI is updated without waiting for sync
    # We fetch once just to confirm existence and get other fields (created_at, face_status)
    rows = query("SELECT * FROM employees WHERE code = {code:String}", {"code": code})
    if not rows:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    emp = rows[0]
    return {
        "code": code,
        "name": data.name,
        "department": data.department,
        "face_status": emp["face_status"],
        "avatar": avatar,
        "email": "",
        "movements_today": 0, # computed in list
        "created_at": str(emp["created_at"]),
        "profile_image_url": None
    }


@router.get("/{code}/images")
def get_employee_images(code: str):
    """Return the last 6 real detection image URLs for this employee."""
    # Look up the employee name from code first
    emp_rows = query(
        "SELECT name FROM employees WHERE code = {code:String}",
        {"code": code}
    )
    if not emp_rows:
        raise HTTPException(status_code=404, detail="Employee not found")
    emp_name = emp_rows[0]["name"]

    # Fetch last 6 distinct image paths from movement_logs for today
    img_rows = query(
        """
        SELECT ml.image_path, ml.timestamp, coalesce(nullIf(c.name, ''), nullIf(ml.camera_name, ''), 'Unknown Camera') as camera_name, ml.confidence
        FROM movement_logs ml
        LEFT JOIN cameras c ON ml.camera_id = c.id
        WHERE ml.emp_name = {name:String}
          AND toDate(ml.timestamp) = today()
          AND ml.image_path IS NOT NULL
          AND ml.image_path != ''
        ORDER BY ml.timestamp DESC
        LIMIT 6
        """,
        {"name": emp_name},
    )

    result = []
    for r in img_rows:
        ts = r.get("timestamp")
        ts_str = ts.strftime("%Y-%m-%d %H:%M:%S") if hasattr(ts, "strftime") else str(ts)
        result.append({
            "url": settings.resolve_image_url(r.get("image_path")),
            "camera": r["camera_name"],
            "timestamp": ts_str,
            "confidence": r["confidence"],
        })
    return result


@router.post("/bulk", status_code=201)
def bulk_create_employees(data: list[EmployeeCreate]):
    if not data:
        return {"created": 0}

    # Get max ID for code generation
    result = query("SELECT max(toInt32OrZero(substring(code, 4))) AS max_id FROM employees")
    current_max = result[0]["max_id"] or 0

    rows_to_insert = []
    for i, emp in enumerate(data):
        if not emp.code:
            code = f"EMP{current_max + i + 1:03d}"
        else:
            code = emp.code
        
        avatar = _make_avatar(emp.name)
        rows_to_insert.append([code, emp.name, emp.department, "Unmapped", avatar])

    if rows_to_insert:
        insert_rows(
            "employees",
            ["code", "name", "department", "face_status", "avatar"],
            rows_to_insert,
        )

    return {"created": len(rows_to_insert)}
