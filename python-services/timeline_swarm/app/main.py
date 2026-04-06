from __future__ import annotations

from fastapi import FastAPI, HTTPException

from .models import (
    TimelineApproveRequest,
    TimelineApproveResponse,
    TimelineGenerateRequest,
    TimelineGenerateResponse,
)
from .swarm import approve_timeline, start_timeline

app = FastAPI(title="GreenPoint Timeline Swarm", version="0.1.0")


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
