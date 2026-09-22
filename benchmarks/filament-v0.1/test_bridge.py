"""Deterministic producer for the V0.1 compact transform ABI.

This does not pretend to be the final Python runtime. It validates the data
contract that will later be connected to the SLAYER simulation core.
"""

from dataclasses import dataclass
from math import sin, cos


@dataclass(slots=True)
class Transform:
    x: float
    y: float
    z: float
    qx: float
    qy: float
    qz: float
    qw: float
    anim_id: int
    anim_time: float


def make_test_snapshot(count: int = 22, time_s: float = 0.0) -> list[Transform]:
    count = max(0, min(count, 22))
    return [
        Transform(
            x=(i % 11) * 1.2 - 6.0,
            y=0.0,
            z=(i // 11) * 3.0 - 1.5 + 0.15 * sin(time_s),
            qx=0.0,
            qy=sin(time_s * 0.5),
            qz=0.0,
            qw=cos(time_s * 0.5),
            anim_id=1 if i else 2,
            anim_time=time_s,
        )
        for i in range(count)
    ]


if __name__ == "__main__":
    snapshot = make_test_snapshot(22, 1.0)
    print(f"Generated {len(snapshot)} compact transforms")
