"""Tests for Liveness and Readiness probes."""

def test_health_live(client):
    response = client.get("/health/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "UP"
    assert "ZenFit AI Engine" in data["service"]


def test_health_ready(client):
    response = client.get("/health/ready")
    assert response.status_code in (200, 503)
    data = response.json()
    assert "dependencies" in data
    assert "redis" in data["dependencies"]
