import unittest

from server.career import CareerState, Club, Season, Standing, PlayerProgression
from server.competition import round_robin
from server.training import evaluate_training


class CareerSystemTest(unittest.TestCase):
    def setUp(self):
        club = Club("atlas", "Atlas FC", budget=1000, squad=["p1"])
        standings = {cid: Standing(cid) for cid in ("atlas", "lagoon", "coast", "metro")}
        self.career = CareerState(
            club=club,
            season=Season(2026, "national-league", "atlas"),
            standings=standings,
            players={"p1": PlayerProgression("p1")},
        )

    def test_match_updates_points_and_goal_difference(self):
        self.career.apply_match_result("atlas", "lagoon", 3, 1)
        self.assertEqual(self.career.standings["atlas"].points, 3)
        self.assertEqual(self.career.standings["atlas"].goal_difference, 2)
        self.assertEqual(self.career.standings["lagoon"].points, 0)

    def test_training_progresses_player(self):
        result = evaluate_training("shooting", 100)
        self.career.players["p1"].apply_training(result.category, result.progression_points)
        self.assertGreater(self.career.players["p1"].shot_power, 60)
        self.assertGreater(self.career.players["p1"].experience, 0)

    def test_transfer_respects_budget(self):
        self.assertTrue(self.career.transfer_in("p2", 500))
        self.assertFalse(self.career.transfer_in("p3", 600))
        self.assertEqual(self.career.club.budget, 500)

    def test_round_robin_home_and_away(self):
        fixtures = round_robin(["atlas", "lagoon", "coast", "metro"])
        self.assertEqual(len(fixtures), 12)
        self.assertTrue(any(f.home_id == "atlas" and f.away_id == "lagoon" for f in fixtures))
        self.assertTrue(any(f.home_id == "lagoon" and f.away_id == "atlas" for f in fixtures))


if __name__ == "__main__":
    unittest.main()
