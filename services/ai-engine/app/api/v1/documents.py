"""Document Ingestion API Router (POST /v1/documents).
Ingests fitness and nutrition guidelines into ChromaDB for vector retrieval.
"""

from fastapi import APIRouter
from app.config import settings
from app.schemas.documents import DocumentIngestRequest, DocumentIngestResponse
from app.services.chroma_service import chroma_service

router = APIRouter(prefix="/documents", tags=["Knowledge Ingestion"])


@router.post(
    "",
    response_model=DocumentIngestResponse,
    summary="Ingest Documents into ChromaDB Vector Store",
)
async def ingest_documents(request: DocumentIngestRequest) -> DocumentIngestResponse:
    """Ingests texts into either the global collection or a specific user's collection."""
    col_name = request.collection_name
    if not col_name:
        col_name = f"fitness_user_{request.userId}" if request.userId else settings.CHROMA_GLOBAL_COLLECTION

    doc_texts = [d.content for d in request.documents]
    metas = [d.metadata or {} for d in request.documents]

    ids = await chroma_service.add_documents(doc_texts, collection_name=col_name, metadatas=metas)

    return DocumentIngestResponse(
        status="success",
        ingested_chunks=len(ids),
        collection=col_name,
    )
