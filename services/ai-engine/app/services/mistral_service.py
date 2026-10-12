"""Mistral AI Service for CSCS-Certified Plan Generation and Conversational Chat.
Encapsulates prompt engineering, JSON schema formatting, retries, and circuit breaker protection.
"""

import json
import re
from typing import Dict, Any, Optional
try:
    from mistralai.client import Mistral
except ImportError:
    try:
        from mistralai import Mistral
    except ImportError:
        Mistral = None
from app.config import settings
from app.core.logger import logger
from app.core.circuit_breaker import mistral_breaker
from app.core.errors import QuotaExceededError, ZenFitException


class MistralService:
    """Manages interactions with Mistral LLM endpoints."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.MISTRAL_API_KEY
        self.model = settings.MISTRAL_MODEL
        self._client: Optional[Mistral] = None

    @property
    def client(self) -> Optional[Mistral]:
        if self._client is None and self.api_key:
            self._client = Mistral(api_key=self.api_key)
        return self._client

    def build_plan_prompt(self, profile: Dict[str, Any]) -> str:
        """Constructs the CSCS and registered dietitian system prompt."""
        age = profile.get("age", 25)
        gender = profile.get("gender", "Male")
        height = profile.get("height", 175)
        weight = profile.get("weight", 70)
        goal = profile.get("fitnessGoal", "Muscle Gain")
        level = profile.get("experienceLevel", "Intermediate")
        location = profile.get("workoutLocation", "Gym")
        diet = profile.get("dietaryPreference", "Standard")

        return f"""You are a CSCS-certified strength coach and registered dietitian.
Generate a structured 7-day personalized workout and diet plan for the following client:

Client Profile:
- Age: {age}
- Gender: {gender}
- Height: {height}cm
- Weight: {weight}kg
- Fitness Goal: {goal}
- Experience Level: {level}
- Workout Location: {location}
- Dietary Preference: {diet}

RULES & CONSTRAINTS:
1. Calculate TDEE using Mifflin-St Jeor equation.
2. Set daily calorie & macro targets tailored to goal:
   - Weight Loss: TDEE - 500 kcal (40% Protein / 30% Carbs / 30% Fat)
   - Muscle Gain: TDEE + 300 kcal (30% Protein / 45% Carbs / 25% Fat)
   - Maintenance: TDEE (30% Protein / 40% Carbs / 30% Fat)
3. For {level}:
   - Beginner: 3 training days (Full Body), rest days placed between training days
   - Intermediate: 4 training days (Upper/Lower Split)
   - Advanced: 5-6 training days (Push/Pull/Legs Split)
4. Include RPE (Rate of Perceived Exertion 1-10) for each exercise.

