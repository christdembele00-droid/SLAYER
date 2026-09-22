#include <atomic>
#include <thread>
#include <chrono>
namespace slayer {
class GameplayThread {
 std::atomic<bool> running{false}; std::thread worker;
public:
 void start(){running=true;worker=std::thread([this]{auto next=std::chrono::steady_clock::now();while(running){next+=std::chrono::milliseconds(16);std::this_thread::sleep_until(next);tick(0.016f);}});}
 void stop(){running=false;if(worker.joinable())worker.join();}
 void tick(float){/* tactics + rules + animation blending */}
};
}
