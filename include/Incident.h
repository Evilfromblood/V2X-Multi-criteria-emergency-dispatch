#ifndef INCIDENT_H
#define INCIDENT_H

#include <string>
#include <vector>
#include <algorithm>

class Incident {
public:
    Incident() = default;
    Incident(std::string id, std::string type, int severity, double x, double y, 
             std::string description = "");

    void determineRequirements();

    std::string getId() const { return m_id; }
    std::string getType() const { return m_type; }
    int getSeverity() const { return m_severity; }
    double getX() const { return m_x; }
    double getY() const { return m_y; }
    std::string getNearestNodeId() const { return m_nearestNodeId; }
    void setNearestNodeId(const std::string& nodeId) { m_nearestNodeId = nodeId; }
    std::string getDescription() const { return m_description; }
    std::string getStatus() const { return m_status; }
    void setStatus(const std::string& status) { m_status = status; }

    const std::vector<std::string>& getAssignedVehicleIds() const { return m_assignedVehicleIds; }
    void addAssignedVehicle(const std::string& vehicleId) { m_assignedVehicleIds.push_back(vehicleId); }
    void removeAssignedVehicle(const std::string& vehicleId) {
        auto it = std::remove(m_assignedVehicleIds.begin(), m_assignedVehicleIds.end(), vehicleId);
        m_assignedVehicleIds.erase(it, m_assignedVehicleIds.end());
    }
    void clearAssignedVehicles() { m_assignedVehicleIds.clear(); }

    double getCreatedAtMinutes() const { return m_createdAtMinutes; }
    void setCreatedAtMinutes(double t) { m_createdAtMinutes = t; }

    double getDispatchedAtMinutes() const { return m_dispatchedAtMinutes; }
    void setDispatchedAtMinutes(double t) { m_dispatchedAtMinutes = t; }

    double getFirstArrivalMinutes() const { return m_firstArrivalMinutes; }
    void setFirstArrivalMinutes(double t) { m_firstArrivalMinutes = t; }

    double getResolvedAtMinutes() const { return m_resolvedAtMinutes; }
    void setResolvedAtMinutes(double t) { m_resolvedAtMinutes = t; }

    int getRequiredAmbulances() const { return m_requiredAmbulances; }
    int getRequiredFireEngines() const { return m_requiredFireEngines; }
    bool requiresParamedic() const { return m_requiresParamedic; }

    double getOffRoadDistanceKm() const { return m_offRoadDistanceKm; }
    double getOffRoadApproachMinutes() const { return m_offRoadApproachMinutes; }
    void setOffRoadApproach(double distKm, double speedKmH = 20.0) {
        m_offRoadDistanceKm = distKm;
        m_offRoadApproachMinutes = (speedKmH > 0.0) ? (distKm / speedKmH) * 60.0 : 0.0;
    }

    // Perimeter Staging & Isolation
    bool isIsolated() const { return m_isIsolated; }
    void setIsIsolated(bool iso) { m_isIsolated = iso; }
    bool isStaged() const { return m_isStaged; }
    void setIsStaged(bool staged) { m_isStaged = staged; }
    std::string getPerimeterStagingNodeId() const { return m_perimeterStagingNodeId; }
    void setPerimeterStagingNodeId(const std::string& node) { m_perimeterStagingNodeId = node; }
    double getStagingDistanceKm() const { return m_stagingDistanceKm; }
    void setStagingDistanceKm(double dist) { m_stagingDistanceKm = dist; }

    // Queue Aging & Starvation Prevention
    double getQueuedAtMinutes() const { return m_queuedAtMinutes; }
    void setQueuedAtMinutes(double t) { m_queuedAtMinutes = t; }
    double getEffectivePriority() const { return m_effectivePriority; }
    bool isEscalated() const { return m_isEscalated; }
    void setEscalated(bool val) { m_isEscalated = val; }
    double getWaitTimeMinutes() const { return m_waitTimeMinutes; }
    bool updateEffectivePriority(double currentClockMinutes, double alpha = 0.25);

    std::string toJson() const;

private:
    std::string m_id;
    std::string m_type = "MEDICAL";
    int m_severity = 1;
    double m_x = 0.0;
    double m_y = 0.0;
    std::string m_nearestNodeId;
    std::string m_description;
    std::string m_status = "PENDING"; // "PENDING", "DISPATCHED", "ON_SCENE", "RESOLVED", "PREEMPTED_QUEUED", "ISOLATED_STAGED"
    std::vector<std::string> m_assignedVehicleIds;

    double m_createdAtMinutes = 0.0;
    double m_dispatchedAtMinutes = 0.0;
    double m_firstArrivalMinutes = -1.0;
    double m_resolvedAtMinutes = -1.0;

    int m_requiredAmbulances = 1;
    int m_requiredFireEngines = 0;
    bool m_requiresParamedic = false;

    double m_offRoadDistanceKm = 0.0;
    double m_offRoadApproachMinutes = 0.0;

    // Perimeter staging state
    bool m_isIsolated = false;
    bool m_isStaged = false;
    std::string m_perimeterStagingNodeId;
    double m_stagingDistanceKm = 0.0;

    double m_queuedAtMinutes = 0.0;
    double m_waitTimeMinutes = 0.0;
    double m_effectivePriority = 1.0;
    bool m_isEscalated = false;
};

#endif // INCIDENT_H
