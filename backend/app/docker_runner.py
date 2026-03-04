"""
Docker runner — spins up a Patmos toolchain container,
compiles C code with patmos-clang, runs it on pasim (simulator)
and/or patemu (emulator), captures output + timing.
"""

import re
import time
import tempfile
import os
import docker
from docker.errors import ContainerError, ImageNotFound, APIError

EXECUTOR_IMAGE = "sdtime-executor:latest"

client: docker.DockerClient | None = None


def _get_client() -> docker.DockerClient:
    global client
    if client is None:
        client = docker.from_env()
    return client


def _write_code_to_tempfile(code: str) -> str:
    """Write user code to a temp file and return the path."""
    fd, path = tempfile.mkstemp(suffix=".c", prefix="patmos_")
    with os.fdopen(fd, "w") as f:
        f.write(code)
    return path


def _parse_pasim_stats(output: str) -> dict:
    """
    Parse pasim's statistics output.
    pasim prints stats to stderr like:
      Cycles: 12345
      Instructions: 9876
      ...
    """
    stats = {}

    # Cycle count
    m = re.search(r"Cycles\s*:\s*(\d+)", output)
    if m:
        stats["cycles"] = int(m.group(1))

    # Instructions
    m = re.search(r"Instructions\s*:\s*(\d+)", output)
    if m:
        stats["instructions"] = int(m.group(1))

    # Bundle count (VLIW bundles)
    m = re.search(r"Bundles\s*:\s*(\d+)", output)
    if m:
        stats["bundles"] = int(m.group(1))

    # Cache stats
    m = re.search(r"Cache Hits\s*:\s*(\d+)", output)
    if m:
        stats["cache_hits"] = int(m.group(1))

    m = re.search(r"Cache Misses\s*:\s*(\d+)", output)
    if m:
        stats["cache_misses"] = int(m.group(1))

    # Method cache
    m = re.search(r"Method Cache Hits\s*:\s*(\d+)", output)
    if m:
        stats["method_cache_hits"] = int(m.group(1))

    m = re.search(r"Method Cache Misses\s*:\s*(\d+)", output)
    if m:
        stats["method_cache_misses"] = int(m.group(1))

    # Stack cache
    m = re.search(r"Stack Cache (?:Spills|fills)\s*:\s*(\d+)", output, re.IGNORECASE)
    if m:
        stats["stack_cache_ops"] = int(m.group(1))

    return stats


def _build_compile_and_run_cmd(mode: str = "simulate") -> str:
    """
    Build the shell command that:
    1. Compiles /tmp/main.c with patmos-clang
    2. Runs the binary with pasim or patemu
    """
    compile_cmd = "patmos-clang /tmp/main.c -o /tmp/main 2>&1"

    if mode == "emulate":
        # patemu: cycle-accurate hardware emulator
        run_cmd = "patemu /tmp/main 2>&1"
    else:
        # pasim: fast instruction-set simulator with stats
        # -V  prints detailed execution statistics
        run_cmd = "pasim -V /tmp/main 2>&1"

    return f'sh -c "{compile_cmd} && echo \'===EXEC_OUTPUT_START===\' && {run_cmd} && echo \'===EXEC_OUTPUT_END===\'"'


def _build_gcc_compile_and_run_cmd() -> str:
    """
    Build the shell command for normal GCC compilation + execution.
    Used as the 'normal CPU' comparison baseline.
    """
    compile_cmd = "gcc -O2 /tmp/main.c -o /tmp/main_gcc 2>&1"
    run_cmd = "/tmp/main_gcc 2>&1"
    return f'sh -c "{compile_cmd} && {run_cmd}"'


