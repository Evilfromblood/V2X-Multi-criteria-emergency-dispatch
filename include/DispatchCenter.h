#ifndef DISPATCH_CENTER_H
#define DISPATCH_CENTER_H

#include "RoadNetwork.h"
#include "RouteOptimizer.h"
#include "EmergencyVehicle.h"
#include "Ambulance.h"
#include "FireEngine.h"
#include "Incident.h"
#include "V2XHub.h"
#include "AnalyticsEngine.h"

#include <vector>
#include <memory>
#include <string>
#include <mutex>

class DispatchCenter {
public:
    DispatchCenter();

    void resetSimulation();
    void initializeDefaultFleet();

    // Incident management
    std::string createIncident(const std::string& type, int severity, double x, double y, 
                               const std::string& desc = "", const std::string& customId = "");
    bool attemptDispatch(Incident& incident, bool canPreempt = true);
    bool attemptPriorityPreemption(Incident& highSeverityIncident);

    // Fleet management
    void addVehicle(std::unique_ptr<EmergencyVehicle> vehicle);
    const std::vector<std::unique_ptr<EmergencyVehicle>>& getFleet() const { return m_fleet; }
    EmergencyVehicle* getVehicleById(const std::string& id);
    bool recallVehicle(const std::string& vehicleId);
    bool resolveIncident(const std::string& incidentId);
    void applyWeather(const std::string& weatherType, double multiplier);

    // Simulation loop
    void advanceSimulationClock(double deltaMinutes);
    double getCurrentClockMinutes() const { return m_currentClockMinutes; }

    // V2X integration
    bool injectHazard(const std::string& from, const std::string& to, 
                      const std::string& hazardType, double multiplier, bool isBlocked, 
                      const std::string& desc = "");
    bool resolveHazard(const std::string& from, const std::string& to);
    void checkAndRerouteFleet();

    // Subsystem accessors
    RoadNetwork& getRoadNetwork() { return m_network; }
    const RoadNetwork& getRoadNetwork() const { return m_network; }
    RouteOptimizer& getRouteOptimizer() { return m_optimizer; }
    const RouteOptimizer& getRouteOptimizer() const { return m_optimizer; }
    V2XHub& getV2XHub() { return m_v2xHub; }
    const V2XHub& getV2XHub() const { return m_v2xHub; }
    AnalyticsEngine& getAnalytics() { return m_analytics; }
    const AnalyticsEngine& getAnalytics() const { return m_analytics; }
    const std::vector<Incident>& getIncidents() const { return m_incidents; }

    std::string getFullTelemetryJson() const;

private:
    RoadNetwork m_network;
    RouteOptimizer m_optimizer;
    V2XHub m_v2xHub;
    AnalyticsEngine m_analytics;

    std::vector<std::unique_ptr<EmergencyVehicle>> m_fleet;
    std::vector<Incident> m_incidents;
    std::vector<std::pair<std::string, std::string>> m_activeGreenWaveSegments;
    double m_currentClockMinutes = 0.0;
    int m_incidentCounter = 1;

    mutable std::mutex m_mutex;
};

#endif // DISPATCH_CENTER_H
