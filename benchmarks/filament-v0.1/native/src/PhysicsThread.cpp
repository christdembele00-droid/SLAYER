#include <atomic>
#include <chrono>
#include <thread>
namespace slayer {
class PhysicsThread {
 std::atomic<bool> running{false}; std::thread worker;
public:
 void start(){running=true;worker=std::thread([this]{auto next=std::chrono::steady_clock::now();while(running){next+=std::chrono::milliseconds(8);std::this_thread::sleep_until(next);tick(0.008f);}});}
 void stop(){running=false;if(worker.joinable())worker.join();}
 void tick(float){/* deterministic Bullet/PhysX integration point */}
};
}
