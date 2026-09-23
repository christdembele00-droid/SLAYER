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
            return

        project_id = os.getenv("FIREBASE_PROJECT_ID", "").strip()
        client_email = os.getenv("FIREBASE_CLIENT_EMAIL", "").strip()
        private_key = os.getenv("FIREBASE_PRIVATE_KEY", "").strip()

        if project_id and client_email and private_key:
            info = {
                "type": "service_account",
                "project_id": project_id,
                "private_key_id": os.getenv("FIREBASE_PRIVATE_KEY_ID", "").strip(),
                "private_key": private_key.replace("\\n", "\n"),
                "client_email": client_email,
                "client_id": os.getenv("FIREBASE_CLIENT_ID", "").strip(),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "client_x509_cert_url": os.getenv("FIREBASE_CLIENT_X509_CERT_URL", "").strip(),
                "universe_domain": "googleapis.com",
            }
            firebase_admin.initialize_app(credentials.Certificate(info))
            return

        # Google credentials provided by the runtime environment may be
        # available on managed platforms. Keep this as a fallback.
        firebase_admin.initialize_app()
    except Exception:
        # Production must provide usable Firebase credentials.
        # Auth remains unavailable when credentials are missing or invalid.
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
