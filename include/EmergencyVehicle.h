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
    RETURNING_TO_BASE,
    REFUELING_DEPOT,
    REPLENISHING_WATER,
    SEEKING_RESUPPLY,
    STAGED_AT_PERIMETER
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

    // Perimeter Staging & Partial-Route Tracking
    bool isStagedAtPerimeter() const { return m_state == VehicleState::STAGED_AT_PERIMETER || m_isStagedAtPerimeter; }
    std::string getPerimeterStagingNodeId() const { return m_perimeterStagingNodeId; }
    std::string getStagedTargetIncidentId() const { return m_stagedTargetIncidentId; }
    double getStagingDistanceKm() const { return m_stagingDistanceKm; }
    void setStagingTarget(const std::string& incidentId, const std::string& stagingNode, double gapKm) {
        m_isStagedAtPerimeter = false;
        m_stagedTargetIncidentId = incidentId;
        m_perimeterStagingNodeId = stagingNode;
        m_stagingDistanceKm = gapKm;
    }
    void clearStaging() {
        m_isStagedAtPerimeter = false;
        m_stagedTargetIncidentId = "";
        m_perimeterStagingNodeId = "";
        m_stagingDistanceKm = 0.0;
    }

    // Consumable Resource Dynamics & Refueling
    double getCurrentFuelLiters() const { return m_currentFuelLiters; }
    double getMaxFuelLiters() const { return m_maxFuelLiters; }
    double getFuelPercentage() const { return (m_maxFuelLiters > 0.0) ? (m_currentFuelLiters / m_maxFuelLiters) * 100.0 : 100.0; }
    bool isLowFuel() const { return getFuelPercentage() < 20.0; }
    double getTotalFuelBurnedLiters() const { return m_totalFuelBurnedLiters; }
    void refuel() { m_currentFuelLiters = m_maxFuelLiters; m_resupplyStatus = "NONE"; }
    void burnFuel(double liters) { m_currentFuelLiters = std::max(0.0, m_currentFuelLiters - liters); m_totalFuelBurnedLiters += liters; }

    // Virtual water interface for FireEngines
    virtual double getCurrentWaterLiters() const { return 0.0; }
    virtual double getMaxWaterLiters() const { return 0.0; }
    virtual double getWaterPercentage() const { return -1.0; }
    virtual bool isLowWater() const { return false; }
    virtual void dischargeWater(double liters) { (void)liters; }
    virtual void replenishWater() {}

    std::string getResupplyStatus() const;
    void setResupplyStatus(const std::string& status) { m_resupplyStatus = status; }

    void startRefueling() {
        m_state = VehicleState::REFUELING_DEPOT;
        m_stateTimerMinutes = 5.0; // 5.0 minute refueling cycle
        m_resupplyStatus = "REFUELING";
    }

    void startWaterReplenishment() {
        m_state = VehicleState::REPLENISHING_WATER;
        m_stateTimerMinutes = 3.0; // 3.0 minute pump refill cycle
        m_resupplyStatus = "REPLENISHING";
    }

    void detourToResupply(const std::string& depotNode, const RoadNetwork& network, RouteOptimizer& optimizer);

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

    // Perimeter Staging State
    bool m_isStagedAtPerimeter = false;
    std::string m_perimeterStagingNodeId;
    std::string m_stagedTargetIncidentId;
    double m_stagingDistanceKm = 0.0;

    // Resource tracking
    double m_maxFuelLiters = 80.0;
    double m_currentFuelLiters = 80.0;
    double m_totalFuelBurnedLiters = 0.0;
    std::string m_resupplyStatus = "NONE";

    // Resupply resumption memory
    std::string m_savedIncidentId;
    double m_savedSceneTimerMinutes = 0.0;
};

#endif // EMERGENCY_VEHICLE_H
