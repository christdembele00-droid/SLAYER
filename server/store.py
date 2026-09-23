import hashlib
import json
import os
from typing import Any

from google.auth.transport.requests import AuthorizedSession
from google.oauth2 import service_account

PLAY_SCOPE = "https://www.googleapis.com/auth/androidpublisher"
PACKAGE_NAME = os.getenv("SLAYER_ANDROID_PACKAGE", "com.slayer.filament")

# Product configuration is authoritative on the server for how many virtual
# tokens each Google Play consumable grants. Google Play remains authoritative
# for the actual localized price shown to the user.
TOKEN_PRODUCTS = {
    "slayer_tokens_099": {"usd": 0.99, "units": 100},
    "slayer_tokens_499": {"usd": 4.99, "units": 550},
    "slayer_tokens_999": {"usd": 9.99, "units": 1200},
    "slayer_tokens_1999": {"usd": 19.99, "units": 2500},
    "slayer_tokens_4999": {"usd": 49.99, "units": 7000},
    "slayer_tokens_9999": {"usd": 99.99, "units": 16000},
    "slayer_tokens_14999": {"usd": 149.99, "units": 26000},
    "slayer_tokens_19999": {"usd": 199.99, "units": 40000},
}

TOKEN_SINKS = {
    "career_points_100": 100,
    "player_unlock": 250,
    "shirt_pack": 300,
    "team_classic_pack": 1000,
    "team_gold_pack": 1500,
    "team_all_star_pack": 2000,
    "competition_host": 500,
}


class StoreError(RuntimeError):
    pass


def catalog() -> dict[str, Any]:
    return {
        "currency": "SLAYER_TOKEN",
        "products": [
            {
                "id": product_id,
                "kind": "consumable",
                "basePriceUsd": data["usd"],
                "tokenUnits": data["units"],
            }
            for product_id, data in TOKEN_PRODUCTS.items()
        ],
        "sinks": [
            {"id": item_id, "tokenCost": cost}
            for item_id, cost in TOKEN_SINKS.items()
        ],
        "rules": {
            "tokens_are_virtual": True,
            "tokens_are_non_withdrawable": True,
            "competitions_are_non_betting": True,
        },
    }


def _service_account_credentials():
    raw = os.getenv("SLAYER_PLAY_SERVICE_ACCOUNT_JSON")
    path = os.getenv("SLAYER_PLAY_SERVICE_ACCOUNT_FILE")
    if raw:
        return service_account.Credentials.from_service_account_info(
            json.loads(raw),
            scopes=[PLAY_SCOPE],
        )
    if path:
        return service_account.Credentials.from_service_account_file(
            path,
            scopes=[PLAY_SCOPE],
        )
    raise StoreError("google_play_service_account_not_configured")


def _play_session() -> AuthorizedSession:
    return AuthorizedSession(_service_account_credentials())


def _purchase_url(product_id: str, purchase_token: str) -> str:
    return (
        "https://androidpublisher.googleapis.com/androidpublisher/v3/"
        f"applications/{PACKAGE_NAME}/purchases/products/{product_id}/tokens/"
        f"{purchase_token}"
    )


def verify_google_play_product(product_id: str, purchase_token: str) -> dict[str, Any]:
    if product_id not in TOKEN_PRODUCTS:
        raise StoreError("product_not_allowed")
    if not purchase_token or len(purchase_token) > 4096:
        raise StoreError("purchase_token_invalid")

    session = _play_session()
    response = session.get(_purchase_url(product_id, purchase_token), timeout=15)
    if response.status_code != 200:
        raise StoreError(f"google_play_verification_failed:{response.status_code}")

    payload = response.json()
    purchase_state = payload.get("purchaseState")
    if purchase_state != 0:
        if purchase_state == 2:
            raise StoreError("purchase_pending")
        raise StoreError("purchase_not_purchased")

    return payload


def consume_google_play_product(product_id: str, purchase_token: str) -> None:
    if product_id not in TOKEN_PRODUCTS:
        raise StoreError("product_not_allowed")

    session = _play_session()
    response = session.post(
        _purchase_url(product_id, purchase_token) + ":consume",
        timeout=15,
    )
    if response.status_code not in (200, 204):
        raise StoreError(f"google_play_consume_failed:{response.status_code}")


def obfuscated_user_id(uid: str) -> str:
    return hashlib.sha256(uid.encode("utf-8")).hexdigest()[:64]


def purchase_matches_user(purchase_payload: dict[str, Any], uid: str) -> bool:
    external = purchase_payload.get("obfuscatedExternalAccountId")
    return not external or external == obfuscated_user_id(uid)
