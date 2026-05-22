from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any, Dict

from fastapi import FastAPI, HTTPException
from dotenv import load_dotenv
import os
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware

from .models import GenerateTimelineRequest, ReviewTimelineRequest
from .swarm import initialize_swarm, resume_timeline, shutdown_swarm, start_timeline

# In the container, WORKDIR is /app, so __file__ is /app/app/main.py → parents[1] = /app
# In monorepo dev, __file__ is python-services/timeline_swarm/app/main.py → parents[3] = repo root
_file_path = Path(__file__).resolve()
REPO_ROOT = _file_path.parents[3] if len(_file_path.parents) > 3 else _file_path.parents[1]
load_dotenv(REPO_ROOT / ".env")
load_dotenv(REPO_ROOT / ".env.local")

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

@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_swarm()
    try:
        yield
    finally:
        shutdown_swarm()


app = FastAPI(
    title="GreenPoint Timeline Swarm",
    version="1.0.0",
    lifespan=lifespan,
)

CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS.split(","),
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
    except RuntimeError as error:
        message = str(error)
        if message.startswith("LLM_UNAVAILABLE") or message.startswith("LLM_FAILED"):
            raise HTTPException(status_code=503, detail=message) from error
        raise HTTPException(status_code=500, detail=message) from error
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
    except RuntimeError as error:
        message = str(error)
        if message.startswith("LLM_UNAVAILABLE") or message.startswith("LLM_FAILED"):
            raise HTTPException(status_code=503, detail=message) from error
        raise HTTPException(status_code=500, detail=message) from error
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Timeline approval failed: {error}",
        ) from error