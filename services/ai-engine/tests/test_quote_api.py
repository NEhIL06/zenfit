"""Tests for Quote Generation API."""

def test_get_daily_quote(client):
    response = client.get("/v1/quote")
    assert response.status_code == 200
    data = response.json()
    assert "quote" in data
    assert len(data["quote"]) > 5
    assert data["author"] == "ZenFit Coach"


def test_get_personalized_quote(client):
    payload = {
        "userProfile": {
            "name": "Sarah",
            "fitnessGoal": "Weight Loss",
            "fitnessLevel": "Intermediate",
        }
    }
    response = client.post("/v1/quote/personalized", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "quote" in data
    assert data["personalizedFor"] == "Sarah"
