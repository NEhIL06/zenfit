"""ZenFit AI Engine Service — Main FastAPI Application Entrypoint.
Staff Engineer Grade: Lifespan management, correlation IDs, graceful shutdown,
fail-closed production guards, and standardized error envelopes.
"""

from contextlib import asynccontextmanager
import time
import uuid
from typing import AsyncGenerator
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.core.logger import logger
from app.core.errors import ZenFitException
from app.api.health import router as health_router
from app.api.v1.api import api_v1_router
from app.services.queue_publisher import queue_publisher


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manages application startup checks and graceful shutdown routines."""
    # 1. Startup
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION} [{settings.ENVIRONMENT}]")
    try:
        settings.validate_production_secrets()
    except RuntimeError as err:
        logger.critical(f"Startup halted due to security validation error: {err}")
        raise err

    yield

    # 2. Shutdown
    logger.info("Initiating graceful shutdown for AI Engine...")
    queue_publisher.close()
    logger.info("All connections closed cleanly. Shutdown complete.")


def create_application() -> FastAPI:
    """Factory creating and configuring the FastAPI app."""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # 1. CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 2. Correlation ID & Access Log Middleware
    @app.middleware("http")
    async def correlation_id_middleware(request: Request, call_next):
        start_time = time.perf_counter()
        req_id = request.headers.get("X-Request-Id") or f"req_{uuid.uuid4().hex[:10]}"
        request.state.request_id = req_id

        # Forward user identity if present in header
        user_id = request.headers.get("X-User-Id")
        if user_id:
            request.state.user_id = user_id

        response = await call_next(request)
        duration_ms = (time.perf_counter() - start_time) * 1000.0

        response.headers["X-Request-Id"] = req_id
        response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"

        # Log request summary
        logger.info(
            f"{request.method} {request.url.path} -> {response.status_code} ({duration_ms:.2f}ms)"
        )
        return response

    # 3. Exception Handlers (Standardized ApiError Envelopes)
    @app.exception_handler(ZenFitException)
    async def zenfit_exception_handler(request: Request, exc: ZenFitException):
        envelope = exc.to_envelope()
        envelope["requestId"] = getattr(request.state, "request_id", "")
        return JSONResponse(status_code=exc.status_code, content=envelope)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        first_error = exc.errors()[0] if exc.errors() else {}
        loc = " -> ".join(str(l) for l in first_error.get("loc", []))
        msg = first_error.get("msg", "Invalid request parameter")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": "VALIDATION_ERROR",
                "message": f"Validation failed at '{loc}': {msg}",
                "details": str(exc.errors()),
                "code": "BAD_REQUEST",
                "requestId": getattr(request.state, "request_id", ""),
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": "HTTP_ERROR",
                "message": str(exc.detail),
                "code": f"HTTP_{exc.status_code}",
                "requestId": getattr(request.state, "request_id", ""),
            },
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception on {request.url.path}: {exc}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred while processing the request",
                "code": "INTERNAL_ERROR",
                "requestId": getattr(request.state, "request_id", ""),
            },
        )

    # 4. Include Routers
    app.include_router(health_router)
    app.include_router(api_v1_router)

    # Legacy alias router for Next.js monolithic transition compatibility:
    # /api/ai-trainer/chat -> maps to /v1/chat
    @app.post("/api/ai-trainer/chat", include_in_schema=False)
    async def legacy_chat_alias(request: Request):
        from app.api.v1.chat import chat_handler
        from app.schemas.chat import ChatRequest
        body_json = await request.json()
        chat_req = ChatRequest(**body_json)
        return await chat_handler(request, chat_req)

    return app


app = create_application()
