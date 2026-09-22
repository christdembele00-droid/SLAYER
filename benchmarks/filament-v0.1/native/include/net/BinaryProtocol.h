#pragma once

#include <cstddef>
#include <cstdint>
#include <cstring>
#include "net/NetcodeClient.hpp"

namespace Slayer::Net {

#pragma pack(push, 1)
struct BinaryHeader {
    uint8_t protocolVersion{1};
    uint32_t serverTick{0};
    uint32_t lastProcessedSequence{0};
    uint8_t playerCount{0};
};

struct PackedBall {
    float posX{0.0f}, posY{0.0f}, posZ{0.0f};
    float velX{0.0f}, velY{0.0f}, velZ{0.0f};
    int16_t ownerId{-1};
};

struct PackedPlayer {
    uint16_t networkId{0};
    uint8_t team{0};
    float posX{0.0f}, posZ{0.0f};
    float rotationY{0.0f};
    uint32_t stateFlags{0};
};
#pragma pack(pop)

class BinaryProtocol {
public:
    static constexpr uint8_t VERSION = 1;
    static constexpr uint8_t MAX_PLAYERS = 22;

    static bool DeserializeSnapshot(const uint8_t* buffer, std::size_t length,
                                    AuthoritativeSnapshot& out) {
        if (buffer == nullptr ||
            length < sizeof(BinaryHeader) + sizeof(PackedBall)) {
            return false;
        }

        std::size_t offset = 0;
        BinaryHeader header{};
        std::memcpy(&header, buffer + offset, sizeof(header));
        offset += sizeof(header);

        if (header.protocolVersion != VERSION ||
            header.playerCount > MAX_PLAYERS) {
            return false;
        }

        const std::size_t expected =
            sizeof(BinaryHeader) + sizeof(PackedBall) +
            static_cast<std::size_t>(header.playerCount) * sizeof(PackedPlayer);

        if (length != expected) {
            return false;
        }

        out.serverTick = header.serverTick;
        out.lastProcessedSequence = header.lastProcessedSequence;

        PackedBall ball{};
        std::memcpy(&ball, buffer + offset, sizeof(ball));
        offset += sizeof(ball);

        out.ballPosition = {ball.posX, ball.posY, ball.posZ};
        out.ballVelocity = {ball.velX, ball.velY, ball.velZ};
        out.ballOwnerId = ball.ownerId;
        out.players.clear();
        out.players.reserve(header.playerCount);

        for (uint8_t i = 0; i < header.playerCount; ++i) {
            PackedPlayer packed{};
            std::memcpy(&packed, buffer + offset, sizeof(packed));
            offset += sizeof(packed);

            PlayerSnapshot player{};
            player.networkId = packed.networkId;
            player.team = packed.team;
            player.position = {packed.posX, 0.0f, packed.posZ};
            player.rotationY = packed.rotationY;
            player.stateFlags = packed.stateFlags;
            out.players.push_back(player);
        }

        return true;
    }
};

} // namespace Slayer::Net
