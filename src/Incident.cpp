#include "Incident.h"
#include <sstream>
#include <iomanip>

Incident::Incident(std::string id, std::string type, int severity, double x, double y, 
                   std::string description)
    : m_id(id), m_type(type), m_severity(severity), m_x(x), m_y(y), m_description(description) {
    if (m_severity < 1) m_severity = 1;
    if (m_severity > 5) m_severity = 5;
    m_effectivePriority = static_cast<double>(m_severity);
    determineRequirements();
}

bool Incident::updateEffectivePriority(double currentClockMinutes, double alpha) {
    if (m_status == "PENDING" || m_status == "PREEMPTED_QUEUED") {
        m_waitTimeMinutes = std::max(0.0, currentClockMinutes - m_queuedAtMinutes);
        double pEff = std::min(5.0, static_cast<double>(m_severity) + alpha * m_waitTimeMinutes);
        m_effectivePriority = pEff;
        if (pEff >= 4.0 && !m_isEscalated) {
            m_isEscalated = true;
            return true; // Trigger starvation prevented escalation event
        }
    } else {
        m_effectivePriority = static_cast<double>(m_severity);
    }
    return false;
}

void Incident::determineRequirements() {
    if (m_type == "FIRE") {
        if (m_severity >= 4) {
            // High severity fire requires combined fire suppression and paramedic/ambulance backup
            m_requiredFireEngines = 1;
            m_requiredAmbulances = 1;
            m_requiresParamedic = false;
        } else {
            m_requiredFireEngines = 1;
            m_requiredAmbulances = 0;
            m_requiresParamedic = false;
        }
    } else if (m_type == "RESCUE") {
        if (m_severity >= 4) {
            // Complex vehicular/technical extrication
            m_requiredFireEngines = 1;
            m_requiredAmbulances = 1;
            m_requiresParamedic = true;
        } else {
            m_requiredFireEngines = 1;
            m_requiredAmbulances = 0;
            m_requiresParamedic = false;
        }
    } else if (m_type == "HAZMAT") {
        m_requiredFireEngines = 1;
        m_requiredAmbulances = 1;
        m_requiresParamedic = true;
    } else {
        // Standard MEDICAL
        m_requiredFireEngines = 0;
        m_requiredAmbulances = 1;
        m_requiresParamedic = (m_severity >= 4);
    }
}

std::string Incident::toJson() const {
    std::ostringstream oss;
    oss << std::fixed << std::setprecision(2);
    oss << "{\"id\":\"" << m_id << "\","
        << "\"type\":\"" << m_type << "\","
        << "\"severity\":" << m_severity << ","
        << "\"x\":" << m_x << ","
        << "\"y\":" << m_y << ","
        << "\"nearestNodeId\":\"" << m_nearestNodeId << "\","
        << "\"description\":\"" << m_description << "\","
        << "\"status\":\"" << m_status << "\","
        << "\"requiredAmbulances\":" << m_requiredAmbulances << ","
        << "\"requiredFireEngines\":" << m_requiredFireEngines << ","
        << "\"requiresParamedic\":" << (m_requiresParamedic ? "true" : "false") << ","
        << "\"createdAtMinutes\":" << m_createdAtMinutes << ","
        << "\"dispatchedAtMinutes\":" << m_dispatchedAtMinutes << ","
        << "\"firstArrivalMinutes\":" << m_firstArrivalMinutes << ","
        << "\"resolvedAtMinutes\":" << m_resolvedAtMinutes << ","
        << "\"offRoadDistanceKm\":" << m_offRoadDistanceKm << ","
        << "\"offRoadApproachMinutes\":" << m_offRoadApproachMinutes << ","
        << "\"effectivePriority\":" << m_effectivePriority << ","
        << "\"waitTimeMinutes\":" << m_waitTimeMinutes << ","
        << "\"isEscalated\":" << (m_isEscalated ? "true" : "false") << ","
        << "\"isIsolated\":" << (m_isIsolated ? "true" : "false") << ","
        << "\"isStaged\":" << (m_isStaged ? "true" : "false") << ","
        << "\"perimeterStagingNodeId\":\"" << m_perimeterStagingNodeId << "\","
        << "\"stagingDistanceKm\":" << m_stagingDistanceKm << ","
        << "\"assignedVehicles\":[";
    for (size_t i = 0; i < m_assignedVehicleIds.size(); ++i) {
        if (i > 0) oss << ",";
        oss << "\"" << m_assignedVehicleIds[i] << "\"";
    }
    oss << "]}";
    return oss.str();
}
