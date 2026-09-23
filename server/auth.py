import json
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
            value = service_account.strip()
            if value.startswith("{"):
                firebase_admin.initialize_app(
                    credentials.Certificate(json.loads(value))
                )
            else:
                firebase_admin.initialize_app(credentials.Certificate(value))
        else:
            firebase_admin.initialize_app()
    except Exception:
        # Production must provide Firebase credentials; auth remains unavailable
        # when the service account is missing or invalid.
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
