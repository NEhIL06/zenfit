"""Tests for Asynchronous Plan Generation API (POST /v1/plan/generate)."""

import pytest
from app.services.queue_publisher import queue_publisher


def test_generate_plan_success_202(client):
    payload = {
        "age": "28",
        "gender": "Male",
        "height": "180",
        "weight": "78",
        "fitnessGoal": "Muscle Gain",
        "experienceLevel": "Intermediate",
        "workoutLocation": "Gym",
        "dietaryPreference": "Standard",
        "userId": "usr_test_123",
    }
    headers = {
        "X-User-Id": "usr_test_123",
        "Idempotency-Key": "idemp_abc_1",
    }

    response = client.post("/v1/plan/generate", json=payload, headers=headers)
    assert response.status_code == 202
    data = response.json()
    assert "job_id" in data
    assert data["status"] == "queued"
    assert "Plan generation started" in data["message"]


def test_generate_plan_idempotency_conflict_409(client):
    payload = {
        "age": "28",
        "gender": "Male",
        "height": "180",
        "weight": "78",
        "fitnessGoal": "Muscle Gain",
        "experienceLevel": "Intermediate",
        "workoutLocation": "Gym",
        "dietaryPreference": "Standard",
        "userId": "usr_test_123",
    }
    headers = {
        "X-User-Id": "usr_test_123",
        "Idempotency-Key": "idemp_duplicate_test",
    }

    # 1. First call: Accepted (202)
    res1 = client.post("/v1/plan/generate", json=payload, headers=headers)
    assert res1.status_code == 202

    # 2. Second immediate call with identical Idempotency-Key: Conflict (409)
    res2 = client.post("/v1/plan/generate", json=payload, headers=headers)
    assert res2.status_code == 409
    data = res2.json()
    assert data["error"] == "CONFLICT"
    assert data["code"] == "IDEMPOTENCY_CONFLICT"


def test_generate_plan_validation_error_400(client):
    # Invalid age and unknown fitness goal
    payload = {
        "age": "not-a-number",
        "gender": "Male",
        "height": "180",
        "weight": "78",
        "fitnessGoal": "InvalidNonExistentGoal",
        "experienceLevel": "Intermediate",
        "workoutLocation": "Gym",
    }
    response = client.post("/v1/plan/generate", json=payload)
    assert response.status_code == 400
    data = response.json()
    assert data["error"] == "VALIDATION_ERROR"
    assert "code" in data
