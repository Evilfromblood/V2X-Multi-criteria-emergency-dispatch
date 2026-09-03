#include "EmergencyVehicle.h"
#include "RoadNetwork.h"
#include "RouteOptimizer.h"
#include "Incident.h"

#include <sstream>
#include <iomanip>
#include <cmath>
#include <algorithm>

std::string vehicleStateToString(VehicleState state) {
    switch (state) {
        case VehicleState::IDLE_STATION: return "IDLE_STATION";
        case VehicleState::EN_ROUTE_INCIDENT: return "EN_ROUTE_INCIDENT";
        case VehicleState::ON_SCENE: return "ON_SCENE";
        case VehicleState::TRANSPORTING_HOSPITAL: return "TRANSPORTING_HOSPITAL";
        case VehicleState::AT_HOSPITAL_TURNOVER: return "AT_HOSPITAL_TURNOVER";
        case VehicleState::RETURNING_TO_BASE: return "RETURNING_TO_BASE";
        default: return "UNKNOWN";
    }
}

VehicleState stringToVehicleState(const std::string& stateStr) {
    if (stateStr == "IDLE_STATION") return VehicleState::IDLE_STATION;
    if (stateStr == "EN_ROUTE_INCIDENT") return VehicleState::EN_ROUTE_INCIDENT;
    if (stateStr == "ON_SCENE") return VehicleState::ON_SCENE;
    if (stateStr == "TRANSPORTING_HOSPITAL") return VehicleState::TRANSPORTING_HOSPITAL;
    if (stateStr == "AT_HOSPITAL_TURNOVER") return VehicleState::AT_HOSPITAL_TURNOVER;
    if (stateStr == "RETURNING_TO_BASE") return VehicleState::RETURNING_TO_BASE;
    return VehicleState::IDLE_STATION;
}

EmergencyVehicle::EmergencyVehicle(std::string id, std::string type, std::string homeBaseNode, 
                                   double x, double y, double speedKmH)
    : m_id(id), m_type(type), m_x(x), m_y(y), m_speedKmH(speedKmH),
      m_homeBaseNode(homeBaseNode), m_currentNodeId(homeBaseNode),
      m_destinationNodeId(homeBaseNode) {
}

bool EmergencyVehicle::isAvailableForDispatch() const {
    return (m_state == VehicleState::IDLE_STATION || m_state == VehicleState::RETURNING_TO_BASE);
}

void EmergencyVehicle::setAssignedIncident(const std::string& incidentId, int severity) {
    m_assignedIncidentId = incidentId;
    m_assignedIncidentSeverity = (severity < 1) ? 1 : ((severity > 5) ? 5 : severity);
}

void EmergencyVehicle::assignRoute(const std::vector<std::string>& path, 
                                  const std::string& destNode, 
                                  VehicleState newState) {
    m_activeRoutePath = path;
    m_destinationNodeId = destNode;
    m_state = newState;
    m_routeIndex = 0;
    m_progressOnSegmentKm = 0.0;
    if (!path.empty()) {
        m_currentNodeId = path[0];
    }
}

bool EmergencyVehicle::rerouteTo(const std::string& destNode, const RoadNetwork& network, 
                                RouteOptimizer& optimizer) {
    std::string startNode = m_currentNodeId;
    if (startNode.empty()) {
        startNode = network.getNearestNode(m_x, m_y);
    }
    RouteResult res = optimizer.findShortestRoute(network, startNode, destNode);
    if (res.reachable && !res.pathNodes.empty()) {
        assignRoute(res.pathNodes, destNode, m_state);
        return true;
    }
    return false;
}

