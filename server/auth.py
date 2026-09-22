import os
from fastapi import Header,HTTPException
import firebase_admin
from firebase_admin import auth as firebase_auth,credentials
if not firebase_admin._apps:
    path=os.getenv("FIREBASE_SERVICE_ACCOUNT")
    if path: firebase_admin.initialize_app(credentials.Certificate(path))
    else: firebase_admin.initialize_app()
def require_bearer(authorization:str|None=Header(default=None)):
    token=authorization[7:] if authorization and authorization.startswith("Bearer ") else None
    if not token:
        if os.getenv("SLAYER_AUTH_REQUIRED","0")=="1": raise HTTPException(401,"missing_bearer_token")
        return None
    if not firebase_admin._apps: raise HTTPException(503,"firebase_not_configured")
    try:return firebase_auth.verify_id_token(token)
    except Exception as exc: raise HTTPException(401,"invalid_firebase_token") from exc
