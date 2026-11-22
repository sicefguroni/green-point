"""Checkpoint database connection tests.

The unit tests run anywhere. The reconnect test needs a Postgres it can write
checkpoints to; set TIMELINE_SWARM_TEST_DATABASE_URL to a *direct* (not pooled)
connection string to run it, e.g.

    docker run -d --name swarm-pg -e POSTGRES_PASSWORD=pw -p 55432:5432 postgres:16-alpine
    TIMELINE_SWARM_TEST_DATABASE_URL=postgresql://postgres:pw@localhost:55432/postgres pytest tests

It only terminates the backends behind the swarm pool's own connections, and it
deletes the `pool-test-*` checkpoint threads it creates.
"""

from __future__ import annotations

import os
import uuid

import psycopg
import pytest

from app import swarm
from app.models import GenerateTimelineRequest

TEST_DATABASE_URL = os.getenv("TIMELINE_SWARM_TEST_DATABASE_URL", "").strip()


def test_redact_database_url_hides_the_password():
    url = "postgresql://postgres.abcd:s3cr3t-pa55@aws-0.pooler.supabase.com:6543/postgres"
    redacted = swarm.redact_database_url(url)
    assert "s3cr3t-pa55" not in redacted
    assert redacted == "postgresql://postgres.abcd:***@aws-0.pooler.supabase.com:6543/postgres"


def test_redact_database_url_leaves_passwordless_urls_alone():
    url = "postgresql://localhost:5432/postgres"
    assert swarm.redact_database_url(url) == url


def test_redact_database_url_hides_non_url_strings():
    assert "hunter2" not in swarm.redact_database_url("user:hunter2@host/db")


def test_malformed_database_url_error_does_not_leak_the_password():
    # libpq's own parse error for this string quotes it in full.
    with pytest.raises(RuntimeError) as excinfo:
        swarm.open_checkpoint_pool("user:hunter2@host/db")
    assert "hunter2" not in str(excinfo.value)
    assert excinfo.value.__cause__ is None
    assert excinfo.value.__suppress_context__


def test_unreachable_database_error_does_not_leak_the_password(monkeypatch):
    monkeypatch.setattr(swarm, "CHECKPOINT_POOL_OPEN_TIMEOUT_SECONDS", 2)
    with pytest.raises(RuntimeError) as excinfo:
        # Port 1 on localhost refuses immediately.
        swarm.open_checkpoint_pool("postgresql://user:hunter2@127.0.0.1:1/db?connect_timeout=1")
    assert "hunter2" not in str(excinfo.value)
    assert excinfo.value.__suppress_context__


@pytest.fixture
def pooled_swarm(monkeypatch):
    if not TEST_DATABASE_URL:
        pytest.skip("TIMELINE_SWARM_TEST_DATABASE_URL is not set")
    for key in swarm.CHECKPOINT_DB_ENV_KEYS:
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("LANGGRAPH_CHECKPOINT_DATABASE_URL", TEST_DATABASE_URL)
    # No LLM in tests: plan with the deterministic fallback draft.
    monkeypatch.setattr(
        swarm,
        "_plan_with_llm",
        lambda rag, notes, risks, revisions, previous: swarm._fallback_planner_draft(
            rag, notes, revisions
        ),
    )
    swarm.shutdown_swarm()
    swarm.initialize_swarm()
    try:
        yield
    finally:
        swarm.shutdown_swarm()
        with psycopg.connect(TEST_DATABASE_URL, autocommit=True) as admin:
            for table in ("checkpoint_writes", "checkpoint_blobs", "checkpoints"):
                admin.execute(f"DELETE FROM {table} WHERE thread_id LIKE 'pool-test-%'")


def _terminate_swarm_connections():
    """Kill the backends behind every connection the swarm's pool currently holds.

    Each pooled connection reports its own backend pid, which also works behind
    Supabase's session pooler (where application_name is not passed through).
    """
    from contextlib import ExitStack

    pool = swarm._CHECKPOINT_POOL
    assert pool is not None
    size = pool.get_stats()["pool_size"]
    pids = []
    with ExitStack() as stack:
        for _ in range(size):
            conn = stack.enter_context(pool.connection(timeout=10))
            pids.append(conn.execute("SELECT pg_backend_pid() AS pid").fetchone()["pid"])
    with psycopg.connect(TEST_DATABASE_URL, autocommit=True) as admin:
        killed = admin.execute(
            "SELECT count(*) FROM (SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
            "WHERE pid = ANY(%s)) t",
            (pids,),
        ).fetchone()[0]
    return killed


def _start(thread_id: str):
    return swarm.start_timeline(
        GenerateTimelineRequest(
            thread_id=thread_id,
            rag_metadata={"project_title": "Pool test", "intervention_type": "rain garden"},
        )
    )


def test_swarm_recovers_after_its_connections_are_dropped(pooled_swarm):
    first_thread = f"pool-test-{uuid.uuid4()}"
    first = _start(first_thread)
    assert first.status == "awaiting_human_review"

    assert _terminate_swarm_connections() >= 1

    # Before the pool, every call after this point failed with
    # "the connection is closed" until the container restarted.
    second = _start(f"pool-test-{uuid.uuid4()}")
    assert second.status == "awaiting_human_review"

    # Checkpoints written before the drop are still readable.
    state = swarm.initialize_swarm().get_state(swarm._thread_config(first_thread))
    assert state.values["timeline"]["project_title"] == first.timeline.project_title
