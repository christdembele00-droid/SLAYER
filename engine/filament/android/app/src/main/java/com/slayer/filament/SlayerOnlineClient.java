package com.slayer.filament;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.google.firebase.auth.FirebaseUser;

import org.json.JSONObject;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

public final class SlayerOnlineClient {
    private static final String TAG = "SLAYER_NET";
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
    private static final long RECONNECT_BASE_MS = 1000L;
    private static final long RECONNECT_MAX_MS = 30000L;

    public interface Listener {
        void onStatus(String status);
        void onMatchFound(String matchId);
        void onMessage(String type, JSONObject data);
    }

    private final OkHttpClient client;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Listener listener;
    private final String apiBaseUrl;
    private final boolean enabled;

    private volatile WebSocket socket;
    private volatile String token;
    private volatile String playerId;
    private volatile String matchId;
    private volatile boolean stopped = true;
    private volatile boolean reconnecting = false;
    private int reconnectAttempt = 0;
    private Request websocketRequest;

    public SlayerOnlineClient(Listener listener) {
        this.listener = listener;
        this.apiBaseUrl = normalize(BuildConfig.SLAYER_API_URL);
        this.enabled = !apiBaseUrl.isEmpty();
        this.client = new OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(0, TimeUnit.MILLISECONDS)
                .writeTimeout(10, TimeUnit.SECONDS)
                .pingInterval(15, TimeUnit.SECONDS)
                .build();
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void start() {
        stopped = false;
        if (!enabled) {
            status("SERVER_URL_MISSING");
            return;
        }
        refreshTokenAndRun(() -> health());
    }

    public void stop() {
        stopped = true;
        reconnecting = false;
        if (socket != null) {
            socket.close(1000, "client_stop");
            socket = null;
        }
        client.dispatcher().executorService().shutdown();
    }

    public void health() {
        if (stopped || !enabled) return;
        Request request = new Request.Builder()
                .url(apiBaseUrl + "/health")
                .get()
                .build();

        client.newCall(request).enqueue(new okhttp3.Callback() {
            @Override
            public void onFailure(okhttp3.Call call, IOException e) {
                Log.e(TAG, "Health check failed", e);
                status("SERVER_UNREACHABLE");
            }

            @Override
            public void onResponse(okhttp3.Call call, Response response) throws IOException {
                String body = response.body() == null ? "" : response.body().string();
                if (!response.isSuccessful()) {
                    status("SERVER_HTTP_" + response.code());
                    return;
                }
                status("SERVER_" + summarizeHealth(body));
            }
        });
    }

    public void joinMatchmaking(String mode, String region, String version, int skill) {
        if (stopped || !enabled) {
            status(enabled ? "CLIENT_STOPPED" : "SERVER_URL_MISSING");
            return;
        }
        FirebaseUser user = FirebaseAuthBridge.currentUser();
        if (user == null) {
            FirebaseAuthBridge.ensureSignedIn((success, signedUser, message) -> {
                if (success) joinMatchmaking(mode, region, version, skill);
                else status("AUTH_FAILED");
            });
            return;
        }

        FirebaseAuthBridge.requestIdToken(idToken -> {
            if (idToken == null || idToken.isBlank()) {
                status("TOKEN_REFRESH_FAILED");
                return;
            }
            token = idToken;
            playerId = "android-" + stableId(user.getUid());
            JSONObject payload = new JSONObject();
            try {
                payload.put("playerId", playerId);
                payload.put("region", (region == null || region.isBlank()) ? "auto" : region);
                payload.put("mode", (mode == null || mode.isBlank()) ? "Friendly" : mode);
                payload.put("version", (version == null || version.isBlank()) ? "0.1.0" : version);
                payload.put("skill", Math.max(0, Math.min(3000, skill)));
            } catch (Exception e) {
                status("MATCHMAKING_PAYLOAD_ERROR");
                return;
            }

            Request request = new Request.Builder()
                    .url(apiBaseUrl + "/api/matchmaking/join")
                    .header("Authorization", "Bearer " + token)
                    .header("Accept", "application/json")
                    .post(RequestBody.create(payload.toString(), JSON))
                    .build();

            client.newCall(request).enqueue(new okhttp3.Callback() {
                @Override
                public void onFailure(okhttp3.Call call, IOException e) {
                    Log.e(TAG, "Matchmaking failed", e);
                    status("MATCHMAKING_NETWORK_ERROR");
                }

                @Override
                public void onResponse(okhttp3.Call call, Response response) throws IOException {
                    String body = response.body() == null ? "" : response.body().string();
                    if (!response.isSuccessful()) {
                        Log.e(TAG, "Matchmaking HTTP " + response.code() + ": " + body);
                        status("MATCHMAKING_HTTP_" + response.code());
                        return;
                    }
                    try {
                        JSONObject result = new JSONObject(body);
                        String state = result.optString("status", "error");
                        if ("matched".equals(state)) {
                            matchId = result.optString("matchId", "");
                            if (matchId.isEmpty()) {
                                status("MATCH_ID_MISSING");
                                return;
                            }
                            status("MATCH_FOUND");
                            mainHandler.post(() -> listener.onMatchFound(matchId));
                            openWebSocket();
                        } else if ("queued".equals(state)) {
                            status("MATCHMAKING_QUEUED");
                        } else {
                            status("MATCHMAKING_ERROR");
                        }
                    } catch (Exception e) {
                        status("MATCHMAKING_BAD_RESPONSE");
                    }
                }
            });
        });
    }

    public void sendIntent(String playerId, float moveX, float moveZ, String action, float power, long clientTime) {
        WebSocket ws = socket;
        if (ws == null || !enabled || playerId == null || !playerId.equals(this.playerId)) return;
        try {
            JSONObject data = new JSONObject();
            data.put("type", "intent");
            JSONObject intent = new JSONObject();
            intent.put("playerId", playerId);
            intent.put("moveX", clamp(moveX));
            intent.put("moveZ", clamp(moveZ));
            intent.put("action", action == null ? "None" : action);
            intent.put("power", clamp(power));
            intent.put("clientTime", Math.max(0L, clientTime));
            data.put("data", intent);
            ws.send(data.toString());
        } catch (Exception e) {
            Log.e(TAG, "Intent serialization failed", e);
        }
    }

    private void openWebSocket() {
        if (stopped || token == null || playerId == null || matchId == null || matchId.isEmpty()) return;
        if (socket != null) socket.cancel();

        String wsBase = apiBaseUrl.replaceFirst("^https://", "wss://")
                .replaceFirst("^http://", "ws://");
        String url = wsBase + "/ws/" + playerId + "?match_id=" + matchId;

        websocketRequest = new Request.Builder()
                .url(url)
                .header("Authorization", "Bearer " + token)
                .build();

        status("WS_CONNECTING");
        socket = client.newWebSocket(websocketRequest, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, Response response) {
                reconnectAttempt = 0;
                reconnecting = false;
                try {
                    JSONObject auth = new JSONObject();
                    auth.put("type", "auth");
                    auth.put("token", token);
                    webSocket.send(auth.toString());
                } catch (Exception e) {
                    webSocket.close(1002, "auth_encode_error");
                }
            }

            @Override
            public void onMessage(WebSocket webSocket, String text) {
                try {
                    JSONObject packet = new JSONObject(text);
                    String type = packet.optString("type", "unknown");
                    JSONObject data = packet.optJSONObject("data");
                    status(type.equals("auth_ok") ? "WS_AUTHENTICATED" : "WS_CONNECTED");
                    if (data != null) {
                        mainHandler.post(() -> listener.onMessage(type, data));
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Invalid WebSocket message", e);
                }
            }

            @Override
            public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                Log.e(TAG, "WebSocket failure", t);
                status(response == null ? "WS_FAILURE" : "WS_HTTP_" + response.code());
                scheduleReconnect();
            }

            @Override
            public void onClosed(WebSocket webSocket, int code, String reason) {
                status("WS_CLOSED_" + code);
                scheduleReconnect();
            }
        });
    }

    private void scheduleReconnect() {
        if (stopped || reconnecting || matchId == null || matchId.isEmpty()) return;
        reconnecting = true;
        long delay = Math.min(RECONNECT_MAX_MS,
                RECONNECT_BASE_MS * (1L << Math.min(reconnectAttempt, 4)));
        reconnectAttempt++;
        mainHandler.postDelayed(() -> {
            reconnecting = false;
            refreshTokenAndRun(this::openWebSocket);
        }, delay);
    }

    private void refreshTokenAndRun(Runnable next) {
        if (stopped) return;
        FirebaseAuthBridge.requestIdToken(newToken -> {
            if (newToken == null || newToken.isBlank()) {
                status("AUTH_TOKEN_UNAVAILABLE");
                return;
            }
            token = newToken;
            next.run();
        });
    }

    private void status(String value) {
        mainHandler.post(() -> listener.onStatus(value));
    }

    private static String normalize(String value) {
        if (value == null) return "";
        String s = value.trim().replaceAll("/+$", "");
        if (!(s.startsWith("https://") || s.startsWith("http://"))) return "";
        return s;
    }

    private static float clamp(float v) {
        if (!Float.isFinite(v)) return 0f;
        return Math.max(-1f, Math.min(1f, v));
    }

    private static String stableId(String uid) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(uid.getBytes(StandardCharsets.UTF_8));
            StringBuilder out = new StringBuilder();
            for (byte b : digest) out.append(String.format("%02x", b));
            return out.substring(0, 20);
        } catch (Exception e) {
            return Integer.toHexString(uid.hashCode());
        }
    }

    private static String summarizeHealth(String json) {
        try {
            JSONObject health = new JSONObject(json);
            return health.optString("status", "unknown").toUpperCase();
        } catch (Exception e) {
            return "BAD_HEALTH";
        }
    }
}
