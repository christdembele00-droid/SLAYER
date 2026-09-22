from dataclasses import dataclass
from typing import List


@dataclass(frozen=True)
class Fixture:
    matchday: int
    home_id: str
    away_id: str
    competition: str


def round_robin(club_ids: List[str], competition: str = "league") -> List[Fixture]:
    teams = list(dict.fromkeys(club_ids))
    if len(teams) < 2:
        return []
    if len(teams) % 2:
        teams.append("__BYE__")

    fixtures: List[Fixture] = []
    rotation = teams[:]
    rounds = len(rotation) - 1

    for matchday in range(1, rounds + 1):
        half = len(rotation) // 2
        for i in range(half):
            home, away = rotation[i], rotation[-1 - i]
            if home != "__BYE__" and away != "__BYE__":
                fixtures.append(Fixture(matchday, home, away, competition))
        rotation = [rotation[0], rotation[-1], *rotation[1:-1]]

    first_leg = list(fixtures)
    for f in first_leg:
        fixtures.append(Fixture(f.matchday + rounds, f.away_id, f.home_id, competition))
    return fixtures
