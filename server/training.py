from dataclasses import dataclass


@dataclass(frozen=True)
class TrainingResult:
    category: str
    score: int
    progression_points: int


def evaluate_training(category: str, score: int) -> TrainingResult:
    normalized = max(0, min(100, score))
    points = normalized // 20
    return TrainingResult(category=category, score=normalized, progression_points=points)
