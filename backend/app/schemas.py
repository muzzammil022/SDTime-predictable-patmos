from pydantic import BaseModel, Field
from typing import Optional, Literal


class ExecuteRequest(BaseModel):
    code: str = Field(..., description="C source code to compile and run")
    mode: Literal["simulate", "emulate", "both"] = Field(
        default="simulate",
        description=(
            "simulate = pasim (fast, instruction-level), "
            "emulate = patemu (slow, cycle-accurate hardware emulation), "
            "both = run pasim + patemu and compare"
        ),
    )
    timeout: int = Field(default=30, ge=1, le=120, description="Max seconds per execution")
    run_gcc: bool = Field(default=True, description="Also run with GCC as baseline comparison")


class PatmosStats(BaseModel):
    """Statistics from pasim or patemu execution."""
    cycles: int = 0
    instructions: int = 0
    bundles: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    method_cache_hits: int = 0
    method_cache_misses: int = 0
    stack_cache_ops: int = 0
    raw_output: str = ""


class ExecutionResult(BaseModel):
    """Result of a single execution (pasim, patemu, or gcc)."""
    success: bool
    output: str
    error: Optional[str] = None
    exit_code: int
    wall_time_ms: float
    tool: str  # "pasim", "patemu", or "gcc"
    stats: Optional[PatmosStats] = None


class ExecuteResponse(BaseModel):
    success: bool
    code: str
    mode: str

    # Patmos simulator result (pasim)
    pasim: Optional[ExecutionResult] = None

    # Patmos emulator result (patemu)
    patemu: Optional[ExecutionResult] = None

    # GCC baseline result
    gcc: Optional[ExecutionResult] = None

    # Quick summary
    summary: Optional[str] = None
