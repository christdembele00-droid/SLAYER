import unittest

from .store import TOKEN_PRODUCTS, TOKEN_SINKS, catalog, obfuscated_user_id, purchase_matches_user


class StoreCatalogTests(unittest.TestCase):
    def test_catalog_contains_all_token_tiers(self):
        data = catalog()
        self.assertEqual(len(data["products"]), 8)
        self.assertEqual(data["products"][0]["id"], "slayer_tokens_099")
        self.assertEqual(data["products"][-1]["id"], "slayer_tokens_19999")
        self.assertEqual(data["products"][0]["basePriceUsd"], 0.99)
        self.assertEqual(data["products"][-1]["basePriceUsd"], 199.99)
        self.assertEqual(data["products"][0]["tokenUnits"], 100)
        self.assertEqual(data["products"][-1]["tokenUnits"], 40000)
        self.assertTrue(data["rules"]["tokens_are_non_withdrawable"])
        self.assertTrue(data["rules"]["competitions_are_non_betting"])
        self.assertIn("team_classic_pack", TOKEN_SINKS)
        self.assertIn("team_gold_pack", TOKEN_SINKS)
        self.assertIn("shirt_pack", TOKEN_SINKS)
        self.assertIn("career_points_100", TOKEN_SINKS)

    def test_product_ids_are_unique(self):
        self.assertEqual(len(TOKEN_PRODUCTS), len(set(TOKEN_PRODUCTS)))

    def test_obfuscated_user_binding(self):
        uid = "firebase-user-123"
        self.assertEqual(len(obfuscated_user_id(uid)), 64)
        self.assertTrue(
            purchase_matches_user(
                {"obfuscatedExternalAccountId": obfuscated_user_id(uid)},
                uid,
            )
        )
        self.assertFalse(
            purchase_matches_user(
                {"obfuscatedExternalAccountId": obfuscated_user_id("other")},
                uid,
            )
        )


if __name__ == "__main__":
    unittest.main()
