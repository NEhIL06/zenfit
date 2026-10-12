"""Pydantic schemas for Image Generation."""

from typing import Literal, Optional
from pydantic import BaseModel, Field


class ImageGenerationRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    type: Literal["exercise", "meal"]


class ImageGenerationResponse(BaseModel):
    imageData: str
    provider: Optional[str] = "cache"
