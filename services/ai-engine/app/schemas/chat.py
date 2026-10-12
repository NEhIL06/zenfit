"""Pydantic schemas for AI Trainer Chat and Self-RAG.
Matches ChatRequestSchema and ChatResponseSchema in TypeScript.
"""

from typing import List, Optional, Literal
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


class SourceDocument(BaseModel):
    content: str
    source: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    sources: Optional[List[SourceDocument]] = None
    imageUrl: Optional[str] = None
    exerciseName: Optional[str] = None
    classification: Optional[Literal["fitness", "general"]] = None
