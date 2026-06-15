from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from app.database import query, execute, insert_rows
from app.core.security import verify_password, create_access_token, get_password_hash

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    name: str
    password: str
    department: str = "General"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str
    user_id: str


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_user_by_name(name: str):
    """Lookup user by name (case-insensitive)."""
    rows = query(
        "SELECT * FROM users WHERE lower(name) = lower({name:String}) AND status = 'active'",
        {"name": name},
    )
    return rows[0] if rows else None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Login with name (username field) + password.
    Returns a JWT bearer token.
    """
    user = _get_user_by_name(form_data.username)
    if not user or not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect name or password",
        )

    # Update last login timestamp
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    execute(
        "ALTER TABLE users UPDATE last_login = {ts:String} WHERE id = {id:String} SETTINGS mutations_sync = 1",
        {"ts": now_str, "id": user["id"]}
    )

    token = create_access_token({
        "sub": user["id"],
        "role": user["role"],
        "name": user["name"],
    })

    return TokenResponse(
        access_token=token,
        role=user["role"],
        name=user["name"],
        user_id=user["id"],
    )


@router.post("/signup", status_code=201)
def signup(data: SignupRequest):
    """
    Register a new account using name + password (no email required).
    Role defaults to Viewer.
    """
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")

    # Check duplicate name
    existing = query(
        "SELECT id FROM users WHERE lower(name) = lower({name:String})",
        {"name": name},
    )
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    # Auto-generate user ID using max() to avoid duplicates
    result = query("SELECT max(toInt32OrZero(substring(id, 4))) AS max_id FROM users")
    n = int(result[0]["max_id"] or 0) + 1
    user_id = f"USR{n:03d}"

    password_hash = get_password_hash(data.password)

    insert_rows(
        "users",
        ["id", "name", "role", "department", "status", "password_hash"],
        [[user_id, name, "Viewer", data.department, "active", password_hash]],
    )

    return {"message": "Account created successfully", "user_id": user_id}
