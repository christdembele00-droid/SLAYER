# Firebase Android setup

The native SLAYER module now includes Firebase Authentication through the Firebase Android BoM 34.19.0.

Before a release build, register the Android application in the Firebase project and place the downloaded `google-services.json` in:

`benchmarks/filament-v0.1/android/app/google-services.json`

The file contains project identifiers rather than server secrets, but it should still match the exact Android application ID registered in Firebase.

Authentication flow:

1. Firebase Auth signs the user in.
2. FirebaseAuthBridge obtains a short-lived ID token.
3. The token is sent to the SLAYER service over HTTPS/WSS.
4. The server verifies the token with Firebase Admin.
5. Firestore stores profiles, rooms and chat metadata.
6. WebSocket carries transient match inputs/snapshots.

Do not put Firebase Admin credentials or the Cloudinary API secret in the APK.

The Firebase Android setup follows the official Firebase Android guidance and uses the BoM so individual Firebase library versions stay aligned.
