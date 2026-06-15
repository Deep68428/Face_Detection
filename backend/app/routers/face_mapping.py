from fastapi import APIRouter, HTTPException
from app.database import query, execute, insert_rows
from app.models.face_mapping import AssignFaceRequest, CreateEmployeeAndAssignRequest
from datetime import datetime
import os
import shutil
import subprocess
import sys
from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.config import get_settings

settings = get_settings()

# Paths for image processing - correctly pathing up from app/routers to project root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
FACE_DB_PATH = os.path.join(BASE_DIR, "Machine_code/Face_Database")
DATASET_PATH = os.path.join(BASE_DIR, "Machine_code/dataset")
TOTAL_DATABASE_PATH = os.path.join(BASE_DIR, "Machine_code/config/dec25_jan26/Total_Database")

def trigger_create_embeddings():
    """Trigger the create_embeddings.py script in the background."""
    script_path = os.path.join(BASE_DIR, "Machine_code/core/create_embeddings.py")
    
    # Check if already running to avoid resource contention
    try:
        # pgrep -f checks the full command line
        subprocess.check_output(["pgrep", "-f", "create_embeddings.py"])
        print("Embeddings update already in progress, skipping trigger.")
        return
    except subprocess.CalledProcessError:
        # pgrep returns non-zero if no process matches
        pass

    try:
        # Use the python executable from the AI engine's virtualenv to ensure dependencies are met
        ai_venv_python = os.path.join(BASE_DIR, ".venv/bin/python")
        if not os.path.exists(ai_venv_python):
            ai_venv_python = sys.executable # Fallback
            
        # Using subprocess.Popen to not block the main process
        subprocess.Popen([ai_venv_python, script_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"Successfully triggered embeddings update: {script_path}")
    except Exception as e:
        print(f"Error triggering embeddings: {e}")

def get_best_face_id(face_ids: list[str]):
    """This function is no longer used as we now copy all selected faces."""
    return face_ids[0] if face_ids else None

def copy_face_to_total_database(face_id: str, emp_name: str):
    """Copy all related face images for a face_id to the Total_Database folder."""
    try:
        rows = query(f"SELECT image_path FROM face_mappings WHERE face_id = '{face_id}'")
        if not rows or not rows[0].get("image_path"):
            return
        
        main_image_path = rows[0]["image_path"]
        src_main_path = os.path.join(FACE_DB_PATH, main_image_path)
        
        if not os.path.exists(src_main_path):
            return

        # Create destination folder: Total_Database/emp_name
        # Using emp_name directly as per existing structure
        dest_folder = os.path.join(TOTAL_DATABASE_PATH, emp_name)
        os.makedirs(dest_folder, exist_ok=True)
        
        # Extract date from image_path (e.g., "06_05_2026/...")
        date_part = main_image_path.split('/')[0]
        try:
            date_obj = datetime.strptime(date_part, "%d_%m_%Y")
            formatted_date = date_obj.strftime("%Y%m%d")
        except:
            formatted_date = datetime.now().strftime("%Y%m%d")

        # Clean name for filename
        clean_name = emp_name.replace(" ", "_")
        ext = os.path.splitext(main_image_path)[1]

        # 1. Collect all related images from the same detection session
        import re
        all_related = []
        parent_dir = os.path.dirname(src_main_path)
        if os.path.exists(parent_dir):
            for filename in os.listdir(parent_dir):
                if filename.startswith(face_id):
                    # Extract confidence from filename (e.g., "..._conf0.85.jpg")
                    match = re.search(r"conf(\d+\.\d+)", filename)
                    conf = float(match.group(1)) if match else 0.0
                    all_related.append({"name": filename, "conf": conf})

        # 2. Sort by confidence descending to get the "clear and perfect" ones
        # and take the top 5 images
        best_files = sorted(all_related, key=lambda x: x["conf"], reverse=True)[:5]
        
        # Clean name for filename
        clean_name = emp_name.replace(" ", "_")
        
        # 3. Copy and rename the best 5 images
        # Extract time from face_id (usually Unknown_HHMMSS_...) to make filename unique
        time_part = "000000"
        time_match = re.search(r"_(\d{6})_", face_id)
        if time_match:
            time_part = time_match.group(1)
        
        count = 0
        for i, file_info in enumerate(best_files):
            filename = file_info["name"]
            src_path = os.path.join(parent_dir, filename)
            ext = os.path.splitext(filename)[1]
            
            # Use 'main' for the very best one, index for others
            suffix = "main" if i == 0 else str(i)
            # Format: Name_YYYYMMDD_HHMMSS_suffix.ext
            new_name = f"{clean_name}_{formatted_date}_{time_part}_{suffix}{ext}"
            
            shutil.copy2(src_path, os.path.join(dest_folder, new_name))
            count += 1
            
        print(f"Copied top {count} 'clear and perfect' images for {emp_name} (Best confidence: {best_files[0]['conf'] if best_files else 'N/A'})")

    except Exception as e:
        print(f"Error copying faces to database: {e}")

def copy_face_to_dataset(face_id: str, emp_code: str, emp_name: str):
    """Legacy function, redirected to the new database logic."""
    copy_face_to_total_database(face_id, emp_name)

router = APIRouter(prefix="/api/face-mapping", tags=["face-mapping"])


@router.get("/mapped")
def get_mapped(search: str = None):
    """Return all employees with face_status = 'Mapped'."""
    where_clause = "e.face_status = 'Mapped'"
    params = {}
    if search:
        where_clause += " AND (e.name ILIKE {search:String} OR e.code ILIKE {search:String})"
        params["search"] = f"%{search}%"

    rows = query(
        f"""
        SELECT
            e.code,
            e.name,
            e.department AS dept,
            count(DISTINCT fm.face_id) AS images,
            max(ml.timestamp) AS last_seen_ts
        FROM employees e
        LEFT JOIN face_mappings fm ON fm.emp_code = e.code
        LEFT JOIN movement_logs ml ON ml.emp_name = e.name
        WHERE {where_clause}
        GROUP BY e.code, e.name, e.department
        ORDER BY last_seen_ts DESC, e.code ASC
        """,
        params
    )
    result = []
    for r in rows:
        ts = r.get("last_seen_ts")
        if ts and getattr(ts, 'year', 1970) > 1970:
            if hasattr(ts, "strftime"):
                last_seen = ts.strftime("%d/%m/%Y %H:%M:%S")
            else:
                last_seen = str(ts)
        else:
            last_seen = "Never"
        
        result.append({
            "code": r["code"],
            "name": r["name"],
            "dept": r["dept"],
            "images": r["images"],
            "last_seen": last_seen,
        })
    return result


@router.get("/unmapped")
def get_unmapped(page: int = 1, page_size: int = 10, date: str = None, search: str = None):
    """Return face detections not yet assigned to any employee."""
    offset = (page - 1) * page_size
    where_clause = "status != 'Assigned'"
    params = {}
    
    if date:
        where_clause += " AND detected_at = {date:String}"
        params["date"] = date
    if search:
        where_clause += " AND (face_id ILIKE {search:String} OR emp_name ILIKE {search:String})"
        params["search"] = f"%{search}%"

    rows = query(
        f"SELECT * FROM face_mappings WHERE {where_clause} ORDER BY detected_at DESC, detected_time DESC, created_at DESC LIMIT {page_size} OFFSET {offset}",
        params
    )
    
    total_rows = query(f"SELECT count() as cnt FROM face_mappings WHERE {where_clause}", params)
    total = total_rows[0]["cnt"] if total_rows else 0
    
    items = [
        {
            "id": r["face_id"],
            "detected_at": r["detected_at"],
            "time": r["detected_time"],
            "confidence": r["confidence"],
            "status": r["status"],
            "image_url": settings.resolve_image_url(r.get("image_path")),
        }
        for r in rows
    ]
    
    return {"items": items, "total": total}


@router.get("/employee-images/{emp_code}")
def get_employee_images(emp_code: str):
    """Get all mapped face images for a specific employee."""
    rows = query(
        "SELECT face_id, image_path, confidence, detected_at FROM face_mappings WHERE emp_code = {code:String} AND status = 'Assigned'",
        {"code": emp_code}
    )
    return [
        {
            "id": r["face_id"],
            "image_url": settings.resolve_image_url(r.get("image_path")),
            "confidence": r["confidence"],
            "date": r["detected_at"]
        }
        for r in rows
    ]


@router.get("/employee-pool")
def get_employee_pool():
    """Return all employees to allow multiple face assignments per person."""
    rows = query(
        """
        SELECT e.code, e.name, e.department AS dept
        FROM employees e
        ORDER BY e.name ASC
        """
    )
    return list(rows)


@router.post("/assign")
def assign_faces(data: AssignFaceRequest, background_tasks: BackgroundTasks):
    """Assign one or more face IDs to an existing employee."""
    # Verify employee exists
    emp_rows = query("SELECT name FROM employees WHERE code = {code:String}", {"code": data.emp_code})
    if not emp_rows:
        raise HTTPException(status_code=404, detail="Employee not found")
    emp_name = emp_rows[0]["name"]

    for face_id in data.face_ids:
        # 1. Update mapping record
        execute(
            f"""
            ALTER TABLE face_mappings UPDATE
                emp_code = '{data.emp_code}',
                emp_name = '{emp_name.replace("'", "''")}',
                status = 'Assigned'
            WHERE face_id = '{face_id}'
            """
        )
        # 2. Backfill historical movement logs
        # Since emp_code is a primary key, we must move records using INSERT+DELETE
        execute(
            f"""
            INSERT INTO movement_logs (id, emp_code, emp_name, camera_name, camera_id, timestamp, direction, confidence, image_path)
            SELECT id, '{data.emp_code}', '{emp_name.replace("'", "''")}', camera_name, camera_id, timestamp, direction, confidence, image_path
            FROM movement_logs
            WHERE emp_code = '{face_id}'
            """
        )
        execute(f"ALTER TABLE movement_logs DELETE WHERE emp_code = '{face_id}'")
        
        # 3. Copy image to dataset folder
        # We only copy to Total_Database if it's the first time or we want to update.
        # But per user request, we take the "clear and perfect" one.
        pass

    # Copy ALL selected faces to the database to ensure high quality and variety
    for face_id in data.face_ids:
        copy_face_to_total_database(face_id, emp_name)

    # Trigger embedding update in background
    # background_tasks.add_task(trigger_create_embeddings)

    # Update employee face_status to Mapped
    execute(
        f"ALTER TABLE employees UPDATE face_status = 'Mapped' WHERE code = '{data.emp_code}'"
    )

    return {"assigned": len(data.face_ids), "emp_code": data.emp_code}


@router.post("/create-employee")
def create_employee_and_assign(data: CreateEmployeeAndAssignRequest, background_tasks: BackgroundTasks):
    """Create a new employee and optionally assign a face to them."""
    # Generate next employee code using max ID logic
    result = query("SELECT max(toInt32OrZero(substring(code, 4))) AS max_id FROM employees")
    max_id = result[0]["max_id"] or 0
    code = f"EMP{max_id + 1:03d}"

    parts = data.name.strip().split()
    avatar = "".join(p[0].upper() for p in parts[:2])

    insert_rows(
        "employees",
        ["code", "name", "department", "face_status", "avatar"],
        [[code, data.name, data.department, "Unmapped", avatar]],
    )

    if data.face_id:
        execute(
            f"""
            ALTER TABLE face_mappings UPDATE
                emp_code = '{code}',
                emp_name = '{data.name.replace("'", "''")}',
                status = 'Assigned'
            WHERE face_id = '{data.face_id}'
            """
        )
        # 2. Backfill historical logs
        execute(
            f"""
            INSERT INTO movement_logs (id, emp_code, emp_name, camera_name, camera_id, timestamp, direction, confidence, image_path)
            SELECT id, '{code}', '{data.name.replace("'", "''")}', camera_name, camera_id, timestamp, direction, confidence, image_path
            FROM movement_logs
            WHERE emp_code = '{data.face_id}'
            """
        )
        execute(f"ALTER TABLE movement_logs DELETE WHERE emp_code = '{data.face_id}'")
        
        # 3. Copy images to database folder
        copy_face_to_total_database(data.face_id, data.name)
        execute(f"ALTER TABLE employees UPDATE face_status = 'Mapped' WHERE code = '{code}'")
        
        # Trigger embedding update in background
        # background_tasks.add_task(trigger_create_embeddings)

    return {"code": code, "name": data.name, "face_assigned": bool(data.face_id)}


@router.post("/unassign")
def unassign_employee(emp_code: str):
    """Reset an employee's face mappings and status."""
    # 1. Reset employee status
    execute(f"ALTER TABLE employees UPDATE face_status = 'Unmapped' WHERE code = '{emp_code}'")
    
    # 2. Reset mapping records
    execute(
        f"""
        ALTER TABLE face_mappings UPDATE
            emp_code = NULL,
            emp_name = NULL,
            status = 'New'
        WHERE emp_code = '{emp_code}'
        """
    )
    
    return {"status": "success", "unassigned": emp_code}
