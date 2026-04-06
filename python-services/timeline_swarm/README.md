# GreenPoint Timeline Swarm

FastAPI and LangGraph service for GreenPoint timeline generation and approval.

## Setup

```bash
python -m venv .venv
. .venv/Scripts/activate
pip install -r requirements.txt
```

## Run

```bash
python -m uvicorn timeline_swarm.app.main:app --host 127.0.0.1 --port 8001 --app-dir python-services
```

## Environment

Set `TIMELINE_SWARM_SERVICE_URL=http://127.0.0.1:8001` in the Next.js app environment if you want to override the default service address.
