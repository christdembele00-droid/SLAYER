import unittest
from server.matchmaking import Matchmaking, Ticket

class MatchmakingSmokeTest(unittest.TestCase):
    def test_compatible_players_match(self):
        mm=Matchmaking()
        mm.queue.extend([
            Ticket("p1","eu","Friendly","0.1.0",1000,1.0),
            Ticket("p2","eu","Friendly","0.1.0",1100,2.0),
        ])
        pair=mm.match()
        self.assertIsNotNone(pair)
        self.assertEqual({pair[0].player_id,pair[1].player_id},{"p1","p2"})

if __name__=="__main__":
    unittest.main()