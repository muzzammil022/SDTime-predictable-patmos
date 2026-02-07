"""
/api/execute — sends user code into a Linux Docker container,
runs it, and returns stdout + timing info.
"""

import time
from fastapi import APIRouter, HTTPException
from app.schemas import ExecuteRequest, ExecuteResponse, TimingInfo
from app.docker_runner import run_code_in_container

router = APIRouter(tags=["executor"])


@router.post("/execute", response_model=ExecuteResponse)
async def execute_code(req: ExecuteRequest):
    """
    Accept user code, spin up (or reuse) a Linux container,
    execute the code, and return output + timing.
    """
    if not req.code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty")

    start = time.perf_counter()
    result = run_code_in_container(req.code, req.language, timeout=req.timeout)
    wall_time = time.perf_counter() - start

    return ExecuteResponse(
        success=result["success"],
        output=result["stdout"],
        error=result.get("stderr"),
        exit_code=result["exit_code"],
        timing=TimingInfo(
            wall_time_ms=round(wall_time * 1000, 2),
            container_time_ms=result.get("container_time_ms", 0),
        ),
    )
