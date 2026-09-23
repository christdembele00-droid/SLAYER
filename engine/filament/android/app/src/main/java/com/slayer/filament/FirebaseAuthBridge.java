package com.slayer.filament;

import android.util.Log;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;

public final class FirebaseAuthBridge {
    private static final String TAG = "SLAYER_AUTH";

    private FirebaseAuthBridge() {}

    public interface AuthCallback {
        void onResult(boolean success, FirebaseUser user, String message);
    }

    public static boolean isSignedIn() {
        return FirebaseAuth.getInstance().getCurrentUser() != null;
    }

    public static FirebaseUser currentUser() {
        return FirebaseAuth.getInstance().getCurrentUser();
    }

    public static void ensureSignedIn(AuthCallback callback) {
        FirebaseAuth auth = FirebaseAuth.getInstance();
        FirebaseUser current = auth.getCurrentUser();
        if (current != null) {
            callback.onResult(true, current, "signed_in");
            return;
        }

        // Anonymous Firebase identity keeps the game usable before a full
        // account provider is connected. The UID remains verifiable server-side.
        auth.signInAnonymously().addOnCompleteListener(task -> {
            if (task.isSuccessful() && task.getResult() != null
                    && task.getResult().getUser() != null) {
                FirebaseUser user = task.getResult().getUser();
                callback.onResult(true, user, "anonymous_signed_in");
            } else {
                String message = task.getException() == null
                        ? "anonymous_sign_in_failed"
                        : task.getException().getMessage();
                Log.e(TAG, "Firebase authentication failed", task.getException());
                callback.onResult(false, null, message == null ? "firebase_auth_failed" : message);
            }
        });
    }

    public static void requestIdToken(TokenCallback callback) {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) {
            callback.onToken(null);
            return;
        }
        user.getIdToken(true).addOnCompleteListener(task -> {
            if (task.isSuccessful() && task.getResult() != null) {
                callback.onToken(task.getResult().getToken());
            } else {
                Log.e(TAG, "Unable to refresh Firebase ID token", task.getException());
                callback.onToken(null);
            }
        });
    }

    public interface TokenCallback {
        void onToken(String token);
    }
}
