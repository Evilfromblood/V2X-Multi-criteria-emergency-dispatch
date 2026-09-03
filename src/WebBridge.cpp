#include "WebBridge.h"
#include <iostream>
#include <sstream>
#include <chrono>
#include <regex>

#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "ws2_32.lib")
typedef int socklen_t;
#else
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>
#define SOCKET int
#define INVALID_SOCKET -1
#define SOCKET_ERROR -1
#define closesocket close
#endif

WebBridge::WebBridge(DispatchCenter* dispatchCenter)
    : m_dispatchCenter(dispatchCenter) {
}

WebBridge::~WebBridge() {
    stopAutoSimulation();
    stopServer();
}

bool WebBridge::startServer(int port) {
    m_port = port;

#ifdef _WIN32
    WSADATA wsaData;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
        std::cerr << "[WebBridge] Failed to initialize Winsock" << std::endl;
        return false;
    }
#endif

    SOCKET s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (s == INVALID_SOCKET) {
        std::cerr << "[WebBridge] Socket creation failed" << std::endl;
        return false;
    }

    int opt = 1;
    setsockopt(s, SOL_SOCKET, SO_REUSEADDR, (const char*)&opt, sizeof(opt));

    sockaddr_in serverAddr;
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_addr.s_addr = INADDR_ANY;
    serverAddr.sin_port = htons(m_port);

    if (bind(s, (sockaddr*)&serverAddr, sizeof(serverAddr)) == SOCKET_ERROR) {
        std::cerr << "[WebBridge] Bind failed on port " << m_port << std::endl;
        closesocket(s);
        return false;
    }

    if (listen(s, 10) == SOCKET_ERROR) {
        std::cerr << "[WebBridge] Listen failed" << std::endl;
        closesocket(s);
        return false;
    }

    m_serverSocket = (uintptr_t)s;
    m_serverRunning = true;
    m_serverThread = std::thread(&WebBridge::serverLoop, this);

    std::cout << "[WebBridge] Emergency Telemetry Server running on http://127.0.0.1:" 
              << m_port << std::endl;
    return true;
}

void WebBridge::stopServer() {
    if (m_serverRunning) {
        m_serverRunning = false;
        if (m_serverSocket != 0) {
            closesocket((SOCKET)m_serverSocket);
            m_serverSocket = 0;
        }
        if (m_serverThread.joinable()) {
            m_serverThread.join();
        }
#ifdef _WIN32
        WSACleanup();
#endif
    }
}

void WebBridge::startAutoSimulation(double intervalSeconds, double simMinutesPerTick) {
    if (m_autoSimRunning) return;
    m_simIntervalSec = intervalSeconds;
    m_simMinutesPerTick = simMinutesPerTick;
    m_autoSimRunning = true;
    m_autoSimThread = std::thread(&WebBridge::autoSimLoop, this);
}

void WebBridge::stopAutoSimulation() {
    if (m_autoSimRunning) {
        m_autoSimRunning = false;
        if (m_autoSimThread.joinable()) {
            m_autoSimThread.join();
        }
    }
}

void WebBridge::autoSimLoop() {
    while (m_autoSimRunning) {
        int sleepMs = static_cast<int>(m_simIntervalSec * 1000.0);
        if (sleepMs < 100) sleepMs = 100;
        std::this_thread::sleep_for(std::chrono::milliseconds(sleepMs));

        if (!m_autoSimRunning) break;

        if (m_dispatchCenter) {
            m_dispatchCenter->advanceSimulationClock(m_simMinutesPerTick);
        }
    }
}

