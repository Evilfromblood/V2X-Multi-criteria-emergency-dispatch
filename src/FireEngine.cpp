#include "FireEngine.h"
#include "RoadNetwork.h"
#include "RouteOptimizer.h"
#include "Incident.h"

#include <sstream>
#include <iomanip>
#include <algorithm>

FireEngine::FireEngine(std::string id, std::string homeBaseNode, double x, double y,
                       double waterCapacityLiters, double ladderLengthMeters, double speedKmH)
    : EmergencyVehicle(id, "FIRE_ENGINE", homeBaseNode, x, y, speedKmH),
      m_waterCapacityLiters(waterCapacityLiters), m_ladderLengthMeters(ladderLengthMeters) {
}

double FireEngine::calculateSuitability(const Incident& incident, const RoadNetwork& network, 
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

    double totalEtaMinutes = route.estimatedTimeMinutes + incident.getOffRoadApproachMinutes();

    double score = 100.0;

    // Time deduction: 3 points per minute of total ETA (road transit + off-grid approach)
    score -= (totalEtaMinutes * 3.0);

    // Suppression and equipment capability
    if (incident.getSeverity() >= 4) {
        // High severity fire or structural rescue demands high volume suppression and reach
        if (m_waterCapacityLiters >= 3500.0) {
            score += 25.0;
        } else {
            score -= 20.0;
        }

        if (m_ladderLengthMeters >= 30.0) {
            score += 15.0;
        } else {
            score -= 10.0;
        }
    } else {
        // Standard call
        score += (m_waterCapacityLiters / 1000.0) * 2.0;
    }

    // Mid-route intercept bonus
    if (m_state == VehicleState::RETURNING_TO_BASE) {
        score += 15.0;
    }

    if (score < 1.0) {
        score = 1.0;
    }

    return score;
}

void FireEngine::onArrivedAtDestination(const RoadNetwork& network, RouteOptimizer& optimizer) {
    if (m_state == VehicleState::EN_ROUTE_INCIDENT) {
        m_state = VehicleState::ON_SCENE;
        m_stateTimerMinutes = m_assignedIncidentSeverity * 5.0;
        const Intersection* node = network.getNode(m_destinationNodeId);
        if (node) {
            m_x = node->x;
            m_y = node->y;
        }
    } else if (m_state == VehicleState::RETURNING_TO_BASE) {
        m_state = VehicleState::IDLE_STATION;
        m_assignedIncidentId = "";
        m_destinationNodeId = m_homeBaseNode;
        m_currentNodeId = m_homeBaseNode;
        const Intersection* base = network.getNode(m_homeBaseNode);
        if (base) {
            m_x = base->x;
            m_y = base->y;
        }
    }
}

void FireEngine::onStateTimerExpired(const RoadNetwork& network, RouteOptimizer& optimizer) {
    if (m_state == VehicleState::ON_SCENE) {
        // Suppression finished -> return to station
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

std::string FireEngine::toJson() const {
    std::string baseJson = EmergencyVehicle::toJson();
    if (baseJson.size() > 1 && baseJson.back() == '}') {
        baseJson.pop_back();
        std::ostringstream oss;
        oss << ",\"waterCapacityLiters\":" << m_waterCapacityLiters
            << ",\"ladderLengthMeters\":" << m_ladderLengthMeters << "}";
        return baseJson + oss.str();
    }
    return baseJson;
}
