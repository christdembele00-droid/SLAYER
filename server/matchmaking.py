from dataclasses import dataclass
from threading import RLock
from typing import Optional


@dataclass(frozen=True)
class Ticket:
    player_id: str
    region: str
    mode: str
    version: str
    skill: float
    created_at: float


class Matchmaking:
    def __init__(self) -> None:
        self.queue: list[Ticket] = []
        self._lock = RLock()

    def enqueue(self, ticket: Ticket) -> Optional[tuple[Ticket, Ticket]]:
        with self._lock:
            self.queue = [t for t in self.queue if t.player_id != ticket.player_id]
            self.queue.append(ticket)
            return self.match()

    @staticmethod
    def _regions_compatible(a: Ticket, b: Ticket) -> bool:
        return a.region == "auto" or b.region == "auto" or a.region == b.region

    def match(self) -> Optional[tuple[Ticket, Ticket]]:
        with self._lock:
            for i, a in enumerate(self.queue):
                for j in range(i + 1, len(self.queue)):
                    b = self.queue[j]
                    if (
                        a.mode == b.mode
                        and a.version == b.version
                        and self._regions_compatible(a, b)
                        and abs(a.skill - b.skill) <= 250
                    ):
                        self.queue.pop(j)
                        self.queue.pop(i)
                        return a, b
            return None
