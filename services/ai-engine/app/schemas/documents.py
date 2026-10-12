"""Pydantic schemas for ChromaDB document ingestion."""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class DocumentItem(BaseModel):
    content: str
    metadata: Optional[Dict[str, Any]] = None


class DocumentIngestRequest(BaseModel):
    documents: List[DocumentItem] = Field(..., min_length=1)
    collection_name: Optional[str] = None
    userId: Optional[str] = None


class DocumentIngestResponse(BaseModel):
    status: str = "success"
    ingested_chunks: int
    collection: str
