from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from sqlalchemy import text

from .auth import require_bearer
from .db import engine, health_db
from .store import (
    TOKEN_PRODUCTS,
    TOKEN_SINKS,
    StoreError,
    catalog,
    consume_google_play_product,
    obfuscated_user_id,
    purchase_matches_user,
    verify_google_play_product,
)

router = APIRouter(prefix="/api")


class GooglePlayVerifyRequest(BaseModel):
    productId: str = Field(min_length=1, max_length=64)
    purchaseToken: str = Field(min_length=1, max_length=4096)


class StoreSpendRequest(BaseModel):
    itemId: str = Field(min_length=1, max_length=64)


@router.get("/health")
def api_health():
    health_db()
    return {"status": "ok", "database": "ok"}


@router.get("/profile")
def profile(_=Depends(require_bearer)):
    return {"service": "profile", "status": "ready"}


@router.get("/matches")
def matches(_=Depends(require_bearer)):
    return {"items": []}


@router.get("/store/catalog")
def store_catalog():
    return catalog()


@router.get("/store/wallet")
def wallet(user=Depends(require_bearer)):
    uid = str(user.get("uid", ""))
    if not uid:
        raise HTTPException(status_code=401, detail="invalid_user")

    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO wallets (user_id, balance) VALUES (:uid, 0) "
                "ON CONFLICT(user_id) DO NOTHING"
            ),
            {"uid": uid},
        )
        row = connection.execute(
            text("SELECT balance FROM wallets WHERE user_id = :uid"),
            {"uid": uid},
        ).first()

    return {"balance": int(row[0] if row else 0)}


@router.post("/store/google-play/verify")
def verify_google_play_purchase(
    request: GooglePlayVerifyRequest,
    user=Depends(require_bearer),
):
    uid = str(user.get("uid", ""))
    if not uid:
        raise HTTPException(status_code=401, detail="invalid_user")

    product = TOKEN_PRODUCTS.get(request.productId)
    if not product:
        raise HTTPException(status_code=400, detail="product_not_allowed")

    try:
        purchase = verify_google_play_product(
            request.productId,
            request.purchaseToken,
        )
        if not purchase_matches_user(purchase, uid):
            raise StoreError("purchase_user_mismatch")
    except StoreError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    granted_units = int(product["units"])

    with engine.begin() as connection:
        existing = connection.execute(
            text(
                "SELECT user_id, granted_units, status FROM store_purchases "
                "WHERE purchase_token = :token"
            ),
            {"token": request.purchaseToken},
        ).first()

        if existing and existing[0] != uid:
            raise HTTPException(status_code=403, detail="purchase_user_mismatch")

        if not existing:
            connection.execute(
                text(
                    "INSERT INTO store_purchases "
                    "(purchase_token, user_id, product_id, granted_units, status) "
                    "VALUES (:token, :uid, :product, 0, 'pending_consume') "
                    "ON CONFLICT(purchase_token) DO NOTHING"
                ),
                {
                    "token": request.purchaseToken,
                    "uid": uid,
                    "product": request.productId,
                },
            )

        connection.execute(
            text(
                "INSERT INTO wallets (user_id, balance) VALUES (:uid, 0) "
                "ON CONFLICT(user_id) DO NOTHING"
            ),
            {"uid": uid},
        )

        current = connection.execute(
            text(
                "SELECT granted_units, status FROM store_purchases "
                "WHERE purchase_token = :token"
            ),
            {"token": request.purchaseToken},
        ).first()

        if not current:
            raise HTTPException(status_code=500, detail="purchase_record_missing")

        if current[1] == "granted":
            wallet = connection.execute(
                text("SELECT balance FROM wallets WHERE user_id = :uid"),
                {"uid": uid},
            ).first()
            return {
                "status": "granted",
                "grantedUnits": int(current[0]),
                "balance": int(wallet[0] if wallet else 0),
            }

    # Google Play may report a consumable already consumed. In that case the
    # server can safely finalize a pending ledger record without consuming twice.
    try:
        consumption_state = purchase.get("consumptionState")
        if consumption_state != 1:
            consume_google_play_product(request.productId, request.purchaseToken)
    except StoreError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    # Atomic idempotency gate: exactly one request can move this purchase from
    # pending_consume -> granted and therefore receive the token credit.
    with engine.begin() as connection:
        granted = connection.execute(
            text(
                "UPDATE store_purchases SET granted_units = :units, status = 'granted', "
                "consumed_at = CURRENT_TIMESTAMP "
                "WHERE purchase_token = :token AND user_id = :uid "
                "AND status = 'pending_consume'"
            ),
            {
                "units": granted_units,
                "token": request.purchaseToken,
                "uid": uid,
            },
        )
        if granted.rowcount == 1:
            connection.execute(
                text(
                    "UPDATE wallets SET balance = balance + :units, "
                    "updated_at = CURRENT_TIMESTAMP WHERE user_id = :uid"
                ),
                {"units": granted_units, "uid": uid},
            )

        row = connection.execute(
            text("SELECT balance FROM wallets WHERE user_id = :uid"),
            {"uid": uid},
        ).first()
        purchase_row = connection.execute(
            text("SELECT granted_units, status FROM store_purchases WHERE purchase_token = :token"),
            {"token": request.purchaseToken},
        ).first()

    return {
        "status": str(purchase_row[1]) if purchase_row else "pending_consume",
        "productId": request.productId,
        "grantedUnits": int(purchase_row[0]) if purchase_row else 0,
        "balance": int(row[0] if row else 0),
    }


@router.post("/store/spend")
def spend_tokens(
    request: StoreSpendRequest,
    user=Depends(require_bearer),
):
    uid = str(user.get("uid", ""))
    if not uid:
        raise HTTPException(status_code=401, detail="invalid_user")

    cost = TOKEN_SINKS.get(request.itemId)
    if cost is None:
        raise HTTPException(status_code=400, detail="item_not_allowed")

    spend_id = uuid4().hex
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO wallets (user_id, balance) VALUES (:uid, 0) "
                "ON CONFLICT(user_id) DO NOTHING"
            ),
            {"uid": uid},
        )
        result = connection.execute(
            text(
                "UPDATE wallets SET balance = balance - :cost, "
                "updated_at = CURRENT_TIMESTAMP "
                "WHERE user_id = :uid AND balance >= :cost"
            ),
            {"cost": cost, "uid": uid},
        )
        if result.rowcount != 1:
            raise HTTPException(status_code=409, detail="insufficient_tokens")

        connection.execute(
            text(
                "INSERT INTO store_spends "
                "(id, user_id, item_id, token_cost) "
                "VALUES (:id, :uid, :item, :cost)"
            ),
            {"id": spend_id, "uid": uid, "item": request.itemId, "cost": cost},
        )
        row = connection.execute(
            text("SELECT balance FROM wallets WHERE user_id = :uid"),
            {"uid": uid},
        ).first()

    return {
        "status": "spent",
        "itemId": request.itemId,
        "tokenCost": cost,
        "balance": int(row[0] if row else 0),
    }
