import unittest

from server.training import evaluate_training


class TrainingTest(unittest.TestCase):
    def test_training_score_is_bounded(self):
        self.assertEqual(evaluate_training("speed", 120).score, 100)
        self.assertEqual(evaluate_training("speed", -5).score, 0)

    def test_progression_points(self):
        self.assertEqual(evaluate_training("shooting", 99).progression_points, 4)


if __name__ == "__main__":
    unittest.main()
