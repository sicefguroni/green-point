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
npm run timeline:backend
```

The npm script resolves the workspace virtualenv first, so it avoids accidentally using a global Python interpreter that is missing swarm dependencies.

## Environment

Set `TIMELINE_SWARM_SERVICE_URL=http://127.0.0.1:8001` in the Next.js app environment if you want to override the default service address.

For durable LangGraph checkpoints, the timeline swarm also needs a Postgres connection string from one of:

- `TIMELINE_SWARM_CHECKPOINT_DB_URL`
- `DIRECT_URL`
- `DATABASE_URL`

The service prefers `TIMELINE_SWARM_CHECKPOINT_DB_URL`, then falls back to `DIRECT_URL`, then `DATABASE_URL`. Checkpoints are stored in Postgres so thread resume works after backend restarts.
