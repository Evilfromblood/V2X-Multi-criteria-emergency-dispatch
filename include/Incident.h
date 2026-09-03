#ifndef INCIDENT_H
#define INCIDENT_H

#include <string>
#include <vector>

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

    std::string toJson() const;

private:
    std::string m_id;
    std::string m_type = "MEDICAL";
    int m_severity = 1;
    double m_x = 0.0;
    double m_y = 0.0;
    std::string m_nearestNodeId;
    std::string m_description;
    std::string m_status = "PENDING"; // "PENDING", "DISPATCHED", "ON_SCENE", "RESOLVED", "PREEMPTED_QUEUED"
    std::vector<std::string> m_assignedVehicleIds;

    double m_createdAtMinutes = 0.0;
    double m_dispatchedAtMinutes = 0.0;
    double m_firstArrivalMinutes = -1.0;
    double m_resolvedAtMinutes = -1.0;

    int m_requiredAmbulances = 1;
    int m_requiredFireEngines = 0;
    bool m_requiresParamedic = false;
};

#endif // INCIDENT_H
