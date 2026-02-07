from pydantic import BaseModel, Field
from typing import Optional


class ExecuteRequest(BaseModel):
    code: str = Field(..., description="Source code to execute")
    language: str = Field(default="c", description="Language: c | python")
    timeout: int = Field(default=10, ge=1, le=30, description="Max seconds")


class TimingInfo(BaseModel):
    wall_time_ms: float
    container_time_ms: float


class ExecuteResponse(BaseModel):
    success: bool
    output: str
    error: Optional[str] = None
    exit_code: int
    timing: TimingInfo
