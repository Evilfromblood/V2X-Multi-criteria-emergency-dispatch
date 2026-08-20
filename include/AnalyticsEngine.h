#ifndef ANALYTICS_ENGINE_H
#define ANALYTICS_ENGINE_H

#include <string>
#include <vector>

struct DispatchRecord {
    std::string incidentId;
    std::string incidentType;
    int severity;
    std::string assignedVehicleId;
    std::string vehicleType;
    double travelTimeMinutes;
    double routeDistanceKm;
    bool preempted;
};

class AnalyticsEngine {
private:
    std::vector<DispatchRecord> records;
    int totalIncidentsProcessed = 0;

public:
    void logDispatch(const DispatchRecord& record);
    void renderAnalyticsSummary() const;
    void incrementIncidentsProcessed() { totalIncidentsProcessed++; }
};

#endif // ANALYTICS_ENGINE_H
