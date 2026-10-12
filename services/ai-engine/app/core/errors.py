"""Standardized exception hierarchy and error envelopes for ZenFit AI Engine.
Aligns with the ApiErrorSchema used across Next.js and Go Gateway.
"""

from typing import Optional, Dict, Any
from fastapi import HTTPException, status
from fastapi.responses import JSONResponse


class ZenFitException(Exception):
    """Base exception for all domain exceptions in ZenFit AI Engine."""

    def __init__(
        self,
        error: str,
        message: Optional[str] = None,
        details: Optional[str] = None,
        code: Optional[str] = None,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
    ):
        super().__init__(message or error)
        self.error = error
        self.message = message or error
        self.details = details
        self.code = code or "INTERNAL_ERROR"
        self.status_code = status_code

    def to_envelope(self) -> Dict[str, Any]:
        envelope: Dict[str, Any] = {
            "error": self.error,
            "message": self.message,
            "code": self.code,
        }
        if self.details:
            envelope["details"] = self.details
        return envelope

    def to_response(self) -> JSONResponse:
        return JSONResponse(status_code=self.status_code, content=self.to_envelope())


class QuotaExceededError(ZenFitException):
    def __init__(self, message: str = "Rate limit or AI provider quota exceeded. Please wait a moment."):
        super().__init__(
            error="QUOTA_EXCEEDED",
            message=message,
            code="QUOTA_EXCEEDED",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        )


class CircuitBreakerOpenError(ZenFitException):
    def __init__(self, service_name: str):
        super().__init__(
            error="SERVICE_UNAVAILABLE",
            message=f"Third-party upstream service '{service_name}' is temporarily degraded. Circuit breaker is open.",
            code="CIRCUIT_BREAKER_OPEN",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


class UnauthorizedError(ZenFitException):
    def __init__(self, message: str = "Missing or invalid authenticated user credentials"):
        super().__init__(
            error="UNAUTHORIZED",
            message=message,
            code="UNAUTHORIZED",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )


class IdempotencyConflictError(ZenFitException):
    def __init__(self, message: str = "An identical operation is currently being processed or was completed."):
        super().__init__(
            error="CONFLICT",
            message=message,
            code="IDEMPOTENCY_CONFLICT",
            status_code=status.HTTP_409_CONFLICT,
        )


class QueuePublishError(ZenFitException):
    def __init__(self, message: str = "Failed to dispatch async task to message broker"):
        super().__init__(
            error="QUEUE_UNAVAILABLE",
            message=message,
            code="QUEUE_ERROR",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
