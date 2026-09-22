import unittest

from server.competition import round_robin


class CompetitionTest(unittest.TestCase):
    def test_even_league_has_double_round_robin(self):
        self.assertEqual(len(round_robin(["a", "b", "c", "d"])), 12)

    def test_odd_league_has_no_bye_fixture(self):
        fixtures = round_robin(["a", "b", "c"])
        self.assertEqual(len(fixtures), 6)
        self.assertTrue(all("__BYE__" not in (f.home_id, f.away_id) for f in fixtures))


if __name__ == "__main__":
    unittest.main()
