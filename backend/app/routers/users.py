from fastapi import APIRouter, HTTPException
from app.database import query, execute, insert_rows
from app.models.user import User, UserCreate, UserUpdate, ResetPasswordRequest
from app.core.security import get_password_hash

router = APIRouter(prefix="/api/users", tags=["users"])


def _row_to_user(r: dict) -> dict:
    return {
        "id": r["id"],
        "name": r["name"],
        "email": r.get("email", ""),  # column may not exist in all schema versions
        "role": r["role"],
        "department": r["department"],
        "status": r["status"],
        "last_login": str(r["last_login"]) if r.get("last_login") else None,
        "created_at": str(r.get("created_at", "")),
    }


@router.get("")
def list_users(search: str = ""):
    sql = "SELECT * FROM users"
    params = {}
    
    if search:
        sql += """ 
            WHERE (name ILIKE {search:String} 
               OR role ILIKE {search:String} 
               OR department ILIKE {search:String})
        """
        params["search"] = f"%{search}%"
        
    sql += " ORDER BY id"
    rows = query(sql, params)
    return [_row_to_user(r) for r in rows]


@router.post("", status_code=201)
def create_user(data: UserCreate):
    # Check duplicate name (email no longer required)
    existing = query(
        "SELECT id FROM users WHERE lower(name) = lower({name:String})",
        {"name": data.name},
    )
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    # Get the maximum numeric ID to avoid duplicates even after deletions
    result = query("SELECT max(toInt32OrZero(substring(id, 4))) AS max_id FROM users")
    n = (result[0]["max_id"] or 0) + 1
    user_id = f"USR{n:03d}"
    password_hash = get_password_hash(data.password)

    insert_rows(
        "users",
        ["id", "name", "role", "department", "status", "password_hash"],
        [[user_id, data.name, data.role, data.department, "active", password_hash]],
    )
    rows = query("SELECT * FROM users WHERE id = {id:String}", {"id": user_id})
    return _row_to_user(rows[0])


@router.put("/{user_id}")
def update_user(user_id: str, data: UserUpdate):
    # Check duplicate name for other users
    existing = query(
        "SELECT id FROM users WHERE lower(name) = lower({name:String}) AND id != {id:String}",
        {"name": data.name, "id": user_id},
    )
    if existing:
        raise HTTPException(status_code=400, detail="Username already in use")

    execute(
        f"""
        ALTER TABLE users UPDATE
            name = '{data.name}',
            role = '{data.role}',
            department = '{data.department}'
        WHERE id = '{user_id}'
        """
    )
    rows = query("SELECT * FROM users WHERE id = {id:String}", {"id": user_id})
    if not rows:
        raise HTTPException(status_code=404, detail="User not found")
    return _row_to_user(rows[0])


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: str):
    execute(f"ALTER TABLE users DELETE WHERE id = '{user_id}'")
    return None


@router.patch("/{user_id}/status")
def toggle_status(user_id: str):
    rows = query("SELECT status FROM users WHERE id = {id:String}", {"id": user_id})
    if not rows:
        raise HTTPException(status_code=404, detail="User not found")
    current = rows[0]["status"]
    new_status = "inactive" if current == "active" else "active"
    execute(f"ALTER TABLE users UPDATE status = '{new_status}' WHERE id = '{user_id}'")
    return {"id": user_id, "status": new_status}


@router.post("/{user_id}/reset-password")
def reset_password(user_id: str, data: ResetPasswordRequest):
    rows = query("SELECT id FROM users WHERE id = {id:String}", {"id": user_id})
    if not rows:
        raise HTTPException(status_code=404, detail="User not found")
    new_hash = get_password_hash(data.new_password)
    execute(f"ALTER TABLE users UPDATE password_hash = '{new_hash}' WHERE id = '{user_id}'")
    return {"message": "Password reset successfully"}
