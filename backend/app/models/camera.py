from pydantic import BaseModel
from typing import Literal
from datetime import datetime


class CameraBase(BaseModel):
    name: str
    location: str
    status: Literal["Active", "Inactive", "Error"] = "Active"
    ip: str
    confidence_override: int = 75
    priority: Literal["High", "Medium", "Low"] = "Medium"
    work_start: str = "09:30"
    work_end: str = "19:00"


class CameraCreate(CameraBase):
    pass


class CameraUpdate(CameraBase):
    pass


class Camera(CameraBase):
    id: int
    last_active: str  # ISO string

    class Config:
        from_attributes = True
