package com.slayer.filament;

import android.app.Activity;
import android.util.Log;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClient.ProductType;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.android.gms.tasks.Tasks;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * SLAYER Google Play Billing bridge.
 *
 * The client never grants tokens locally. It forwards the purchase token to
 * the authenticated SLAYER backend, which verifies the purchase with Google
 * Play before changing the wallet.
 */
public final class SLAYERBillingManager implements PurchasesUpdatedListener {
    public static final String TOKEN_PRODUCT_ID = "slayer_tokens_099";

    public interface Listener {
        void onStoreReady(ProductDetails tokenProduct);
        void onWalletUpdated(long balance);
        void onPurchasePending();
        void onStoreError(String message);
    }

    private final Activity activity;
    private final Listener listener;
    private final BillingClient billingClient;
    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();

    private ProductDetails tokenProduct;

    public SLAYERBillingManager(Activity activity, Listener listener) {
        this.activity = activity;
        this.listener = listener;
        this.billingClient = BillingClient.newBuilder(activity)
            .setListener(this)
            .enableAutoServiceReconnection()
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder()
                    .enableOneTimeProducts()
                    .build())
            .build();
    }

    public void start() {
        billingClient.startConnection(new BillingClientStateListenerCompat() {
            @Override
            public void onBillingSetupFinished(BillingResult result) {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    error("Google Play Billing indisponible: " + result.getDebugMessage());
                    return;
                }
                queryTokenProduct();
                restorePurchases();
            }
        });
    }

    private void queryTokenProduct() {
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        products.add(
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(TOKEN_PRODUCT_ID)
                .setProductType(ProductType.INAPP)
                .build()
        );

        QueryProductDetailsParams params =
            QueryProductDetailsParams.newBuilder()
                .setProductList(products)
                .build();

        billingClient.queryProductDetailsAsync(params, (result, productResult) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                error("Impossible de charger la boutique: " + result.getDebugMessage());
                return;
            }
            if (productResult.getProductDetailsList().isEmpty()) {
                error("Le produit SLAYER Tokens à 0,99 $ n'est pas configuré dans Google Play.");
                return;
            }
            tokenProduct = productResult.getProductDetailsList().get(0);
            listener.onStoreReady(tokenProduct);
        });
    }

    public boolean buyTokenPack() {
        if (!billingClient.isReady() || tokenProduct == null) {
            error("Boutique SLAYER non prête.");
            return false;
        }

        ProductDetails.OneTimePurchaseOfferDetails offer =
            tokenProduct.getOneTimePurchaseOfferDetails();

        BillingFlowParams.ProductDetailsParams.Builder details =
            BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(tokenProduct);

        if (offer != null && offer.getOfferToken() != null) {
            details.setOfferToken(offer.getOfferToken());
        }

        BillingFlowParams flowParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(List.of(details.build()))
            .build();

        BillingUserContext.apply(flowParams, currentUserHash());
        BillingResult launch = billingClient.launchBillingFlow(activity, flowParams);
        if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            error("Achat impossible: " + launch.getDebugMessage());
            return false;
        }
        return true;
    }

    public void restorePurchases() {
        if (!billingClient.isReady()) return;
        QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
            .setProductType(ProductType.INAPP)
            .build();
        billingClient.queryPurchasesAsync(params, (result, purchases) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) return;
            for (Purchase purchase : purchases) {
                processPurchase(purchase);
            }
        });
    }

    @Override
    public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase purchase : purchases) processPurchase(purchase);
            return;
        }
        if (result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            return;
        }
        if (result.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            restorePurchases();
            return;
        }
        error("Achat non finalisé: " + result.getDebugMessage());
    }

    private void processPurchase(Purchase purchase) {
        if (!purchase.getProducts().contains(TOKEN_PRODUCT_ID)) return;

        if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
            listener.onPurchasePending();
            return;
        }
        if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) {
            error("Achat non valide ou annulé.");
            return;
        }

        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        String api = BuildConfig.SLAYER_API_URL;
        if (user == null || api == null || api.isBlank()) {
            error("SLAYER doit être connecté au serveur pour valider l'achat.");
            return;
        }

        networkExecutor.execute(() -> {
            try {
                String idToken = Tasks.await(user.getIdToken(true)).getToken();
                if (idToken == null || idToken.isBlank()) {
                    error("Session SLAYER invalide.");
                    return;
                }

                JSONObject body = new JSONObject();
                body.put("productId", TOKEN_PRODUCT_ID);
                body.put("purchaseToken", purchase.getPurchaseToken());

                HttpURLConnection connection =
                    (HttpURLConnection) URI.create(api + "/api/store/google-play/verify").toURL().openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(15000);
                connection.setDoOutput(true);
                connection.setRequestProperty("Authorization", "Bearer " + idToken);
                connection.setRequestProperty("Content-Type", "application/json");

                byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(bytes);
                }

                int status = connection.getResponseCode();
                BufferedReader reader = new BufferedReader(
                    new InputStreamReader(
                        status >= 400 ? connection.getErrorStream() : connection.getInputStream(),
                        StandardCharsets.UTF_8));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) response.append(line);

                if (status < 200 || status >= 300) {
                    error("Validation serveur refusée (" + status + ").");
                    return;
                }

                JSONObject verified = new JSONObject(response.toString());
                listener.onWalletUpdated(verified.optLong("balance", 0));

                // The secure backend performs Google acknowledgement/consumption.
                // The client intentionally never grants or consumes the purchase itself.
            } catch (Exception ex) {
                Log.e("SLAYER_BILLING", "Purchase verification failed", ex);
                error("Impossible de valider l'achat pour le moment.");
            }
        });
    }

    private String currentUserHash() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        return user == null ? null : sha256(user.getUid());
    }

    private static String sha256(String input) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder out = new StringBuilder();
            for (byte b : digest) out.append(String.format("%02x", b));
            return out.substring(0, Math.min(64, out.length()));
        } catch (Exception e) {
            return "";
        }
    }

    private void error(String message) {
        activity.runOnUiThread(() -> listener.onStoreError(message));
    }

    public void stop() {
        networkExecutor.shutdownNow();
        if (billingClient.isReady()) billingClient.endConnection();
    }

    /**
     * Small compatibility adapter so MainActivity does not depend on a
     * concrete BillingClient state listener implementation.
     */
    private abstract static class BillingClientStateListenerCompat
        implements BillingClientStateListener {
    }

    private interface BillingClientStateListener {
        void onBillingSetupFinished(BillingResult result);
    }

    /**
     * Android BillingFlowParams is immutable; this helper documents where the
     * obfuscated account identifier belongs. Build-time integration can attach
     * the hash directly once the production Billing API surface is enabled.
     */
    private static final class BillingUserContext {
        static void apply(BillingFlowParams.Builder builder, String obfuscatedId) {
            if (obfuscatedId != null && !obfuscatedId.isBlank()) {
                builder.setObfuscatedAccountId(obfuscatedId);
            }
        }
    }
}
