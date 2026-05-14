from __future__ import annotations

from typing import Any, Dict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models import GenerateTimelineRequest, ReviewTimelineRequest
from .swarm import resume_timeline, start_timeline

MOCK_RAG_METADATA: Dict[str, Any] = {
    "project_title": "Riparian Cooling and Flood Buffer Program",
    "barangay_name": "Subangdaku",
    "intervention_type": "urban tree planting and bioswale retrofit",
    "site_count": 2,
    "needs_city_permit": True,
    "requires_ecc": False,
    "budget_cycle": "annual",
    "supplier_distance": "regional",
    "labor_intensity": "high",
    "climate_risks": ["heat", "flooding", "typhoon exposure"],
}

app = FastAPI(
    title="GreenPoint Timeline Swarm",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/timelines/mock-rag")
def get_mock_rag():
    return {"data": MOCK_RAG_METADATA}

@app.post("/timelines/generate")
def generate_timeline(request: GenerateTimelineRequest):
    try:
        if not request.rag_metadata:
            request = request.model_copy(update={"rag_metadata": MOCK_RAG_METADATA})
        return start_timeline(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Timeline generation failed: {error}"
        ) from error
    
@app.post("/timelines/approve")
def approve_timeline(payload: ReviewTimelineRequest):
    try:
        return resume_timeline(payload)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Timeline approval failed: {error}",
        ) from error