"""
Docker runner — spins up a lightweight Linux container,
pipes user code in, captures output.
"""

import time
import docker
from docker.errors import ContainerError, ImageNotFound, APIError

EXECUTOR_IMAGE = "sdtime-executor:latest"

client: docker.DockerClient | None = None


def _get_client() -> docker.DockerClient:
    global client
    if client is None:
        client = docker.from_env()
    return client


def run_code_in_container(
    code: str,
    language: str = "c",
    timeout: int = 10,
) -> dict:
    """
    Run `code` inside a sandboxed Linux container and return results.
    Supports C and Python.
    """
    dk = _get_client()

    if language == "c":
        # Write code → compile with gcc → run
        cmd = (
            'sh -c "'
            "echo '$CODE' > /tmp/main.c && "
            "gcc /tmp/main.c -o /tmp/main 2>&1 && "
            '/tmp/main"'
        )
        # Escape single quotes in user code
        escaped = code.replace("'", "'\\''")
        cmd = cmd.replace("$CODE", escaped)
    elif language == "python":
        escaped = code.replace("'", "'\\''")
        cmd = f"sh -c \"echo '{escaped}' > /tmp/main.py && python3 /tmp/main.py\""
    else:
        return {
            "success": False,
            "stdout": "",
            "stderr": f"Unsupported language: {language}",
            "exit_code": 1,
            "container_time_ms": 0,
        }

    try:
        t0 = time.perf_counter()
        container = dk.containers.run(
            image=EXECUTOR_IMAGE,
            command=cmd,
            remove=True,
            network_disabled=True,     # sandbox: no network
            mem_limit="128m",          # cap memory
            cpu_period=100_000,
            cpu_quota=50_000,          # 50 % of one core
            stderr=True,
            stdout=True,
            detach=False,
            timeout=timeout,
        )
        elapsed = (time.perf_counter() - t0) * 1000
        output = container.decode("utf-8") if isinstance(container, bytes) else str(container)

        return {
            "success": True,
            "stdout": output,
            "stderr": None,
            "exit_code": 0,
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
        }
    except APIError as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": f"Docker API error: {e.explanation}",
            "exit_code": 1,
            "container_time_ms": 0,
        }