void WebBridge::serverLoop() {
    SOCKET serverSock = (SOCKET)m_serverSocket;

    while (m_serverRunning) {
        fd_set readSet;
        FD_ZERO(&readSet);
        FD_SET(serverSock, &readSet);

        timeval timeout;
        timeout.tv_sec = 1;
        timeout.tv_usec = 0;

        int sel = select((int)serverSock + 1, &readSet, nullptr, nullptr, &timeout);
        if (sel <= 0) {
            continue; // Timeout or signal
        }

        sockaddr_in clientAddr;
        socklen_t clientLen = sizeof(clientAddr);
        SOCKET clientSock = accept(serverSock, (sockaddr*)&clientAddr, &clientLen);
        if (clientSock == INVALID_SOCKET) {
            continue;
        }

        // Set recv timeout to 2 seconds
#ifdef _WIN32
        DWORD tv = 2000;
        setsockopt(clientSock, SOL_SOCKET, SO_RCVTIMEO, (const char*)&tv, sizeof(tv));
#else
        struct timeval tv;
        tv.tv_sec = 2;
        tv.tv_usec = 0;
        setsockopt(clientSock, SOL_SOCKET, SO_RCVTIMEO, (const char*)&tv, sizeof(tv));
#endif

        char buffer[8192];
        int bytesRead = recv(clientSock, buffer, sizeof(buffer) - 1, 0);
        if (bytesRead > 0) {
            buffer[bytesRead] = '\0';
            std::string request(buffer, bytesRead);

            // Handle HTTP/1.1 Expect: 100-continue
            if (request.find("100-continue") != std::string::npos) {
                const char* cont = "HTTP/1.1 100 Continue\r\n\r\n";
                send(clientSock, cont, (int)strlen(cont), 0);
            }

            // Parse request line
            std::istringstream reqStream(request);
            std::string method, path, httpVersion;
            reqStream >> method >> path >> httpVersion;

            // Determine Content-Length
            int contentLength = 0;
            size_t clPos = request.find("Content-Length:");
            if (clPos == std::string::npos) clPos = request.find("content-length:");
            if (clPos != std::string::npos) {
                try {
                    contentLength = std::stoi(request.substr(clPos + 15));
                } catch (...) {
                    contentLength = 0;
                }
            }

            // Separate body and read remaining payload if chunked across packets
            std::string body;
            size_t bodyPos = request.find("\r\n\r\n");
            if (bodyPos != std::string::npos) {
                body = request.substr(bodyPos + 4);
                while (static_cast<int>(body.size()) < contentLength) {
                    int more = recv(clientSock, buffer, sizeof(buffer) - 1, 0);
                    if (more <= 0) break;
                    body.append(buffer, more);
                }
            }

            std::string response = handleHttpRequest(method, path, body);
            send(clientSock, response.c_str(), static_cast<int>(response.size()), 0);

#ifdef _WIN32
            shutdown(clientSock, SD_SEND);
#else
            shutdown(clientSock, SHUT_WR);
#endif
        }

        closesocket(clientSock);
    }
}

