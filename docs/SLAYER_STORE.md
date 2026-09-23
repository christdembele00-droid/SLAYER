# SLAYER Store and Virtual Economy

## Product model

SLAYER uses one initial Google Play one-time product:

- Product ID: `slayer_tokens_099`
- Type: consumable
- Intended price: **0.99 USD base price**, configured in Google Play Console.
- Token quantity: controlled by `SLAYER_TOKENS_099_AMOUNT` on the server; the initial default is 100.
- Google Play is authoritative for the displayed/localized price.

The token pack is a digital consumable. Google Play Billing is therefore the payment layer for the Android Play distribution.

## Token uses

The backend owns the token balance. Example catalog entries:

- `career_points_100`
- `player_unlock`
- `team_classic_pack`
- `team_gold_pack`
- `team_all_star_pack`
- `competition_host`

Token costs are server-controlled and can be changed without shipping a new Android binary.

The competition feature is for organizing matches/tournaments. Tokens are not wagers, there is no cash-out, and SLAYER does not award money based on tournament outcomes.

## Secure purchase lifecycle

1. Android requests the product from Google Play.
2. Google Play completes the purchase or reports it as pending.
3. SLAYER sends the purchase token to the authenticated backend.
4. The backend verifies the token with Google Play.
5. The backend checks the Firebase user binding and purchase state.
6. The backend records the purchase token exactly once.
7. The backend credits the wallet.
8. The backend consumes the Google Play consumable.

A purchase in PENDING state never credits the wallet.

The purchase token is the idempotency key. The client never trusts its own local coin count and never grants tokens solely from a successful UI callback.

## Required production configuration

Server:

- `SLAYER_PLAY_SERVICE_ACCOUNT_JSON` or `SLAYER_PLAY_SERVICE_ACCOUNT_FILE`
- `SLAYER_ANDROID_PACKAGE=com.slayer.filament`
- `SLAYER_TOKENS_099_AMOUNT`

Android build:

- `SLAYER_API_URL=https://<your-slayer-api>`

Google Play Console:

- create one-time product `slayer_tokens_099`
- configure the intended base price
- make the product active
- link the Play Console service account to the required Play Developer permissions

Never commit service-account JSON, private keys, purchase tokens, or passwords to Git.

## Design principle

The store sells game content/currency. It does not sell guaranteed competitive outcomes, and competition creation is a game feature rather than a wagering system.
