package com.slayer.filament;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;

public final class FirebaseAuthBridge {
    private FirebaseAuthBridge() {}

    public static boolean isSignedIn() {
        return FirebaseAuth.getInstance().getCurrentUser() != null;
    }

    public static void requestIdToken(TokenCallback callback) {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) {
            callback.onToken(null);
            return;
        }
        user.getIdToken(false).addOnCompleteListener(task -> {
            if (task.isSuccessful() && task.getResult() != null) {
                callback.onToken(task.getResult().getToken());
            } else {
                callback.onToken(null);
            }
        });
    }

    public interface TokenCallback {
        void onToken(String token);
    }
}
