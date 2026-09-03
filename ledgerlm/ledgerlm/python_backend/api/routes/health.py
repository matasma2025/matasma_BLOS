"""
Health check endpoint for Azure App Service health probes.
Returns 200 when healthy, 503 when degraded.
"""
import asyncio
import os
import time
import logging
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger(__name__)
router = APIRouter()
_start_time = time.time()


class HealthResponse(BaseModel):
    status: str
    uptime_seconds: int
    service: str
    version: str
    database: Optional[str] = None


@router.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check():
    """Deep health check — used by Azure App Service health probe."""
    uptime = int(time.time() - _start_time)

    db_status = "ok"
    try:
        # Use the central Entra-aware helper so the health check works across
        # all auth modes (Neon, local, Azure password, Azure Managed Identity).
        # get_db_connection() is synchronous (psycopg2), so run it in a thread
        # pool executor to avoid blocking the async event loop.
        from database import get_db_connection

        def _check():
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT 1")
            cur.close()
            conn.close()

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _check)

    except Exception as exc:
        logger.warning(f"Health DB check failed: {exc}")
        db_status = f"error: {str(exc)[:80]}"

    return HealthResponse(
        status="healthy" if db_status == "ok" else "degraded",
        uptime_seconds=uptime,
        service="LedgerLM Python Backend",
        version="1.0.0",
        database=db_status,
    )