std::string WebBridge::handleHttpRequest(const std::string& method, const std::string& path, 
                                        const std::string& body) {
    std::ostringstream resp;

    // Handle CORS Pre-flight OPTIONS
    if (method == "OPTIONS") {
        resp << "HTTP/1.1 204 No Content\r\n"
             << "Access-Control-Allow-Origin: *\r\n"
             << "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
             << "Access-Control-Allow-Headers: Content-Type\r\n"
             << "Access-Control-Max-Age: 86400\r\n"
             << "Connection: close\r\n\r\n";
        return resp.str();
    }

    if (method == "GET" && (path == "/api/state" || path == "/api/telemetry")) {
        std::string payload = m_dispatchCenter ? m_dispatchCenter->getFullTelemetryJson() : "{}";
        resp << "HTTP/1.1 200 OK\r\n"
             << "Content-Type: application/json\r\n"
             << "Access-Control-Allow-Origin: *\r\n"
             << "Content-Length: " << payload.size() << "\r\n"
             << "Connection: close\r\n\r\n"
             << payload;
        return resp.str();
    }

    if (method == "POST" && path == "/api/step") {
        double deltaMinutes = extractJsonDouble(body, "deltaMinutes", 1.0);
        if (m_dispatchCenter) {
            m_dispatchCenter->advanceSimulationClock(deltaMinutes);
        }
        std::string payload = "{\"status\":\"ok\",\"deltaMinutes\":" + std::to_string(deltaMinutes) + "}";
        resp << "HTTP/1.1 200 OK\r\n"
             << "Content-Type: application/json\r\n"
             << "Access-Control-Allow-Origin: *\r\n"
             << "Content-Length: " << payload.size() << "\r\n"
             << "Connection: close\r\n\r\n"
             << payload;
        return resp.str();
    }

    if (method == "POST" && path == "/api/play") {
        double interval = extractJsonDouble(body, "interval", 1.0);
        double step = extractJsonDouble(body, "step", 1.0);
        startAutoSimulation(interval, step);
        std::string payload = "{\"status\":\"playing\"}";
        resp << "HTTP/1.1 200 OK\r\n"
             << "Content-Type: application/json\r\n"
             << "Access-Control-Allow-Origin: *\r\n"
             << "Content-Length: " << payload.size() << "\r\n"
             << "Connection: close\r\n\r\n"
             << payload;
        return resp.str();
    }

    if (method == "POST" && path == "/api/pause") {
        stopAutoSimulation();
        std::string payload = "{\"status\":\"paused\"}";
        resp << "HTTP/1.1 200 OK\r\n"
             << "Content-Type: application/json\r\n"
             << "Access-Control-Allow-Origin: *\r\n"
             << "Content-Length: " << payload.size() << "\r\n"
             << "Connection: close\r\n\r\n"
             << payload;
        return resp.str();
    }

    if (method == "POST" && path == "/api/hazard") {
        std::string from = extractJsonField(body, "from");
        std::string to = extractJsonField(body, "to");
        std::string hazardType = extractJsonField(body, "hazardType");
        if (hazardType.empty()) hazardType = "ACCIDENT";
        double multiplier = extractJsonDouble(body, "multiplier", 2.0);
        bool isBlocked = extractJsonBool(body, "isBlocked", false);
        std::string desc = extractJsonField(body, "description");

        bool ok = false;
        if (m_dispatchCenter && !from.empty() && !to.empty()) {
            ok = m_dispatchCenter->injectHazard(from, to, hazardType, multiplier, isBlocked, desc);
        }

        std::string payload = "{\"status\":\"" + std::string(ok ? "success" : "failed") + "\"}";
        resp << "HTTP/1.1 200 OK\r\n"
             << "Content-Type: application/json\r\n"
             << "Access-Control-Allow-Origin: *\r\n"
             << "Content-Length: " << payload.size() << "\r\n"
             << "Connection: close\r\n\r\n"
             << payload;
        return resp.str();
    }

    if (method == "POST" && path == "/api/resolve_hazard") {
        std::string from = extractJsonField(body, "from");
        std::string to = extractJsonField(body, "to");

        bool ok = false;
        if (m_dispatchCenter && !from.empty() && !to.empty()) {
            ok = m_dispatchCenter->resolveHazard(from, to);
        }

        std::string payload = "{\"status\":\"" + std::string(ok ? "success" : "failed") + "\"}";
        resp << "HTTP/1.1 200 OK\r\n"
             << "Content-Type: application/json\r\n"
             << "Access-Control-Allow-Origin: *\r\n"
             << "Content-Length: " << payload.size() << "\r\n"
             << "Connection: close\r\n\r\n"
             << payload;
        return resp.str();
    }

    if (method == "POST" && path == "/api/incident") {
        std::string type = extractJsonField(body, "type");
        if (type.empty()) type = "MEDICAL";
        int severity = extractJsonInt(body, "severity", 3);
        double x = extractJsonDouble(body, "x", 6.0);
        double y = extractJsonDouble(body, "y", 6.0);
        std::string desc = extractJsonField(body, "description");
        std::string customId = extractJsonField(body, "id");

        std::string incId = "";
        if (m_dispatchCenter) {
            incId = m_dispatchCenter->createIncident(type, severity, x, y, desc, customId);
        }

        std::string payload = "{\"status\":\"success\",\"id\":\"" + incId + "\"}";
        resp << "HTTP/1.1 200 OK\r\n"
             << "Content-Type: application/json\r\n"
             << "Access-Control-Allow-Origin: *\r\n"
             << "Content-Length: " << payload.size() << "\r\n"
             << "Connection: close\r\n\r\n"
             << payload;
        return resp.str();
    }

    if (method == "POST" && path == "/api/reset") {
        if (m_dispatchCenter) {
            m_dispatchCenter->resetSimulation();
        }
        std::string payload = "{\"status\":\"reset_ok\"}";
        resp << "HTTP/1.1 200 OK\r\n"
             << "Content-Type: application/json\r\n"
             << "Access-Control-Allow-Origin: *\r\n"
             << "Content-Length: " << payload.size() << "\r\n"
             << "Connection: close\r\n\r\n"
             << payload;
        return resp.str();
    }

    // 404 Not Found
    std::string notFound = "{\"error\":\"Not Found\"}";
    resp << "HTTP/1.1 404 Not Found\r\n"
         << "Content-Type: application/json\r\n"
         << "Access-Control-Allow-Origin: *\r\n"
         << "Content-Length: " << notFound.size() << "\r\n"
         << "Connection: close\r\n\r\n"
         << notFound;
    return resp.str();
}

std::string WebBridge::extractJsonField(const std::string& json, const std::string& key) {
    // Regex for "key"\s*:\s*"([^"]*)"
    std::regex re("\"" + key + "\"\\s*:\\s*\"([^\"]*)\"");
    std::smatch match;
    if (std::regex_search(json, match, re)) {
        return match[1].str();
    }
    return "";
}

double WebBridge::extractJsonDouble(const std::string& json, const std::string& key, double defaultVal) {
    std::regex re("\"" + key + "\"\\s*:\\s*([-+]?[0-9]*\\.?[0-9]+)");
    std::smatch match;
    if (std::regex_search(json, match, re)) {
        try {
            return std::stod(match[1].str());
        } catch (...) {
            return defaultVal;
        }
    }
    return defaultVal;
}

int WebBridge::extractJsonInt(const std::string& json, const std::string& key, int defaultVal) {
    std::regex re("\"" + key + "\"\\s*:\\s*([-+]?[0-9]+)");
    std::smatch match;
    if (std::regex_search(json, match, re)) {
        try {
            return std::stoi(match[1].str());
        } catch (...) {
            return defaultVal;
        }
    }
    return defaultVal;
}

bool WebBridge::extractJsonBool(const std::string& json, const std::string& key, bool defaultVal) {
    std::regex re("\"" + key + "\"\\s*:\\s*(true|false)");
    std::smatch match;
    if (std::regex_search(json, match, re)) {
        return match[1].str() == "true";
    }
    return defaultVal;
}