def run_on_patmos(
    code: str,
    mode: str = "simulate",
    timeout: int = 30,
) -> dict:
    """
    Compile and run C code on the Patmos toolchain inside a Docker container.

    Args:
        code: C source code
        mode: "simulate" (pasim, fast) or "emulate" (patemu, cycle-accurate)
        timeout: max seconds before killing container

    Returns:
        dict with success, stdout, stderr, exit_code, stats, container_time_ms
    """
    dk = _get_client()

    # Escape code for shell injection safety
    escaped = code.replace("'", "'\\''")

    # Write code into container, compile with patmos-clang, run with pasim/patemu
    write_cmd = f"echo '{escaped}' > /tmp/main.c"
    compile_run_cmd = _build_compile_and_run_cmd(mode)

    # Combined command
    full_cmd = f"sh -c \"{write_cmd} && {compile_run_cmd[6:-1]}\""

    # Simpler: use a single sh -c with heredoc-style
    full_cmd = (
        "sh -c \""
        f"echo '{escaped}' > /tmp/main.c && "
        "patmos-clang /tmp/main.c -o /tmp/main 2>/tmp/compile_err && "
        "echo '===COMPILE_OK===' && "
    )

    if mode == "emulate":
        full_cmd += "patemu /tmp/main 2>/tmp/run_stats; "
    else:
        full_cmd += "pasim -V /tmp/main 2>/tmp/run_stats; "

    full_cmd += (
        "echo '===PROGRAM_OUTPUT_END==='; "
        "echo '===STATS_START==='; "
        "cat /tmp/run_stats; "
        "echo '===STATS_END==='; "
        "cat /tmp/compile_err\""
    )

    try:
        t0 = time.perf_counter()
        container_output = dk.containers.run(
            image=EXECUTOR_IMAGE,
            command=full_cmd,
            remove=True,
            network_disabled=True,
            mem_limit="256m",
            cpu_period=100_000,
            cpu_quota=80_000,       # 80% of one core
            stderr=True,
            stdout=True,
            detach=False,
            timeout=timeout,
        )
        elapsed = (time.perf_counter() - t0) * 1000
        raw = container_output.decode("utf-8") if isinstance(container_output, bytes) else str(container_output)

        # Parse sections
        compile_ok = "===COMPILE_OK===" in raw
        program_output = ""
        stats_text = ""

        if "===COMPILE_OK===" in raw:
            after_compile = raw.split("===COMPILE_OK===", 1)[1]

            if "===PROGRAM_OUTPUT_END===" in after_compile:
                program_output = after_compile.split("===PROGRAM_OUTPUT_END===", 1)[0].strip()

            if "===STATS_START===" in raw and "===STATS_END===" in raw:
                stats_text = raw.split("===STATS_START===", 1)[1].split("===STATS_END===", 1)[0].strip()
        else:
            # Compilation failed
            program_output = ""
            stats_text = ""

        # Parse stats from pasim/patemu output
        stats = _parse_pasim_stats(stats_text) if stats_text else {}

        # If pasim stats are in program_output (pasim -V prints to stderr which we redirect)
        if not stats and program_output:
            stats = _parse_pasim_stats(program_output)

        return {
            "success": compile_ok,
            "stdout": program_output,
            "stderr": raw if not compile_ok else None,
            "exit_code": 0 if compile_ok else 1,
            "container_time_ms": round(elapsed, 2),
            "stats": stats,
            "stats_raw": stats_text,
            "mode": mode,
        }

    except ContainerError as e:
        stderr_text = e.stderr.decode("utf-8") if e.stderr else str(e)
        return {
            "success": False,
            "stdout": "",
            "stderr": stderr_text,
            "exit_code": e.exit_status,
            "container_time_ms": 0,
            "stats": {},
            "stats_raw": "",
            "mode": mode,
        }
    except ImageNotFound:
        return {
            "success": False,
            "stdout": "",
            "stderr": (
                f"Executor image '{EXECUTOR_IMAGE}' not found. "
                "Run: docker compose build executor"
            ),
            "exit_code": 1,
            "container_time_ms": 0,
            "stats": {},
            "stats_raw": "",
            "mode": mode,
        }
    except APIError as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": f"Docker API error: {e.explanation}",
            "exit_code": 1,
            "container_time_ms": 0,
            "stats": {},
            "stats_raw": "",
            "mode": mode,
        }


def run_on_gcc(
    code: str,
    timeout: int = 10,
) -> dict:
    """
    Compile and run C code with regular GCC as a baseline comparison.
    """
    dk = _get_client()
    escaped = code.replace("'", "'\\''")

    full_cmd = (
        "sh -c \""
        f"echo '{escaped}' > /tmp/main.c && "
        "gcc -O2 /tmp/main.c -o /tmp/main_gcc 2>/tmp/compile_err && "
        "echo '===COMPILE_OK===' && "
        "/tmp/main_gcc 2>&1; "
        "echo '===PROGRAM_OUTPUT_END==='; "
        "cat /tmp/compile_err\""
    )

    try:
        t0 = time.perf_counter()
        container_output = dk.containers.run(
            image=EXECUTOR_IMAGE,
            command=full_cmd,
            remove=True,
            network_disabled=True,
            mem_limit="128m",
            cpu_period=100_000,
            cpu_quota=50_000,
            stderr=True,
            stdout=True,
            detach=False,
            timeout=timeout,
        )
        elapsed = (time.perf_counter() - t0) * 1000
        raw = container_output.decode("utf-8") if isinstance(container_output, bytes) else str(container_output)

        compile_ok = "===COMPILE_OK===" in raw
        program_output = ""

        if compile_ok:
            after_compile = raw.split("===COMPILE_OK===", 1)[1]
            if "===PROGRAM_OUTPUT_END===" in after_compile:
                program_output = after_compile.split("===PROGRAM_OUTPUT_END===", 1)[0].strip()

        return {
            "success": compile_ok,
            "stdout": program_output,
            "stderr": raw if not compile_ok else None,
            "exit_code": 0 if compile_ok else 1,
            "container_time_ms": round(elapsed, 2),
        }

    except ContainerError as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": e.stderr.decode("utf-8") if e.stderr else str(e),
            "exit_code": e.exit_status,
            "container_time_ms": 0,
        }
    except (ImageNotFound, APIError) as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": str(e),
            "exit_code": 1,
            "container_time_ms": 0,
        }