void EmergencyVehicle::recallToBase(const RoadNetwork& network, RouteOptimizer& optimizer) {
    if (m_state == VehicleState::IDLE_STATION) return;
    m_destinationNodeId = m_homeBaseNode;
    m_assignedIncidentId = "";
    m_stateTimerMinutes = 0.0;
    std::string startNode = m_currentNodeId.empty() ? network.getNearestNode(m_x, m_y) : m_currentNodeId;
    RouteResult res = optimizer.findShortestRoute(network, startNode, m_homeBaseNode);
    if (res.reachable && !res.pathNodes.empty()) {
        assignRoute(res.pathNodes, m_homeBaseNode, VehicleState::RETURNING_TO_BASE);
    } else {
        m_state = VehicleState::IDLE_STATION;
        const Intersection* base = network.getNode(m_homeBaseNode);
        if (base) {
            m_x = base->x;
            m_y = base->y;
        }
    }
}

bool EmergencyVehicle::checkAndRerouteIfBlocked(const RoadNetwork& network, RouteOptimizer& optimizer) {
    if (m_state != VehicleState::EN_ROUTE_INCIDENT && 
        m_state != VehicleState::TRANSPORTING_HOSPITAL && 
        m_state != VehicleState::RETURNING_TO_BASE) {
        return false;
    }

    if (m_activeRoutePath.empty() || m_routeIndex + 1 >= m_activeRoutePath.size()) {
        return false;
    }

    // Check if any remaining segment is blocked
    bool blockedFound = false;
    for (size_t i = m_routeIndex; i + 1 < m_activeRoutePath.size(); ++i) {
        const RoadSegment* seg = network.getSegment(m_activeRoutePath[i], m_activeRoutePath[i+1]);
        if (seg && seg->isBlocked) {
            blockedFound = true;
            break;
        }
    }

    if (!blockedFound) {
        return false;
    }

    // Attempt to reroute from current node
    std::string startNode = m_currentNodeId;
    if (startNode.empty()) {
        startNode = network.getNearestNode(m_x, m_y);
    }
    RouteResult alt = optimizer.findShortestRoute(network, startNode, m_destinationNodeId);
    if (alt.reachable && !alt.pathNodes.empty()) {
        assignRoute(alt.pathNodes, m_destinationNodeId, m_state);
        return true;
    }
    return false;
}

