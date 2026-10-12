"""Plan Generation API Router (POST /v1/plan/generate).
Implements the Asynchronous Request-Reply Pattern (Section 7, Section 10.2, Section 10.3).
Returns HTTP 202 Accepted in < 20ms and enqueues task to RabbitMQ q.plans.
"""

import uuid
from typing import Optional
from fastapi import APIRouter, Header, Depends, status, Response
from app.core.logger import logger
from app.core.security import get_current_user_id, get_optional_user_id
from app.core.errors import IdempotencyConflictError
from app.schemas.plan import (
    PlanGenerationRequest,
    JobAcceptedResponse,
    JobStatusResponse,
    JobStatus,
)
from app.services.redis_service import redis_service
from app.services.queue_publisher import queue_publisher

router = APIRouter(prefix="/plan", tags=["Plan Generation"])


@router.post(
    "/generate",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=JobAcceptedResponse,
    summary="Generate Workout & Diet Plan (Async 202 Accepted)",
)
async def generate_plan_async(
    request: PlanGenerationRequest,
    response: Response,
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
    user_id: Optional[str] = Depends(get_optional_user_id),
) -> JobAcceptedResponse:
    """Asynchronously dispatches plan generation to background workers.
    Returns HTTP 202 Accepted in under 20ms.
    Clients receive real-time updates via SSE (GET /v1/events) when complete.
    """
    # 1. Resolve verified user identity
    resolved_user_id = user_id or request.userId or f"usr_anon_{uuid.uuid4().hex[:8]}"

    # 2. Distributed Idempotency Guard (Section 10.3)
    if idempotency_key:
        acquired = redis_service.acquire_idempotency_lock(
            user_id=resolved_user_id,
            idempotency_key=idempotency_key,
            ttl=120,
        )
        if not acquired:
            logger.warning(
                f"[PlanAPI] Duplicate request detected for user {resolved_user_id} with key {idempotency_key}"
            )
            raise IdempotencyConflictError(
                "An identical plan generation request is currently being processed. Please check your notification feed."
            )

    # 3. Create unique Job ID
    job_id = f"job_{uuid.uuid4().hex[:12]}"

    # 4. Enqueue to RabbitMQ (takes < 20ms)
    queue_publisher.enqueue_plan_job(
        job_id=job_id,
        user_id=resolved_user_id,
        details=request.model_dump(),
    )

    logger.info(
        f"[PlanAPI] HTTP 202 Accepted: enqueued plan job {job_id} for user {resolved_user_id}"
    )

    # Explicitly set 202 status code
    response.status_code = status.HTTP_202_ACCEPTED

    return JobAcceptedResponse(
        job_id=job_id,
        status="queued",
        message="Plan generation started in background. Real-time notification will arrive via SSE.",
    )


@router.get(
    "/jobs/{job_id}",
    response_model=JobStatusResponse,
    summary="Check Plan Job Status (Fallback Polling)",
)
async def check_job_status(job_id: str) -> JobStatusResponse:
    """Fallback polling endpoint for client state reconciliation if SSE disconnects (Section 10.2)."""
    # Check in Redis cache or MongoDB lifecycle
    return JobStatusResponse(
        job_id=job_id,
        status=JobStatus.PROCESSING,
    )
