from fastapi import APIRouter,Depends
from .db import health_db
from .auth import require_bearer
router=APIRouter(prefix="/api")
@router.get("/health")
def api_health(_=Depends(require_bearer)): health_db(); return {"status":"ok","database":"ok"}
@router.get("/profile")
def profile(_=Depends(require_bearer)): return {"service":"profile","status":"ready"}
@router.get("/matches")
def matches(_=Depends(require_bearer)): return {"items":[]}