void EmergencyVehicle::advanceSimulationTime(double deltaMinutes, const RoadNetwork& network, 
                                            RouteOptimizer& optimizer) {
    if (m_state == VehicleState::IDLE_STATION) {
        return;
    }

    if (m_state == VehicleState::ON_SCENE || m_state == VehicleState::AT_HOSPITAL_TURNOVER) {
        m_stateTimerMinutes -= deltaMinutes;
        if (m_stateTimerMinutes <= 0.0) {
            m_stateTimerMinutes = 0.0;
            onStateTimerExpired(network, optimizer);
        }
        return;
    }

    // Moving states: EN_ROUTE_INCIDENT, TRANSPORTING_HOSPITAL, RETURNING_TO_BASE
    if (m_state == VehicleState::EN_ROUTE_INCIDENT || 
        m_state == VehicleState::TRANSPORTING_HOSPITAL || 
        m_state == VehicleState::RETURNING_TO_BASE) {

        if (m_activeRoutePath.empty() || m_routeIndex + 1 >= m_activeRoutePath.size()) {
            onArrivedAtDestination(network, optimizer);
            return;
        }

        // Check if path is blocked and try to dynamically detour
        checkAndRerouteIfBlocked(network, optimizer);

        std::string u = m_activeRoutePath[m_routeIndex];
        std::string v = m_activeRoutePath[m_routeIndex + 1];
        const RoadSegment* seg = network.getSegment(u, v);

        // If the segment is blocked and no reroute was possible, vehicle must hold position
        if (seg && seg->isBlocked) {
            return;
        }

        double speedKmH = m_speedKmH;
        double segLength = 3.0;
        if (seg) {
            segLength = seg->lengthKm;
            double mult = (seg->congestionMultiplier < 1.0) ? 1.0 : seg->congestionMultiplier;
            double limit = (seg->speedLimitKmH <= 0.0) ? 50.0 : seg->speedLimitKmH;
            double effectiveLimit = limit / mult;
            speedKmH = std::min(m_speedKmH, effectiveLimit);
        }

        double distanceToMove = speedKmH * (deltaMinutes / 60.0);
        m_totalDistanceTraveledKm += distanceToMove;

        while (distanceToMove > 0.0 && m_routeIndex + 1 < m_activeRoutePath.size()) {
            u = m_activeRoutePath[m_routeIndex];
            v = m_activeRoutePath[m_routeIndex + 1];
            seg = network.getSegment(u, v);
            segLength = seg ? seg->lengthKm : 3.0;

            double segmentRemaining = segLength - m_progressOnSegmentKm;
            if (distanceToMove >= segmentRemaining) {
                // Completed this segment
                distanceToMove -= segmentRemaining;
                m_routeIndex++;
                m_currentNodeId = v;
                m_progressOnSegmentKm = 0.0;

                const Intersection* nodeV = network.getNode(v);
                if (nodeV) {
                    m_x = nodeV->x;
                    m_y = nodeV->y;
                }

                if (m_routeIndex + 1 >= m_activeRoutePath.size()) {
                    // Arrived at destination
                    onArrivedAtDestination(network, optimizer);
                    break;
                }
            } else {
                // Moved partially along this segment
                m_progressOnSegmentKm += distanceToMove;
                distanceToMove = 0.0;

                const Intersection* nodeU = network.getNode(u);
                const Intersection* nodeV = network.getNode(v);
                if (nodeU && nodeV && segLength > 0.0) {
                    double ratio = m_progressOnSegmentKm / segLength;
                    if (ratio > 1.0) ratio = 1.0;
                    m_x = nodeU->x + ratio * (nodeV->x - nodeU->x);
                    m_y = nodeU->y + ratio * (nodeV->y - nodeU->y);
                }
            }
        }
    }
}

void EmergencyVehicle::onArrivedAtDestination(const RoadNetwork& network, RouteOptimizer& optimizer) {
    if (m_state == VehicleState::EN_ROUTE_INCIDENT) {
        m_state = VehicleState::ON_SCENE;
        m_stateTimerMinutes = m_assignedIncidentSeverity * 5.0; // 5 mins per severity level
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

void EmergencyVehicle::onStateTimerExpired(const RoadNetwork& network, RouteOptimizer& optimizer) {
    if (m_state == VehicleState::ON_SCENE) {
        // Default behavior: return to base
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

std::string EmergencyVehicle::toJson() const {
    std::ostringstream oss;
    oss << std::fixed << std::setprecision(2);
    oss << "{\"id\":\"" << m_id << "\","
        << "\"type\":\"" << m_type << "\","
        << "\"state\":\"" << vehicleStateToString(m_state) << "\","
        << "\"x\":" << m_x << ","
        << "\"y\":" << m_y << ","
        << "\"speedKmH\":" << m_speedKmH << ","
        << "\"homeBaseNode\":\"" << m_homeBaseNode << "\","
        << "\"currentNodeId\":\"" << m_currentNodeId << "\","
        << "\"destinationNodeId\":\"" << m_destinationNodeId << "\","
        << "\"stateTimerMinutes\":" << m_stateTimerMinutes << ","
        << "\"assignedIncidentId\":\"" << m_assignedIncidentId << "\","
        << "\"assignedIncidentSeverity\":" << m_assignedIncidentSeverity << ","
        << "\"totalDistanceTraveledKm\":" << m_totalDistanceTraveledKm << ","
        << "\"activeRoutePath\":[";
    for (size_t i = 0; i < m_activeRoutePath.size(); ++i) {
        if (i > 0) oss << ",";
        oss << "\"" << m_activeRoutePath[i] << "\"";
    }
    oss << "]}";
    return oss.str();
}
