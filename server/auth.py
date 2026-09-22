import os
from fastapi import Header,HTTPException
def require_bearer(authorization:str|None=Header(default=None)):
    if os.getenv("SLAYER_AUTH_REQUIRED","0")!="1": return None
    if not authorization or not authorization.startswith("Bearer "): raise HTTPException(401,"missing_bearer_token")
    return authorization[7:]
