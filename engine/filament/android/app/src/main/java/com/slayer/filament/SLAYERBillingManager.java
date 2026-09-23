package com.slayer.filament;

import android.app.Activity;
import android.util.Log;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryProductDetailsResult;
import com.android.billingclient.api.QueryPurchasesParams;
import com.android.billingclient.api.UnfetchedProduct;
import com.google.android.gms.tasks.Tasks;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Native SLAYER Google Play Billing bridge.
 *
 * All token packs are consumable one-time products. The Google Play price is
 * displayed from ProductDetails (and can therefore be localized), while the
 * SLAYER backend determines the token grant for each product ID.
 */
public final class SLAYERBillingManager implements PurchasesUpdatedListener {
    public static final String[] TOKEN_PRODUCT_IDS = {
        "slayer_tokens_099",
        "slayer_tokens_499",
        "slayer_tokens_999",
        "slayer_tokens_1999",
        "slayer_tokens_4999",
        "slayer_tokens_9999",
        "slayer_tokens_14999",
        "slayer_tokens_19999"
    };

    public interface Listener {
        void onStoreReady(List<ProductDetails> products);
        void onWalletUpdated(long balance);
        void onPurchasePending();
        void onStoreError(String message);
    }

    private final Activity activity;
    private final Listener listener;
    private final BillingClient billingClient;
    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();
    private final Map<String, ProductDetails> productsById = new HashMap<>();

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
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult result) {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    error("Google Play Billing indisponible: " + result.getDebugMessage());
                    return;
                }
                queryProducts();
                restorePurchases();
            }

            @Override
            public void onBillingServiceDisconnected() {
                // Automatic service reconnection is enabled by Billing Library 8+.
            }
        });
    }

    private void queryProducts() {
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        for (String productId : TOKEN_PRODUCT_IDS) {
            products.add(
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(productId)
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build()
            );
        }

        QueryProductDetailsParams params =
            QueryProductDetailsParams.newBuilder()
                .setProductList(products)
                .build();

        billingClient.queryProductDetailsAsync(
            params,
            (BillingResult result, QueryProductDetailsResult productResult) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    error("Impossible de charger la boutique: " + result.getDebugMessage());
                    return;
                }

                productsById.clear();
                for (ProductDetails product : productResult.getProductDetailsList()) {
                    productsById.put(product.getProductId(), product);
                }

                for (UnfetchedProduct missing : productResult.getUnfetchedProductList()) {
                    Log.w("SLAYER_BILLING",
                        "Produit non récupéré: " + missing.getProductId() +
                        " code=" + missing.getStatusCode());
                }

                if (productsById.isEmpty()) {
                    error("Aucun pack de jetons SLAYER n'est configuré dans Google Play.");
                    return;
                }

                listener.onStoreReady(new ArrayList<>(productsById.values()));
            }
        );
    }

    public ProductDetails getProduct(String productId) {
        return productsById.get(productId);
    }

    public boolean buyTokenPack(String productId) {
        ProductDetails product = productsById.get(productId);
        if (!billingClient.isReady() || product == null) {
            error("Pack SLAYER non disponible: " + productId);
            return false;
        }

        List<ProductDetails.OneTimePurchaseOfferDetails> offers =
            product.getOneTimePurchaseOfferDetailsList();
        if (offers == null || offers.isEmpty()) {
            error("Aucune offre d'achat disponible pour " + productId);
            return false;
        }

        ProductDetails.OneTimePurchaseOfferDetails offer = offers.get(0);
        BillingFlowParams.ProductDetailsParams details =
            BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(product)
                .setOfferToken(offer.getOfferToken())
                .build();

        BillingFlowParams flowParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(List.of(details))
            .setObfuscatedAccountId(currentUserHash())
            .build();

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
            .setProductType(BillingClient.ProductType.INAPP)
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
        String productId = purchase.getProducts().isEmpty()
            ? null
            : purchase.getProducts().get(0);

        if (productId == null || !productsById.containsKey(productId)) return;

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
                body.put("productId", productId);
                body.put("purchaseToken", purchase.getPurchaseToken());

                HttpURLConnection connection =
                    (HttpURLConnection) URI.create(api + "/api/store/google-play/verify")
                        .toURL().openConnection();
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
                InputStreamReader source = new InputStreamReader(
                    status >= 400 ? connection.getErrorStream() : connection.getInputStream(),
                    StandardCharsets.UTF_8
                );
                try (BufferedReader reader = new BufferedReader(source)) {
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) response.append(line);

                    if (status < 200 || status >= 300) {
                        error("Validation serveur refusée (" + status + ").");
                        return;
                    }

                    JSONObject verified = new JSONObject(response.toString());
                    listener.onWalletUpdated(verified.optLong("balance", 0));
                }
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
        if (input == null || input.isBlank()) return null;
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder out = new StringBuilder();
            for (byte b : digest) out.append(String.format("%02x", b));
            return out.toString();
        } catch (Exception e) {
            return null;
        }
    }

    private void error(String message) {
        activity.runOnUiThread(() -> listener.onStoreError(message));
    }

    public void stop() {
        networkExecutor.shutdownNow();
        if (billingClient.isReady()) billingClient.endConnection();
    }
}
