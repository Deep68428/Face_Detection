from pydantic import BaseModel
from typing import Literal
from datetime import date


class EmployeeBase(BaseModel):
    name: str
    department: str


class EmployeeCreate(EmployeeBase):
    code: str = ""  # auto-generated if empty


class EmployeeUpdate(BaseModel):
    name: str
    department: str


class Employee(EmployeeBase):
    code: str
    face_status: Literal["Mapped", "Unmapped"] = "Unmapped"
    avatar: str
    movements_today: int = 0
    created_at: str

    class Config:
        from_attributes = True
