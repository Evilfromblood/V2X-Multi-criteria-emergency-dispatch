#include "DispatchCenter.h"
#include "WebBridge.h"

#include <iostream>
#include <string>
#include <csignal>
#include <thread>
#include <chrono>

static std::atomic<bool> g_running{true};

void signalHandler(int signum) {
    std::cout << "\n[Main] Caught interrupt signal (" << signum << "). Shutting down..." << std::endl;
    g_running = false;
}

int main(int argc, char* argv[]) {
    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);

    int port = 8080;
    bool headlessTest = false;
    bool autoSim = true;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--port" && i + 1 < argc) {
            port = std::stoi(argv[++i]);
        } else if (arg == "--headless-test") {
            headlessTest = true;
        } else if (arg == "--no-auto") {
            autoSim = false;
        }
    }

    std::cout << "==================================================================\n";
    std::cout << "  V2X Multi-Criteria Emergency Dispatch & Fleet Telemetry Engine  \n";
    std::cout << "==================================================================\n";

    DispatchCenter center;

    if (headlessTest) {
        std::cout << "[Headless Mode] Executing verification test suite..." << std::endl;
        std::string inc1 = center.createIncident("MEDICAL", 3, 5.0, 5.0, "Downtown Medical Emergency");
        std::cout << "-> Created incident " << inc1 << std::endl;

        for (int step = 0; step < 10; ++step) {
            center.advanceSimulationClock(1.0);
            std::cout << "  [Step " << (step + 1) << "] Sim Clock: " 
                      << center.getCurrentClockMinutes() << " min" << std::endl;
        }

        std::cout << "-> Final Telemetry JSON length: " << center.getFullTelemetryJson().size() << " bytes\n";
        std::cout << "-> Headless execution successfully completed.\n";
        return 0;
    }

    WebBridge bridge(&center);
    if (!bridge.startServer(port)) {
        std::cerr << "[Main] Failed to bind server on port " << port << std::endl;
        return 1;
    }

    if (autoSim) {
        bridge.startAutoSimulation(1.0, 1.0); // 1 tick per second, 1 sim-minute per tick
        std::cout << "[Main] Auto-simulation enabled (1 sim-minute / sec)\n";
    }

    std::cout << "\nPlatform ready! Open the React dashboard at http://localhost:5173\n";
    std::cout << "REST API available at: http://127.0.0.1:" << port << "/api/state\n";
    std::cout << "Press Ctrl+C in this terminal to stop the engine.\n" << std::endl;

    while (g_running) {
        std::this_thread::sleep_for(std::chrono::milliseconds(500));
    }

    std::cout << "[Main] Stopping telemetry bridge..." << std::endl;
    bridge.stopAutoSimulation();
    bridge.stopServer();

    std::cout << "[Main] Engine shutdown complete." << std::endl;
    return 0;
}
