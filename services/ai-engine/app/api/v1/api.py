"""V1 API Router Aggregator for ZenFit AI Engine."""

from fastapi import APIRouter
from app.api.v1.plan import router as plan_router
from app.api.v1.chat import router as chat_router
from app.api.v1.image import router as image_router
from app.api.v1.quote import router as quote_router
from app.api.v1.documents import router as documents_router

api_v1_router = APIRouter(prefix="/v1")

api_v1_router.include_router(plan_router)
api_v1_router.include_router(chat_router)
api_v1_router.include_router(image_router)
api_v1_router.include_router(quote_router)
api_v1_router.include_router(documents_router)
