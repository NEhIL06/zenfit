"""Quote API Router (GET /v1/quote and POST /v1/quote/personalized)."""

from fastapi import APIRouter
from app.schemas.quote import (
    QuoteResponse,
    PersonalizedQuoteRequest,
    PersonalizedQuoteResponse,
)
from app.services.quote_service import quote_service

router = APIRouter(prefix="/quote", tags=["Motivational Quotes"])


@router.get(
    "",
    response_model=QuoteResponse,
    summary="Get Daily Motivational Fitness Quote",
)
async def get_daily_quote() -> QuoteResponse:
    """Returns a short motivational quote, cached in Redis for 12 hours."""
    res = await quote_service.get_daily_quote()
    return QuoteResponse(quote=res["quote"], author=res.get("author", "ZenFit Coach"))


@router.post(
    "/personalized",
    response_model=PersonalizedQuoteResponse,
    summary="Generate Tailored Personal Motivation Quote",
)
async def get_personalized_quote(request: PersonalizedQuoteRequest) -> PersonalizedQuoteResponse:
    """Generates a quote customized to client goals and fitness level."""
    res = await quote_service.get_personalized_quote(request.userProfile)
    return PersonalizedQuoteResponse(
        quote=res["quote"],
        personalizedFor=res.get("personalizedFor", "Athlete"),
    )
