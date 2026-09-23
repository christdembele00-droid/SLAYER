import os

from fastapi import Header, HTTPException
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials

def _initialize_firebase() -> None:
    if firebase_admin._apps:
        return
    service_account = os.getenv("FIREBASE_SERVICE_ACCOUNT")
    try:
        if service_account:
            firebase_admin.initialize_app(credentials.Certificate(service_account))
        else:
            firebase_admin.initialize_app()
    except Exception:
        # Production must provide Application Default Credentials or a service-account
        # path. The API stays unavailable rather than silently disabling auth.
        return

_initialize_firebase()

def require_bearer(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing_bearer_token")

    token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="missing_bearer_token")

    if not firebase_admin._apps:
        raise HTTPException(status_code=503, detail="firebase_not_configured")

    try:
        return firebase_auth.verify_id_token(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="invalid_firebase_token") from exc
