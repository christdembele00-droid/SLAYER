#pragma once
#include <cstdint>

namespace slayer {

enum class CameraMode : uint8_t { Broadcast, Dynamic, Overview, Pro, Custom };
enum class WeatherMode : uint8_t { Clear, Rain, Snow };
enum class TimeMode : uint8_t { Day, Twilight, Night };
enum class GrassMode : uint8_t { ShortDry, LongDry, ShortWet };
enum class QualityMode : uint8_t { Low, Medium, High, Ultra };
enum class ControlMode : uint8_t { Touch, Joystick, Gamepad };
enum class ShotAssistMode : uint8_t { Manual, Assisted };
enum class CursorMode : uint8_t { Auto, Semi, Manual };
enum class PressMode : uint8_t { Individual, Double };
enum class TacticalMode : uint8_t { UltraDefensive, Balanced, UltraOffensive };

struct SlayerSettings {
    int durationMinutes = 10;
    bool extraTime = true;
    bool penalties = true;
    int substitutions = 5;
    bool randomCondition = true;
    TimeMode time = TimeMode::Day;
    WeatherMode weather = WeatherMode::Clear;
    GrassMode grass = GrassMode::ShortDry;
    int stadium = 0;
    int ball = 0;
    ControlMode control = ControlMode::Joystick;
    int passAssist = 2;
    ShotAssistMode shotAssist = ShotAssistMode::Manual;
    CursorMode cursor = CursorMode::Semi;
    PressMode pressing = PressMode::Individual;
    TacticalMode attack = TacticalMode::Balanced;
    int targetFps = 60;
    QualityMode quality = QualityMode::High;
    bool dynamicResolution = true;
    CameraMode camera = CameraMode::Broadcast;
    bool radar = true;
    int commentaryLanguage = 0;
    float musicVolume = 0.55f;
    float commentaryVolume = 0.85f;
    float crowdVolume = 0.80f;
    float effectsVolume = 0.90f;
};

} // namespace slayer
