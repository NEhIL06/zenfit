"""Pydantic schemas for Quote Generation."""

from typing import Optional, Dict, Any
from pydantic import BaseModel


class QuoteResponse(BaseModel):
    quote: str
    author: Optional[str] = "ZenFit Coach"


class PersonalizedQuoteRequest(BaseModel):
    userProfile: Optional[Dict[str, Any]] = None
    recentActivity: Optional[Dict[str, Any]] = None


class PersonalizedQuoteResponse(BaseModel):
    quote: str
    personalizedFor: Optional[str] = "Athlete"
