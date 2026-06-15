from pydantic import BaseModel
from typing import Literal, Optional


class MappedEmployee(BaseModel):
    code: str
    name: str
    dept: str
    images: int
    last_seen: str


class UnmappedFace(BaseModel):
    id: str
    detected_at: str
    time: str
    confidence: int
    status: Literal["New", "Reviewed", "Assigned"] = "New"


class AssignFaceRequest(BaseModel):
    face_ids: list[str]
    emp_code: str


class CreateEmployeeAndAssignRequest(BaseModel):
    face_id: Optional[str] = None
    name: str
    department: str
