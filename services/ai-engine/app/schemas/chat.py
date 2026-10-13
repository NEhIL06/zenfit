"""Pydantic schemas for AI Trainer Chat, Self-RAG, and Agentic Tool Calling.
Matches ChatRequestSchema and ChatResponseSchema, with tool contracts for generate_exercise_visual.
"""

from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(..., max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    userId: Optional[str] = None
    conversationId: Optional[str] = None
    history: Optional[List[ChatMessage]] = Field(default=None, max_length=20)
    chatHistory: Optional[List[ChatMessage]] = Field(default=None, max_length=20)
    images: Optional[List[str]] = Field(default=None, max_length=1)
    userPlanContext: Optional[str] = None


class SourceDocument(BaseModel):
    content: str
    source: Optional[str] = None


class GenerateExerciseVisualInput(BaseModel):
    item_name: str = Field(
        description="Canonical name of the exercise or meal item (e.g., 'Barbell Romanian Deadlift')"
    )
    category: str = Field(
        description="Category classification: 'exercise' or 'meal'"
    )
    biomechanical_focus: str = Field(
        description="Critical visual cues (e.g., 'Hip hinge angle, neutral lumbar spine, bar over midfoot')"
    )


TOOL_GENERATE_VISUAL = {
    "type": "function",
    "function": {
        "name": "generate_exercise_visual",
        "description": "Generate an anatomical form demonstration or nutritional visual card when visual pedagogy is necessary.",
        "parameters": GenerateExerciseVisualInput.model_json_schema(),
    },
}


class ToolCall(BaseModel):
    tool: str
    call_id: str
    args: Dict[str, Any]


class ChatResponse(BaseModel):
    response: str
    sources: Optional[List[SourceDocument]] = None
    imageUrl: Optional[str] = None
    exerciseName: Optional[str] = None
    classification: Optional[Literal["fitness", "general"]] = None
    tool_calls: Optional[List[ToolCall]] = None
    retrieval_route: Optional[str] = None
    cache_hit: Optional[bool] = None
