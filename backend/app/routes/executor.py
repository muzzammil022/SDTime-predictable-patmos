"""
/api/execute — compiles C code with patmos-clang, runs on
pasim (simulator) and/or patemu (emulator), optionally compares
with GCC baseline.
"""

import time
from fastapi import APIRouter, HTTPException
from app.schemas import (
    ExecuteRequest,
    ExecuteResponse,
    ExecutionResult,
    PatmosStats,
)
from app.docker_runner import run_on_patmos, run_on_gcc

router = APIRouter(tags=["executor"])


def _make_execution_result(raw: dict, tool: str) -> ExecutionResult:
    """Convert raw docker_runner dict → ExecutionResult schema."""
    stats = None
    if raw.get("stats"):
        stats = PatmosStats(
            cycles=raw["stats"].get("cycles", 0),
            instructions=raw["stats"].get("instructions", 0),
            bundles=raw["stats"].get("bundles", 0),
            cache_hits=raw["stats"].get("cache_hits", 0),
            cache_misses=raw["stats"].get("cache_misses", 0),
            method_cache_hits=raw["stats"].get("method_cache_hits", 0),
            method_cache_misses=raw["stats"].get("method_cache_misses", 0),
            stack_cache_ops=raw["stats"].get("stack_cache_ops", 0),
            raw_output=raw.get("stats_raw", ""),
        )

    return ExecutionResult(
        success=raw["success"],
        output=raw.get("stdout", ""),
        error=raw.get("stderr"),
        exit_code=raw["exit_code"],
        wall_time_ms=raw.get("container_time_ms", 0),
        tool=tool,
        stats=stats,
    )


def _build_summary(
    pasim_result: ExecutionResult | None,
    patemu_result: ExecutionResult | None,
    gcc_result: ExecutionResult | None,
) -> str:
    """Build a human-readable summary of the execution."""
    lines = []

    if pasim_result and pasim_result.success and pasim_result.stats:
        s = pasim_result.stats
        lines.append(
            f"pasim: {s.cycles} cycles, {s.instructions} instructions "
            f"({pasim_result.wall_time_ms:.0f}ms wall)"
        )

    if patemu_result and patemu_result.success and patemu_result.stats:
        s = patemu_result.stats
        lines.append(
            f"patemu: {s.cycles} cycles, {s.instructions} instructions "
            f"({patemu_result.wall_time_ms:.0f}ms wall)"
        )

    if gcc_result and gcc_result.success:
        lines.append(f"gcc: completed in {gcc_result.wall_time_ms:.0f}ms wall")

    if not lines:
        return "Execution failed — check errors"

    return " | ".join(lines)


@router.post("/execute", response_model=ExecuteResponse)
async def execute_code(req: ExecuteRequest):
    """
    Compile C code with patmos-clang and run it on the Patmos toolchain.
    Supports pasim (fast simulator), patemu (hardware emulator), or both.
    """
    if not req.code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty")

    pasim_result = None
    patemu_result = None
    gcc_result = None
    overall_success = False

    # 1. Run on pasim (simulator)
    if req.mode in ("simulate", "both"):
        raw = run_on_patmos(req.code, mode="simulate", timeout=req.timeout)
        pasim_result = _make_execution_result(raw, "pasim")
        if pasim_result.success:
            overall_success = True

    # 2. Run on patemu (emulator)
    if req.mode in ("emulate", "both"):
        raw = run_on_patmos(req.code, mode="emulate", timeout=req.timeout)
        patemu_result = _make_execution_result(raw, "patemu")
        if patemu_result.success:
            overall_success = True

    # 3. Run on GCC baseline
    if req.run_gcc:
        raw = run_on_gcc(req.code, timeout=min(req.timeout, 10))
        gcc_result = _make_execution_result(raw, "gcc")

    summary = _build_summary(pasim_result, patemu_result, gcc_result)

    return ExecuteResponse(
        success=overall_success,
        code=req.code,
        mode=req.mode,
        pasim=pasim_result,
        patemu=patemu_result,
        gcc=gcc_result,
        summary=summary,
    )
