#ifndef WEB_BRIDGE_H
#define WEB_BRIDGE_H

#include "DispatchCenter.h"
#include <string>
#include <thread>
#include <atomic>
#include <memory>

class WebBridge {
public:
    WebBridge(DispatchCenter* dispatchCenter);
    ~WebBridge();

    bool startServer(int port = 8080);
    void stopServer();

    void startAutoSimulation(double intervalSeconds = 1.0, double simMinutesPerTick = 1.0);
    void stopAutoSimulation();
    bool isAutoSimulationRunning() const { return m_autoSimRunning; }

    static std::string extractJsonField(const std::string& json, const std::string& key);
    static double extractJsonDouble(const std::string& json, const std::string& key, double defaultVal = 0.0);
    static int extractJsonInt(const std::string& json, const std::string& key, int defaultVal = 0);
    static bool extractJsonBool(const std::string& json, const std::string& key, bool defaultVal = false);

private:
    void serverLoop();
    void autoSimLoop();
    std::string handleHttpRequest(const std::string& method, const std::string& path, 
                                 const std::string& body);

    DispatchCenter* m_dispatchCenter;
    int m_port = 8080;
    std::atomic<bool> m_serverRunning{false};
    std::atomic<bool> m_autoSimRunning{false};
    double m_simIntervalSec = 1.0;
    double m_simMinutesPerTick = 1.0;

    std::thread m_serverThread;
    std::thread m_autoSimThread;
    uintptr_t m_serverSocket = 0; // SOCKET representation
};

#endif // WEB_BRIDGE_H
