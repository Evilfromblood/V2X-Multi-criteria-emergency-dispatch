#ifndef EMERGENCY_VEHICLE_H
#define EMERGENCY_VEHICLE_H

#include "RoadNetwork.h"
#include "RouteOptimizer.h"
#include <string>
#include <vector>
#include <memory>

class Incident;

enum class VehicleState {
    IDLE_STATION,
    EN_ROUTE_INCIDENT,
    ON_SCENE,
    TRANSPORTING_HOSPITAL,
    AT_HOSPITAL_TURNOVER,
    RETURNING_TO_BASE
};

std::string vehicleStateToString(VehicleState state);
VehicleState stringToVehicleState(const std::string& stateStr);

class EmergencyVehicle {
public:
    EmergencyVehicle(std::string id, std::string type, std::string homeBaseNode, 
                     double x, double y, double speedKmH = 60.0);
    virtual ~EmergencyVehicle() = default;

    // Getters & Setters
    std::string getId() const { return m_id; }
    std::string getType() const { return m_type; }
    double getX() const { return m_x; }
    double getY() const { return m_y; }
    void setCoordinates(double x, double y) { m_x = x; m_y = y; }
    double getSpeedKmH() const { return m_speedKmH; }
    std::string getHomeBaseNode() const { return m_homeBaseNode; }
    std::string getCurrentNodeId() const { return m_currentNodeId; }
    void setCurrentNodeId(const std::string& node) { m_currentNodeId = node; }
    std::string getDestinationNodeId() const { return m_destinationNodeId; }
    const std::vector<std::string>& getActiveRoutePath() const { return m_activeRoutePath; }
    size_t getRouteIndex() const { return m_routeIndex; }
    double getProgressOnSegmentKm() const { return m_progressOnSegmentKm; }
    VehicleState getState() const { return m_state; }
    void setState(VehicleState state) { m_state = state; }
    double getStateTimerMinutes() const { return m_stateTimerMinutes; }
    void setStateTimerMinutes(double timer) { m_stateTimerMinutes = timer; }
    std::string getAssignedIncidentId() const { return m_assignedIncidentId; }
    void setAssignedIncident(const std::string& incidentId, int severity);
    int getAssignedIncidentSeverity() const { return m_assignedIncidentSeverity; }
    double getTotalDistanceTraveledKm() const { return m_totalDistanceTraveledKm; }

    bool isAvailableForDispatch() const;

    void assignRoute(const std::vector<std::string>& path, const std::string& destNode, VehicleState newState);
    bool rerouteTo(const std::string& destNode, const RoadNetwork& network, RouteOptimizer& optimizer);
    bool checkAndRerouteIfBlocked(const RoadNetwork& network, RouteOptimizer& optimizer);
    void recallToBase(const RoadNetwork& network, RouteOptimizer& optimizer);

    virtual void advanceSimulationTime(double deltaMinutes, const RoadNetwork& network, RouteOptimizer& optimizer);
    virtual double calculateSuitability(const Incident& incident, const RoadNetwork& network, RouteOptimizer& optimizer) const = 0;
    virtual std::string toJson() const;

protected:
    virtual void onArrivedAtDestination(const RoadNetwork& network, RouteOptimizer& optimizer);
    virtual void onStateTimerExpired(const RoadNetwork& network, RouteOptimizer& optimizer);

    std::string m_id;
    std::string m_type;
    double m_x = 0.0;
    double m_y = 0.0;
    double m_speedKmH = 60.0;
    std::string m_homeBaseNode;
    std::string m_currentNodeId;
    std::string m_destinationNodeId;
    std::vector<std::string> m_activeRoutePath;
    size_t m_routeIndex = 0;
    double m_progressOnSegmentKm = 0.0;

    VehicleState m_state = VehicleState::IDLE_STATION;
    double m_stateTimerMinutes = 0.0;
    std::string m_assignedIncidentId;
    int m_assignedIncidentSeverity = 1;
    double m_totalDistanceTraveledKm = 0.0;
};

#endif // EMERGENCY_VEHICLE_H
