#pragma once
#include <cstdint>
namespace slayer {
enum class GameMode : uint8_t { QuickMatch, Friendly, Training, Cup, League, Season, Career };
struct PlayerProfile { uint32_t id=0; char name[48]{}; uint16_t age=18; uint16_t overall=70; };
struct TeamProfile { uint32_t id=0; char name[48]{}; uint32_t players=11; };
struct SaveHeader { uint32_t version=1; uint32_t profileId=0; uint64_t timestamp=0; };
}