#pragma once

#include <cstddef>
#include <cstdint>
#include <cstring>
#include "net/NetcodeClient.hpp"

namespace Slayer::Net {

class BinaryProtocol {
public:
    static constexpr uint8_t VERSION = 1;
    static constexpr uint8_t MAX_PLAYERS = 22;
    static constexpr std::size_t HEADER_BYTES = 10;
    static constexpr std::size_t BALL_BYTES = 26;
    static constexpr std::size_t PLAYER_BYTES = 19;

    static bool DeserializeSnapshot(const uint8_t* buffer, std::size_t length,
                                    AuthoritativeSnapshot& out) {
        if (!buffer || length < HEADER_BYTES + BALL_BYTES) return false;

        std::size_t offset = 0;
        if (buffer[offset++] != VERSION) return false;

        out.serverTick = readU32BE(buffer + offset);
        offset += 4;
        out.lastProcessedSequence = readU32BE(buffer + offset);
        offset += 4;

        const uint8_t count = buffer[offset++];
        if (count > MAX_PLAYERS) return false;

        const std::size_t expected =
            HEADER_BYTES + BALL_BYTES +
            static_cast<std::size_t>(count) * PLAYER_BYTES;
        if (length != expected) return false;

        out.ballPosition = {
            readF32BE(buffer + offset),
            readF32BE(buffer + offset + 4),
            readF32BE(buffer + offset + 8)
        };
        offset += 12;

        out.ballVelocity = {
            readF32BE(buffer + offset),
            readF32BE(buffer + offset + 4),
            readF32BE(buffer + offset + 8)
        };
        offset += 12;

        const uint16_t owner = readU16BE(buffer + offset);
        out.ballOwnerId = owner == 0xffffu ? -1 : static_cast<int16_t>(owner);
        offset += 2;

        out.players.clear();
        out.players.reserve(count);

        for (uint8_t i = 0; i < count; ++i) {
            PlayerSnapshot player{};
            player.networkId = readU16BE(buffer + offset);
            offset += 2;
            player.team = buffer[offset++];

            player.position = {
                readF32BE(buffer + offset),
                0.0f,
                readF32BE(buffer + offset + 4)
            };
            offset += 8;

            player.rotationY = readF32BE(buffer + offset);
            offset += 4;
            player.stateFlags = readU32BE(buffer + offset);
            offset += 4;

            out.players.push_back(player);
        }

        return offset == length;
    }

private:
    static uint16_t readU16BE(const uint8_t* p) {
        return static_cast<uint16_t>(
            (static_cast<uint16_t>(p[0]) << 8) | p[1]);
    }

    static uint32_t readU32BE(const uint8_t* p) {
        return (static_cast<uint32_t>(p[0]) << 24) |
               (static_cast<uint32_t>(p[1]) << 16) |
               (static_cast<uint32_t>(p[2]) << 8) |
               static_cast<uint32_t>(p[3]);
    }

    static float readF32BE(const uint8_t* p) {
        const uint32_t bits = readU32BE(p);
        float value{};
        std::memcpy(&value, &bits, sizeof(value));
        return value;
    }
};

} // namespace Slayer::Net
