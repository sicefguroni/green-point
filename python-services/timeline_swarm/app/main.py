from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from .models import (
    TimelineApproveRequest,
    TimelineApproveResponse,
    TimelineGenerateRequest,
    TimelineGenerateResponse,
)
from .swarm import approve_timeline, initialize_swarm, shutdown_swarm, start_timeline


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_swarm()
    try:
        yield
    finally:
        shutdown_swarm()


app = FastAPI(title="GreenPoint Timeline Swarm", version="0.1.0", lifespan=lifespan)


@app.get("/health")
def healthcheck():
    return {"status": "ok"}


@app.post("/timeline/generate", response_model=TimelineGenerateResponse)
def generate_timeline(payload: TimelineGenerateRequest):
    record = start_timeline(payload)
    return TimelineGenerateResponse(data=record)


@app.post("/timeline/approve", response_model=TimelineApproveResponse)
def approve_timeline_route(payload: TimelineApproveRequest):
    record = approve_timeline(payload.threadId, payload.reviewerNotes)
    if record is None:
        raise HTTPException(status_code=404, detail="Timeline draft not found.")
    return TimelineApproveResponse(data=record)
