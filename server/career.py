from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List


@dataclass
class PlayerProgression:
    player_id: str
    overall: int = 60
    speed: int = 60
    shot_power: int = 60
    accuracy: int = 60
    tackle: int = 60
    experience: int = 0

    def apply_training(self, category: str, points: int = 1) -> None:
        points = max(0, points)
        attr = {
            "speed": "speed",
            "shooting": "shot_power",
            "accuracy": "accuracy",
            "defending": "tackle",
        }.get(category)
        if attr:
            setattr(self, attr, min(99, getattr(self, attr) + points))
        self.experience += points
        self.overall = min(99, round((self.speed + self.shot_power + self.accuracy + self.tackle) / 4))


@dataclass
class Club:
    club_id: str
    name: str
    division: int = 1
    budget: int = 1_000_000
    squad: List[str] = field(default_factory=list)


@dataclass
class Standing:
    club_id: str
    played: int = 0
    wins: int = 0
    draws: int = 0
    losses: int = 0
    goals_for: int = 0
    goals_against: int = 0
    points: int = 0

    @property
    def goal_difference(self) -> int:
        return self.goals_for - self.goals_against

    def record(self, goals_for: int, goals_against: int) -> None:
        self.played += 1
        self.goals_for += goals_for
        self.goals_against += goals_against
        if goals_for > goals_against:
            self.wins += 1
            self.points += 3
        elif goals_for == goals_against:
            self.draws += 1
            self.points += 1
        else:
            self.losses += 1


@dataclass
class Season:
    year: int
    league_id: str
    club_id: str
    matchday: int = 0
    completed: bool = False
    trophies: List[str] = field(default_factory=list)


@dataclass
class CareerState:
    club: Club
    season: Season
    standings: Dict[str, Standing]
    players: Dict[str, PlayerProgression] = field(default_factory=dict)
    history: List[Season] = field(default_factory=list)

    def apply_match_result(self, home_id: str, away_id: str, home_goals: int, away_goals: int) -> None:
        self.standings.setdefault(home_id, Standing(home_id)).record(home_goals, away_goals)
        self.standings.setdefault(away_id, Standing(away_id)).record(away_goals, home_goals)
        self.season.matchday += 1

    def finish_season(self) -> str:
        ordered = sorted(
            self.standings.values(),
            key=lambda s: (-s.points, -s.goal_difference, -s.goals_for, s.club_id),
        )
        position = next((i + 1 for i, row in enumerate(ordered) if row.club_id == self.club.club_id), len(ordered))
        if position == 1:
            self.season.trophies.append(self.season.league_id)
        self.history.append(self.season)
        self.season = Season(self.season.year + 1, self.season.league_id, self.club.club_id)
        self.standings = {row.club_id: Standing(row.club_id) for row in ordered}
        return "champion" if position == 1 else "season_complete"

    def transfer_in(self, player_id: str, fee: int) -> bool:
        if fee < 0 or fee > self.club.budget:
            return False
        if player_id in self.club.squad:
            return False
        self.club.budget -= fee
        self.club.squad.append(player_id)
        return True

    def transfer_out(self, player_id: str, fee: int) -> bool:
        if player_id not in self.club.squad:
            return False
        self.club.squad.remove(player_id)
        self.club.budget += max(0, fee)
        return True
