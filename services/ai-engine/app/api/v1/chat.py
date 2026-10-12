"""AI Trainer Chat API Router (POST /v1/chat).
Supports both direct JSON responses and real-time Server-Sent Events (SSE) token streaming.
"""

from typing import Optional
from fastapi import APIRouter, Header, Depends, Request
from fastapi.responses import StreamingResponse
from app.core.security import get_optional_user_id
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.rag_service import rag_pipeline

router = APIRouter(prefix="/chat", tags=["AI Trainer Chat"])


@router.post(
    "",
    summary="Interactive AI Trainer Chat & Self-RAG",
    response_model=ChatResponse,
)
async def chat_handler(
    request: Request,
    body: ChatRequest,
    accept: Optional[str] = Header(default=None, alias="Accept"),
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """Processes conversational questions via the Self-RAG pipeline.
    If 'Accept: text/event-stream' is provided, streams tokens via Server-Sent Events.
    """
    resolved_user_id = user_id or body.userId
    chat_hist = [m.model_dump() for m in (body.history or body.chatHistory or [])]

    # 1. SSE Streaming Mode
    accept_header = request.headers.get("Accept", "")
    if "text/event-stream" in accept_header:
        return StreamingResponse(
            rag_pipeline.stream_chat(
                message=body.message,
                user_id=resolved_user_id,
                chat_history=chat_hist,
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    # 2. Synchronous JSON Response Mode
    result = await rag_pipeline.run(
        message=body.message,
        user_id=resolved_user_id,
        chat_history=chat_hist,
        images=body.images,
    )

    return ChatResponse(
        response=result["response"],
        sources=result.get("sources"),
        imageUrl=result.get("imageUrl"),
        exerciseName=result.get("exerciseName"),
        classification=result.get("classification"),
    )
