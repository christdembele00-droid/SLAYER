import unittest
from server.matchmaking import Matchmaking, Ticket


class MatchmakingSmokeTest(unittest.TestCase):
    def test_compatible_players_match(self):
        mm = Matchmaking()
        mm.queue.extend([
            Ticket("p1", "eu", "Friendly", "0.1.0", 1000, 1.0),
            Ticket("p2", "eu", "Friendly", "0.1.0", 1100, 2.0),
        ])
        pair = mm.match()
        self.assertIsNotNone(pair)
        self.assertEqual(
            {pair[0].player_id, pair[1].player_id},
            {"p1", "p2"},
        )

    def test_region_mismatch_does_not_match(self):
        mm = Matchmaking()
        mm.queue.extend([
            Ticket("p1", "eu", "Friendly", "0.1.0", 1000, 1.0),
            Ticket("p2", "na", "Friendly", "0.1.0", 1000, 2.0),
        ])
        self.assertIsNone(mm.match())
        self.assertEqual(len(mm.queue), 2)

    def test_same_owner_replaces_previous_ticket(self):
        mm = Matchmaking()
        mm.enqueue(Ticket("p1", "auto", "Friendly", "0.1.0", 1000, 1.0, "uid-1"))
        mm.enqueue(Ticket("p3", "auto", "Friendly", "0.1.0", 1000, 1.5, "uid-1"))
        self.assertEqual([t.player_id for t in mm.queue], ["p3"])
        pair = mm.enqueue(Ticket("p2", "auto", "Friendly", "0.1.0", 1000, 2.0, "uid-2"))
        self.assertIsNotNone(pair)
        self.assertEqual({pair[0].owner_id, pair[1].owner_id}, {"uid-1", "uid-2"})
        self.assertEqual(mm.queue, [])


if __name__ == "__main__":
    unittest.main()
