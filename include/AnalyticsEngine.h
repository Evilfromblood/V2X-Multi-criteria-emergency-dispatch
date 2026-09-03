#ifndef ANALYTICS_ENGINE_H
#define ANALYTICS_ENGINE_H

#include <string>
#include <vector>

struct DispatchEvent {
    double timestamp = 0.0;
    std::string type; // "DISPATCH", "ARRIVAL", "HOSPITAL_DROP", "RETURN_BASE", "PREEMPTION", "V2X_REROUTE", "HAZARD_INJECTED", "HAZARD_RESOLVED"
    std::string incidentId;
    std::string vehicleId;
    std::string message;
};

class AnalyticsEngine {
public:
    AnalyticsEngine() = default;

    void logEvent(double timestamp, const std::string& type, const std::string& incidentId,
                  const std::string& vehicleId, const std::string& message);

    void recordIncidentDispatched();
    void recordIncidentResolved(double arrivalEtaMinutes, double totalDurationMinutes);
    void recordPreemption();
    void recordDynamicReroute();
    void recordDistanceTraveled(double km);
    void recordStarvationEscalation() { ++m_starvationEscalationCount; }
    void recordGreenWavePreemption() { ++m_greenWavePreemptionCount; }

    int getTotalIncidents() const { return m_totalIncidents; }
    int getDispatchedCount() const { return m_dispatchedCount; }
    int getResolvedCount() const { return m_resolvedCount; }
    int getPreemptionCount() const { return m_preemptionCount; }
    int getRerouteCount() const { return m_rerouteCount; }
    int getStarvationEscalationCount() const { return m_starvationEscalationCount; }
    int getGreenWavePreemptionCount() const { return m_greenWavePreemptionCount; }
    double getTotalDistanceTraveledKm() const { return m_totalDistanceTraveledKm; }
    double getMeanEtaMinutes() const;
    double getSuccessRatePercent() const;

    const std::vector<DispatchEvent>& getEvents() const { return m_events; }
    void reset();

    std::string toJson() const;

private:
    int m_totalIncidents = 0;
    int m_dispatchedCount = 0;
    int m_resolvedCount = 0;
    int m_preemptionCount = 0;
    int m_rerouteCount = 0;
    int m_starvationEscalationCount = 0;
    int m_greenWavePreemptionCount = 0;
    double m_totalDistanceTraveledKm = 0.0;
    double m_sumEtaMinutes = 0.0;
    int m_etaSampleCount = 0;
    double m_sumDurationMinutes = 0.0;

    std::vector<DispatchEvent> m_events;
};

#endif // ANALYTICS_ENGINE_H
