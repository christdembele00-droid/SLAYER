import hashlib
import json
import os
from typing import Any

import requests
from google.auth.transport.requests import AuthorizedSession
from google.oauth2 import service_account

PLAY_SCOPE = "https://www.googleapis.com/auth/androidpublisher"
PACKAGE_NAME = os.getenv("SLAYER_ANDROID_PACKAGE", "com.slayer.filament")

PRODUCTS = {
    # Google Play product price is configured in Play Console. The app displays
    # Google's localized price; the server only cares about the product ID.
    "slayer_tokens_099": {
        "kind": "consumable_tokens",
        "units": int(os.getenv("SLAYER_TOKENS_099_AMOUNT", "100")),
    },
}

TOKEN_SINKS = {
    "career_points_100": 100,
    "player_unlock": 250,
    "team_classic_pack": 1000,
    "team_gold_pack": 1500,
    "team_all_star_pack": 2000,
    "competition_host": 500,
}


class StoreError(RuntimeError):
    pass


def catalog() -> dict[str, Any]:
    return {
        "product": {
            "id": "slayer_tokens_099",
            "kind": "consumable",
            "description": "Pack de jetons SLAYER",
            "units": PRODUCTS["slayer_tokens_099"]["units"],
        },
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
    if product_id not in PRODUCTS:
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
    if product_id not in PRODUCTS:
        raise StoreError("product_not_allowed")

    session = _play_session()
    response = session.post(_purchase_url(product_id, purchase_token) + ":consume", timeout=15)
    if response.status_code not in (200, 204):
        raise StoreError(f"google_play_consume_failed:{response.status_code}")


def obfuscated_user_id(uid: str) -> str:
    return hashlib.sha256(uid.encode("utf-8")).hexdigest()[:64]


def purchase_matches_user(purchase_payload: dict[str, Any], uid: str) -> bool:
    external = purchase_payload.get("obfuscatedExternalAccountId")
    return not external or external == obfuscated_user_id(uid)
