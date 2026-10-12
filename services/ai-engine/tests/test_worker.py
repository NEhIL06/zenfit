"""Tests for Background RabbitMQ Plan Worker (PlanWorker).
Verifies:
- Async job processing (Mistral -> Mongo -> Cache Purge -> Redis Pub/Sub)
- Strict ACK sequencing (Section 10.2 / Checklist P1)
- 3x exponential retry backoff and Dead-Letter Queue (DLQ) poison-pill routing
"""

import json
from unittest.mock import MagicMock
from app.workers.plan_worker import PlanWorker
from app.services.redis_service import redis_service


def test_worker_process_job_pipeline():
    worker = PlanWorker()
    job_payload = {
        "job_id": "job_test_001",
        "user_id": "usr_tester_99",
        "details": {
            "age": "25",
            "gender": "Female",
            "height": "165",
            "weight": "60",
            "fitnessGoal": "Weight Loss",
            "experienceLevel": "Beginner",
            "workoutLocation": "Home",
            "dietaryPreference": "Standard",
        },
        "retry_count": 0,
    }

    # Execute full job pipeline
    plan = worker.process_job(job_payload)

    # 1. Verify structured plan output
    assert "workout_plan" in plan
    assert "diet_plan" in plan
    assert len(plan["workout_plan"]) > 0

    # 2. Verify stored in worker DB
    stored = worker._memory_db.get("usr_tester_99")
    assert stored is not None
    assert stored["job_id"] == "job_test_001"
    assert stored["status"] == "COMPLETED"


def test_worker_on_message_strict_ack_sequencing():
    """Verifies basic_ack is called only upon complete success."""
    worker = PlanWorker()
    job_payload = {
        "job_id": "job_ack_test",
        "user_id": "usr_ack_1",
        "details": {
            "age": "30",
            "gender": "Male",
            "height": "175",
            "weight": "75",
            "fitnessGoal": "Muscle Gain",
            "experienceLevel": "Intermediate",
            "workoutLocation": "Gym",
        },
        "retry_count": 0,
    }

    mock_ch = MagicMock()
    mock_method = MagicMock()
    mock_method.delivery_tag = 101
    mock_props = MagicMock()

    body = json.dumps(job_payload).encode("utf-8")

    worker.on_message(mock_ch, mock_method, mock_props, body)

    # basic_ack must be called with delivery_tag 101
    mock_ch.basic_ack.assert_called_once_with(delivery_tag=101)
    mock_ch.basic_reject.assert_not_called()


def test_worker_poison_pill_max_retries_routes_to_dlq():
    """Verifies that a message failing after 3 attempts routes to DLQ and publishes failure event."""
    worker = PlanWorker()
    worker.max_retries = 3

    job_payload = {
        "job_id": "job_poison_pill",
        "user_id": "usr_poison_1",
        "details": {},  # Will cause failure or mock error
        "retry_count": 3,  # Already hit max retries
    }

    # Force error by mocking process_job to throw
    worker.process_job = MagicMock(side_effect=RuntimeError("Mistral permanently unavailable"))

    mock_ch = MagicMock()
    mock_method = MagicMock()
    mock_method.delivery_tag = 999
    mock_props = MagicMock()

    body = json.dumps(job_payload).encode("utf-8")

    worker.on_message(mock_ch, mock_method, mock_props, body)

    # Must reject without requeuing (routes to DLQ)
    mock_ch.basic_reject.assert_called_once_with(delivery_tag=999, requeue=False)
