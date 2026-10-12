"""Pydantic schemas for Workout & Diet Plan generation.
Strictly matches TypeScript Zod definitions from apps/web/lib/schemas/index.ts.
"""

from enum import Enum
from typing import List, Optional, Union, Dict, Any
from pydantic import BaseModel, Field, field_validator


class FitnessGoal(str, Enum):
    WEIGHT_LOSS = "Weight Loss"
    MUSCLE_GAIN = "Muscle Gain"
    MAINTENANCE = "Maintenance"
    ENDURANCE = "Endurance"
    FLEXIBILITY = "Flexibility"
    ATHLETIC_PERFORMANCE = "Athletic Performance"


class ExperienceLevel(str, Enum):
    BEGINNER = "Beginner"
    INTERMEDIATE = "Intermediate"
    ADVANCED = "Advanced"


class WorkoutLocation(str, Enum):
    GYM = "Gym"
    HOME = "Home"
    OUTDOORS = "Outdoors"
    HOTEL_ROOM = "Hotel Room"


class DietaryPreference(str, Enum):
    STANDARD = "Standard"
    VEGETARIAN = "Vegetarian"
    VEGAN = "Vegan"
    KETO = "Keto"
    PALEO = "Paleo"
    GLUTEN_FREE = "Gluten-Free"
    DAIRY_FREE = "Dairy-Free"


class Gender(str, Enum):
    MALE = "Male"
    FEMALE = "Female"
    NON_BINARY = "Non-binary"
    PREFER_NOT_TO_SAY = "Prefer not to say"


class PlanGenerationRequest(BaseModel):
    """Payload sent by client to POST /v1/plan/generate."""
    age: Union[str, int] = Field(..., description="Age of the client")
    gender: Gender = Field(..., description="Gender of the client")
    weight: Union[str, float] = Field(..., description="Weight in kg")
    height: Union[str, float] = Field(..., description="Height in cm")
    fitnessGoal: FitnessGoal = Field(..., description="Target fitness goal")
    experienceLevel: ExperienceLevel = Field(..., description="Experience level")
    workoutLocation: WorkoutLocation = Field(..., description="Workout venue")
    dietaryPreference: Optional[DietaryPreference] = Field(default=DietaryPreference.STANDARD)
    regenerationScope: Optional[str] = Field(default="full")
    userId: Optional[str] = None

    @field_validator("age")
    @classmethod
    def validate_age(cls, v: Union[str, int]) -> str:
        s = str(v).strip()
        if not s.isdigit() or not (10 <= int(s) <= 120):
            raise ValueError("Age must be a valid number between 10 and 120")
        return s

    @field_validator("weight")
    @classmethod
    def validate_weight(cls, v: Union[str, float]) -> str:
        s = str(v).strip()
        try:
            val = float(s)
            if not (20.0 <= val <= 350.0):
                raise ValueError()
        except Exception:
            raise ValueError("Weight must be a valid number between 20kg and 350kg")
        return s

    @field_validator("height")
    @classmethod
    def validate_height(cls, v: Union[str, float]) -> str:
        s = str(v).strip()
        try:
            val = float(s)
            if not (90.0 <= val <= 250.0):
                raise ValueError()
        except Exception:
            raise ValueError("Height must be a valid number between 90cm and 250cm")
        return s


class JobAcceptedResponse(BaseModel):
    """Asynchronous HTTP 202 Accepted response envelope."""
    job_id: str
    status: str = "queued"
    message: str = "Workout and diet plan generation queued for processing"


class JobStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class JobStatusResponse(BaseModel):
    """Job status check envelope for state reconciliation."""
    job_id: str
    status: JobStatus
    plan: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ExerciseItem(BaseModel):
    name: str
    sets: Union[str, int]
    reps: Union[str, int]
    rest_seconds: Optional[Union[str, int]] = None
    rest: Optional[Union[str, int]] = None
    notes: Optional[str] = None
    rpe: Optional[Union[str, int]] = None


class DayPlan(BaseModel):
    day: str
    focus: str
    exercises: List[ExerciseItem]


class MealItem(BaseModel):
    name: str
    calories: Optional[Union[str, int]] = None
    protein_g: Optional[Union[str, int]] = None
    protein: Optional[Union[str, int]] = None
    carbs: Optional[Union[str, int]] = None
    fat: Optional[Union[str, int]] = None


class MealPlan(BaseModel):
    meal: str
    name: Optional[str] = None
    calories: Optional[Union[str, int]] = None
    protein: Optional[str] = None
    items: Optional[List[MealItem]] = None


class PlanResponse(BaseModel):
    summary: Optional[str] = None
    workout_plan: List[DayPlan]
    diet_plan: Optional[List[MealPlan]] = None
    recommendations: Optional[List[str]] = None
    motivation_tips: Optional[List[str]] = None
