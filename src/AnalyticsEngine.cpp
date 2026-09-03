#include "AnalyticsEngine.h"
#include <sstream>
#include <iomanip>

void AnalyticsEngine::logEvent(double timestamp, const std::string& type, 
                              const std::string& incidentId, const std::string& vehicleId, 
                              const std::string& message) {
    DispatchEvent ev;
    ev.timestamp = timestamp;
    ev.type = type;
    ev.incidentId = incidentId;
    ev.vehicleId = vehicleId;
    ev.message = message;
    m_events.push_back(ev);

    // Limit log size to 100 recent entries
    if (m_events.size() > 100) {
        m_events.erase(m_events.begin());
    }
}

void AnalyticsEngine::recordIncidentDispatched() {
    m_dispatchedCount++;
    m_totalIncidents++;
}

void AnalyticsEngine::recordIncidentResolved(double arrivalEtaMinutes, double totalDurationMinutes) {
    m_resolvedCount++;
    if (arrivalEtaMinutes >= 0.0) {
        m_sumEtaMinutes += arrivalEtaMinutes;
        m_etaSampleCount++;
    }
    m_sumDurationMinutes += totalDurationMinutes;
}

void AnalyticsEngine::recordPreemption() {
    m_preemptionCount++;
}

void AnalyticsEngine::recordDynamicReroute() {
    m_rerouteCount++;
}

void AnalyticsEngine::recordDistanceTraveled(double km) {
    m_totalDistanceTraveledKm += km;
}

double AnalyticsEngine::getMeanEtaMinutes() const {
    if (m_etaSampleCount == 0) return 0.0;
    return m_sumEtaMinutes / m_etaSampleCount;
}

double AnalyticsEngine::getSuccessRatePercent() const {
    if (m_totalIncidents == 0) return 100.0;
    return (static_cast<double>(m_resolvedCount) / m_totalIncidents) * 100.0;
}

void AnalyticsEngine::reset() {
    m_totalIncidents = 0;
    m_dispatchedCount = 0;
    m_resolvedCount = 0;
    m_preemptionCount = 0;
    m_rerouteCount = 0;
    m_starvationEscalationCount = 0;
    m_greenWavePreemptionCount = 0;
    m_totalDistanceTraveledKm = 0.0;
    m_sumEtaMinutes = 0.0;
    m_etaSampleCount = 0;
    m_sumDurationMinutes = 0.0;
    m_events.clear();
}

std::string AnalyticsEngine::toJson() const {
    std::ostringstream oss;
    oss << std::fixed << std::setprecision(2);
    oss << "{\"totalIncidents\":" << m_totalIncidents << ","
        << "\"dispatchedCount\":" << m_dispatchedCount << ","
        << "\"resolvedCount\":" << m_resolvedCount << ","
        << "\"preemptionCount\":" << m_preemptionCount << ","
        << "\"rerouteCount\":" << m_rerouteCount << ","
        << "\"starvationEscalationCount\":" << m_starvationEscalationCount << ","
        << "\"greenWavePreemptionCount\":" << m_greenWavePreemptionCount << ","
        << "\"totalDistanceTraveledKm\":" << m_totalDistanceTraveledKm << ","
        << "\"meanEtaMinutes\":" << getMeanEtaMinutes() << ","
        << "\"successRatePercent\":" << getSuccessRatePercent() << ","
        << "\"events\":[";
    for (size_t i = 0; i < m_events.size(); ++i) {
        if (i > 0) oss << ",";
        const auto& ev = m_events[i];
        oss << "{\"timestamp\":" << ev.timestamp << ","
            << "\"type\":\"" << ev.type << "\","
            << "\"incidentId\":\"" << ev.incidentId << "\","
            << "\"vehicleId\":\"" << ev.vehicleId << "\","
            << "\"message\":\"" << ev.message << "\"}";
    }
    oss << "]}";
    return oss.str();
}
