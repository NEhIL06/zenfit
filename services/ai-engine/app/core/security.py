"""Zero-Trust internal boundary security for ZenFit AI Engine.
Extracts trusted headers (X-User-Id, X-User-Role) injected downstream by Go API Gateway.
External untrusted client headers were already stripped at the Gateway boundary.
"""

from typing import Optional
from fastapi import Request, Header
from app.core.errors import UnauthorizedError


def get_current_user_id(
    request: Request,
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> str:
    """Extracts and verifies the caller's user ID from internal Gateway headers."""
    # 1. Primary: Trusted header forwarded by Go API Gateway
    if x_user_id and x_user_id.strip():
        return x_user_id.strip()

    # 2. Check if present in request state or custom attributes
    if hasattr(request.state, "user_id") and request.state.user_id:
        return str(request.state.user_id)

    raise UnauthorizedError("Missing verified X-User-Id header from API Gateway")


def get_optional_user_id(
    request: Request,
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Optional[str]:
    """Extracts optional user ID for endpoints that permit anonymous or public interactions."""
    if x_user_id and x_user_id.strip():
        return x_user_id.strip()
    if hasattr(request.state, "user_id") and request.state.user_id:
        return str(request.state.user_id)
    return None


def get_request_id(
    x_request_id: Optional[str] = Header(default=None, alias="X-Request-Id"),
) -> str:
    """Extracts correlation ID or returns empty."""
    return x_request_id or ""
