"""Tests for Image Generation API (POST /v1/image/generate)."""

def test_generate_image_exercise(client):
    payload = {"name": "Barbell Squat", "type": "exercise"}
    response = client.post("/v1/image/generate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "imageData" in data
    assert data["imageData"].startswith("http")


def test_generate_image_meal(client):
    payload = {"name": "Grilled Salmon", "type": "meal"}
    response = client.post("/v1/image/generate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "imageData" in data
    assert data["imageData"].startswith("http")


def test_generate_image_cache_hit(client):
    payload = {"name": "Barbell Bench Press", "type": "exercise"}
    # Call 1 (generates and caches)
    res1 = client.post("/v1/image/generate", json=payload)
    assert res1.status_code == 200

    # Call 2 (cache hit)
    res2 = client.post("/v1/image/generate", json=payload)
    assert res2.status_code == 200
    data = res2.json()
    assert data["provider"] == "cache"
