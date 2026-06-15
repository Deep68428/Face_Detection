from pydantic import BaseModel
from typing import Literal, Optional


class UserBase(BaseModel):
    name: str
    role: Literal["Super Admin", "Admin", "Viewer"]
    department: str


class UserCreate(UserBase):
    password: str


class UserUpdate(UserBase):
    pass


class ResetPasswordRequest(BaseModel):
    new_password: str


class User(UserBase):
    id: str
    status: Literal["active", "inactive"] = "active"
    last_login: Optional[str] = None
    created_at: str

    class Config:
        from_attributes = True
