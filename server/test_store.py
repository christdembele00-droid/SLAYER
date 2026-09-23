import os
import unittest

from .store import TOKEN_SINKS, catalog, obfuscated_user_id, purchase_matches_user


class StoreCatalogTests(unittest.TestCase):
    def test_catalog_contains_token_product_and_non_betting_competitions(self):
        data = catalog()
        self.assertEqual(data["product"]["id"], "slayer_tokens_099")
        self.assertGreater(data["product"]["units"], 0)
        self.assertTrue(data["rules"]["tokens_are_non_withdrawable"])
        self.assertTrue(data["rules"]["competitions_are_non_betting"])
        self.assertIn("team_gold_pack", TOKEN_SINKS)

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
