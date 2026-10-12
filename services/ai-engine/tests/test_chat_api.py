"""Tests for AI Trainer Chat and Self-RAG API (POST /v1/chat)."""

def test_chat_general_query(client):
    payload = {
        "message": "Hello, good morning coach!",
        "userId": "usr_test_1",
    }
    response = client.post("/v1/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "response" in data
    assert data["classification"] == "general"


def test_chat_fitness_query_self_rag(client):
    payload = {
        "message": "How many sets and reps should I do for squat hypertrophy?",
        "userId": "usr_test_1",
    }
    response = client.post("/v1/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "response" in data
    assert data["classification"] == "fitness"
    assert "sources" in data
    assert len(data["sources"]) > 0


def test_chat_sse_stream(client):
    payload = {
        "message": "What is the optimal rest time between deadlift sets?",
        "userId": "usr_test_1",
    }
    headers = {"Accept": "text/event-stream"}
    response = client.post("/v1/chat", json=payload, headers=headers)
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["Content-Type"]
    content = response.text
    assert "data:" in content


def test_legacy_chat_alias(client):
    payload = {
        "message": "Hey there!",
        "userId": "usr_test_legacy",
    }
    response = client.post("/api/ai-trainer/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "response" in data