OUTPUT FORMAT (JSON Object ONLY, with NO extra markdown or formatting):
{{
  "summary": "2-line motivational introduction tailored specifically to their goal of {goal} at {location}.",
  "workout_plan": [
    {{
      "day": "Day 1",
      "focus": "Full Body Strength",
      "exercises": [
        {{
          "name": "Barbell Squat",
          "sets": 3,
          "reps": "8-10",
          "rest_seconds": 90,
          "rest": "90s",
          "rpe": 8,
          "notes": "Keep chest elevated and maintain neutral spine"
        }}
      ]
    }}
  ],
  "diet_plan": [
    {{
      "meal": "Breakfast",
      "items": [
        {{
          "name": "High-Protein Oatmeal with Greek Yogurt & Berries",
          "calories": 450,
          "protein_g": 35,
          "protein": "35g"
        }}
      ]
    }},
    {{
      "meal": "Lunch",
      "items": [
        {{
          "name": "Grilled Chicken Breast with Quinoa & Roasted Greens",
          "calories": 600,
          "protein_g": 48,
          "protein": "48g"
        }}
      ]
    }},
    {{
      "meal": "Dinner",
      "items": [
        {{
          "name": "Baked Salmon with Sweet Potato & Asparagus",
          "calories": 550,
          "protein_g": 40,
          "protein": "40g"
        }}
      ]
    }},
    {{
      "meal": "Snack",
      "items": [
        {{
          "name": "Whey Protein Shake with Almonds",
          "calories": 250,
          "protein_g": 25,
          "protein": "25g"
        }}
      ]
    }}
  ],
  "motivation_tips": [
    "Specific actionable tip 1 aligned with {goal} and {level} level",
    "Specific actionable tip 2 for workout execution at {location}",
    "Specific actionable tip 3 for dietary consistency following {diet} preference"
  ],
  "recommendations": [
    "Specific actionable tip 1 aligned with {goal} and {level} level",
    "Specific actionable tip 2 for workout execution at {location}",
    "Specific actionable tip 3 for dietary consistency following {diet} preference"
  ]
}}"""

    async def generate_plan(self, profile: Dict[str, Any]) -> Dict[str, Any]:
        """Calls Mistral chat completion to generate structured workout and diet plan."""
        prompt = self.build_plan_prompt(profile)

        # If no API key is provided, or in test environment, return synthetic CSCS plan
        if not self.client or settings.ENVIRONMENT == "test":
            logger.info("[MistralService] Using CSCS synthetic plan generator.")
            return self._generate_synthetic_plan(profile)

        async def _call_mistral():
            try:
                resp = self.client.chat.complete(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                )
                content = resp.choices[0].message.content or "{}"
                return self._parse_json_response(content)
            except Exception as err:
                err_str = str(err).lower()
                if "429" in err_str or "quota" in err_str or "rate limit" in err_str:
                    if not settings.is_production:
                        logger.warning("[MistralService] Upstream 429 quota reached. Falling back to synthetic plan.")
                        return self._generate_synthetic_plan(profile)
                    raise QuotaExceededError("Mistral API rate limit exceeded")
                raise err

        return await mistral_breaker.call(_call_mistral)

    async def generate_chat_text(self, prompt: str, system_prompt: Optional[str] = None, max_tokens: int = 500) -> str:
        """Generates general conversational text via Mistral."""
        if not self.client or settings.ENVIRONMENT == "test":
            return "Keep pushing your limits every single day! Consistency and discipline are your superpowers."

        sys_msg = system_prompt or "You are an expert AI fitness coach and nutritionist."
        messages = [
            {"role": "system", "content": sys_msg},
            {"role": "user", "content": prompt},
        ]

        async def _call_chat():
            try:
                resp = self.client.chat.complete(
                    model=self.model,
                    messages=messages,
                    max_tokens=max_tokens,
                )
                return resp.choices[0].message.content or ""
            except Exception as err:
                err_str = str(err).lower()
                if "429" in err_str or "quota" in err_str or "rate limit" in err_str:
                    if not settings.is_production:
                        logger.warning("[MistralService] Upstream 429 quota reached for chat. Falling back to synthetic coach advice.")
                        return "Prioritize progressive overload and maintain proper exercise technique. Dedication and consistency yield long-term results."
                    raise QuotaExceededError("Mistral API rate limit exceeded")
                raise err

        return await mistral_breaker.call(_call_chat)

    def _parse_json_response(self, text: str) -> Dict[str, Any]:
        """Sanitizes and safely parses JSON from LLM output."""
        cleaned = text.strip()
        # Strip markdown fences if present
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            # Fallback regex extraction of outer JSON object
            match = re.search(r"\{[\s\S]*\}", cleaned)
            if match:
                return json.loads(match.group(0))
            raise ZenFitException(
                error="INVALID_AI_OUTPUT",
                message="Mistral returned malformed JSON response",
                status_code=502,
            )

    def _generate_synthetic_plan(self, profile: Dict[str, Any]) -> Dict[str, Any]:
        """High-fidelity synthetic plan generator for development and testing without API costs."""
        goal = profile.get("fitnessGoal", "Muscle Gain")
        loc = profile.get("workoutLocation", "Gym")
        level = profile.get("experienceLevel", "Intermediate")
        diet = profile.get("dietaryPreference", "Standard")

        return {
            "summary": f"Your personalized 7-day blueprint engineered for {goal} training at {loc}.",
            "workout_plan": [
                {
                    "day": "Day 1",
                    "focus": "Upper Body Power",
                    "exercises": [
                        {"name": "Barbell Bench Press", "sets": 4, "reps": "6-8", "rest_seconds": 90, "rest": "90s", "rpe": 8, "notes": "Drive feet into floor"},
                        {"name": "Bent Over Barbell Row", "sets": 4, "reps": "8-10", "rest_seconds": 90, "rest": "90s", "rpe": 8, "notes": "Squeeze lats at apex"},
                        {"name": "Overhead Shoulder Press", "sets": 3, "reps": "10-12", "rest_seconds": 60, "rest": "60s", "rpe": 7, "notes": "Core locked"},
                    ],
                },
                {
                    "day": "Day 2",
                    "focus": "Lower Body Strength",
                    "exercises": [
                        {"name": "Barbell Back Squat", "sets": 4, "reps": "6-8", "rest_seconds": 120, "rest": "120s", "rpe": 8, "notes": "Knees track over toes"},
                        {"name": "Romanian Deadlift", "sets": 3, "reps": "8-10", "rest_seconds": 90, "rest": "90s", "rpe": 7, "notes": "Hinge at hips"},
                        {"name": "Walking Lunges", "sets": 3, "reps": "12 per leg", "rest_seconds": 60, "rest": "60s", "rpe": 7, "notes": "Chest upright"},
                    ],
                },
                {
                    "day": "Day 3",
                    "focus": "Active Recovery & Mobility",
                    "exercises": [
                        {"name": "Foam Rolling & Hip Opener", "sets": 1, "reps": "15 mins", "rest_seconds": 0, "rest": "0s", "rpe": 4, "notes": "Slow controlled breathing"},
                    ],
                },
            ],
            "diet_plan": [
                {
                    "meal": "Breakfast",
                    "items": [{"name": "Egg White Omelet with Avocado & Oats", "calories": 480, "protein_g": 38, "protein": "38g"}],
                },
                {
                    "meal": "Lunch",
                    "items": [{"name": "Lean Grilled Turkey Bowl with Jasmine Rice", "calories": 620, "protein_g": 52, "protein": "52g"}],
                },
                {
                    "meal": "Dinner",
                    "items": [{"name": "Wild Salmon with Sweet Potato & Broccoli", "calories": 540, "protein_g": 42, "protein": "42g"}],
                },
                {
                    "meal": "Snack",
                    "items": [{"name": "Greek Yogurt with Mixed Berries", "calories": 220, "protein_g": 24, "protein": "24g"}],
                },
            ],
            "motivation_tips": [
                f"Progressive overload is critical for your {goal} objective.",
                f"Prepare gym gear beforehand to ensure zero missed sessions at {loc}.",
                f"Hydrate with at least 3 liters of water to support your {diet} nutrition targets.",
            ],
            "recommendations": [
                "Track all weights in your workout log.",
                "Prioritize 7-8 hours of uninterrupted sleep for neuromuscular recovery.",
                "Consume post-workout protein within 90 minutes of finishing training.",
            ],
        }


# Singleton instance
mistral_service = MistralService()
