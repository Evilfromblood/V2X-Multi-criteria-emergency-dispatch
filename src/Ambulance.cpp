#include "Ambulance.h"
#include "RoadNetwork.h"
#include "RouteOptimizer.h"
#include "Incident.h"

#include <sstream>
#include <iomanip>
#include <algorithm>

Ambulance::Ambulance(std::string id, std::string homeBaseNode, double x, double y,
                     int maxTriageLevel, bool hasParamedic, double speedKmH)
    : EmergencyVehicle(id, "AMBULANCE", homeBaseNode, x, y, speedKmH),
      m_maxTriageLevel(maxTriageLevel), m_hasParamedic(hasParamedic) {
}

double Ambulance::calculateSuitability(const Incident& incident, const RoadNetwork& network, 
                                      RouteOptimizer& optimizer) const {
    if (!isAvailableForDispatch()) {
        return -1.0;
    }

    std::string startNode = m_currentNodeId;
    if (startNode.empty()) {
        startNode = network.getNearestNode(m_x, m_y);
    }
    std::string targetNode = incident.getNearestNodeId();
    if (targetNode.empty()) {
        targetNode = network.getNearestNode(incident.getX(), incident.getY());
    }

    RouteResult route = optimizer.findShortestRoute(network, startNode, targetNode);
    if (!route.reachable) {
        return -1.0;
    }

    double score = 100.0;

    // Time deduction: 3 points per minute of ETA
    score -= (route.estimatedTimeMinutes * 3.0);

    // Triage capability check
    if (m_maxTriageLevel < incident.getSeverity()) {
        score -= 40.0; // Significant penalty if vehicle triage level is lower than incident severity
    } else {
        score += 10.0;
    }

    // Paramedic match
    if (incident.requiresParamedic()) {
        if (m_hasParamedic) {
            score += 35.0; // High bonus for fulfilling critical paramedic requirement
        } else {
            score -= 60.0; // Severe penalty if paramedic required but absent
        }
    } else if (m_hasParamedic) {
        score += 5.0; // Modest bonus for routine calls
    }

    // Mid-route intercept bonus
    if (m_state == VehicleState::RETURNING_TO_BASE) {
        score += 15.0;
    }

    if (score < 1.0) {
        score = 1.0; // Reachable units remain eligible with minimal score
    }

    return score;
}

void Ambulance::onArrivedAtDestination(const RoadNetwork& network, RouteOptimizer& optimizer) {
    if (m_state == VehicleState::EN_ROUTE_INCIDENT) {
        m_state = VehicleState::ON_SCENE;
        m_stateTimerMinutes = m_assignedIncidentSeverity * 5.0;
        const Intersection* node = network.getNode(m_destinationNodeId);
        if (node) {
            m_x = node->x;
            m_y = node->y;
        }
    } else if (m_state == VehicleState::TRANSPORTING_HOSPITAL) {
        m_state = VehicleState::AT_HOSPITAL_TURNOVER;
        m_stateTimerMinutes = 10.0; // 10 min turnover cycle
        m_currentNodeId = m_assignedHospitalNode;
        const Intersection* hosp = network.getNode(m_assignedHospitalNode);
        if (hosp) {
            m_x = hosp->x;
            m_y = hosp->y;
        }
    } else if (m_state == VehicleState::RETURNING_TO_BASE) {
        EmergencyVehicle::onArrivedAtDestination(network, optimizer);
    }
}

void Ambulance::onStateTimerExpired(const RoadNetwork& network, RouteOptimizer& optimizer) {
    if (m_state == VehicleState::ON_SCENE) {
        // Patient stabilized -> transport to hospital
        m_state = VehicleState::TRANSPORTING_HOSPITAL;
        m_destinationNodeId = m_assignedHospitalNode;
        RouteResult route = optimizer.findShortestRoute(network, m_currentNodeId, m_assignedHospitalNode);
        if (route.reachable) {
            assignRoute(route.pathNodes, m_assignedHospitalNode, VehicleState::TRANSPORTING_HOSPITAL);
        } else {
            // Fallback: return to base if hospital unreachable
            m_state = VehicleState::RETURNING_TO_BASE;
            m_destinationNodeId = m_homeBaseNode;
            RouteResult baseRoute = optimizer.findShortestRoute(network, m_currentNodeId, m_homeBaseNode);
            if (baseRoute.reachable) {
                assignRoute(baseRoute.pathNodes, m_homeBaseNode, VehicleState::RETURNING_TO_BASE);
            }
        }
    } else if (m_state == VehicleState::AT_HOSPITAL_TURNOVER) {
        // Turnover and sanitation complete -> return to home station
        m_state = VehicleState::RETURNING_TO_BASE;
        m_destinationNodeId = m_homeBaseNode;
        RouteResult route = optimizer.findShortestRoute(network, m_currentNodeId, m_homeBaseNode);
        if (route.reachable) {
            assignRoute(route.pathNodes, m_homeBaseNode, VehicleState::RETURNING_TO_BASE);
        } else {
            m_state = VehicleState::IDLE_STATION;
        }
    }
}

std::string Ambulance::toJson() const {
    std::string baseJson = EmergencyVehicle::toJson();
    // Insert ambulance-specific properties before the closing brace
    if (baseJson.size() > 1 && baseJson.back() == '}') {
        baseJson.pop_back();
        std::ostringstream oss;
        oss << ",\"maxTriageLevel\":" << m_maxTriageLevel
            << ",\"hasParamedic\":" << (m_hasParamedic ? "true" : "false")
            << ",\"assignedHospitalNode\":\"" << m_assignedHospitalNode << "\"}";
        return baseJson + oss.str();
    }
    return baseJson;
}
