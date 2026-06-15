from pydantic import BaseModel
from typing import Literal, Optional


class MovementLog(BaseModel):
    id: int
    emp_code: str
    emp_name: str
    camera_name: str
    timestamp: str
    direction: Literal["IN", "OUT"]
    confidence: int
    flag: Optional[str] = None
    image_url: Optional[str] = None

    class Config:
        from_attributes = True


class MovementLogsResponse(BaseModel):
    total: int
    page: int
    page_size: int
    data: list[MovementLog]
