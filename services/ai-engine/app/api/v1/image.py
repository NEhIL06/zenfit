"""Image Generation API Router (POST /v1/image/generate)."""

from fastapi import APIRouter
from app.schemas.image import ImageGenerationRequest, ImageGenerationResponse
from app.services.image_service import image_service

router = APIRouter(prefix="/image", tags=["Image Generation"])


@router.post(
    "/generate",
    response_model=ImageGenerationResponse,
    summary="Generate Exercise or Meal Photograph",
)
async def generate_image(request: ImageGenerationRequest) -> ImageGenerationResponse:
    """Generates an image via the 3-tier fallback chain (Redis -> Pollinations -> Curated CDN)."""
    result = await image_service.generate_image(request.name, request.type)
    return ImageGenerationResponse(
        imageData=result["imageData"],
        provider=result.get("provider", "cache"),
    )
