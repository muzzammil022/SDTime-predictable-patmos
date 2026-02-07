"""
SDTime Patmos Backend — FastAPI server that executes code
inside a containerized Linux Docker environment.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import executor, health

app = FastAPI(
    title="SDTime Patmos Backend",
    version="0.1.0",
    description="Runs user code inside a sandboxed Linux container and returns timing results.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(executor.router, prefix="/api")
