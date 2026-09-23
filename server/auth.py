import json
import os

from fastapi import Header, HTTPException
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials


def _service_account_from_env():
    raw = os.getenv("FIREBASE_SERVICE_ACCOUNT", "").strip()
    if raw:
        try:
            return credentials.Certificate(json.loads(raw))
        except (TypeError, ValueError):
            return credentials.Certificate(raw)

    project_id = os.getenv("FIREBASE_PROJECT_ID", "").strip()
    client_email = os.getenv("FIREBASE_CLIENT_EMAIL", "").strip()
    private_key = os.getenv("FIREBASE_PRIVATE_KEY", "").replace("\\n", "\n").strip()
    if project_id and client_email and private_key:
        return credentials.Certificate({
            "type": "service_account",
            "project_id": project_id,
            "private_key": private_key,
            "client_email": client_email,
            "token_uri": "https://oauth2.googleapis.com/token",
        })
    return None


def _initialize_firebase() -> None:
    if firebase_admin._apps:
        return
    service_account = _service_account_from_env()
    try:
        if service_account is not None:
            firebase_admin.initialize_app(service_account)
        else:
            firebase_admin.initialize_app()
    except Exception:
        # The service remains running so /health can expose the misconfiguration.
        # Protected routes reject requests with a clear 503 instead of disabling auth.
        return


_initialize_firebase()


def firebase_configured() -> bool:
    return bool(firebase_admin._apps)


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
