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
        case VehicleState::REFUELING_DEPOT: return "REFUELING_DEPOT";
        case VehicleState::REPLENISHING_WATER: return "REPLENISHING_WATER";
        case VehicleState::SEEKING_RESUPPLY: return "SEEKING_RESUPPLY";
        case VehicleState::STAGED_AT_PERIMETER: return "STAGED_AT_PERIMETER";
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
    if (stateStr == "REFUELING_DEPOT") return VehicleState::REFUELING_DEPOT;
    if (stateStr == "REPLENISHING_WATER") return VehicleState::REPLENISHING_WATER;
    if (stateStr == "SEEKING_RESUPPLY") return VehicleState::SEEKING_RESUPPLY;
    if (stateStr == "STAGED_AT_PERIMETER") return VehicleState::STAGED_AT_PERIMETER;
    return VehicleState::IDLE_STATION;
}

EmergencyVehicle::EmergencyVehicle(std::string id, std::string type, std::string homeBaseNode, 
                                   double x, double y, double speedKmH)
    : m_id(id), m_type(type), m_x(x), m_y(y), m_speedKmH(speedKmH),
      m_homeBaseNode(homeBaseNode), m_currentNodeId(homeBaseNode),
      m_destinationNodeId(homeBaseNode) {
    if (m_type == "AMBULANCE") {
        m_maxFuelLiters = 80.0;
        m_currentFuelLiters = 80.0;
    } else {
        m_maxFuelLiters = 250.0;
        m_currentFuelLiters = 250.0;
    }
}

bool EmergencyVehicle::isAvailableForDispatch() const {
    if (isLowFuel() || isLowWater()) return false;
    if (m_state == VehicleState::REFUELING_DEPOT || 
        m_state == VehicleState::REPLENISHING_WATER || 
        m_state == VehicleState::SEEKING_RESUPPLY ||
        m_state == VehicleState::STAGED_AT_PERIMETER) {
        return false;
    }
    return (m_state == VehicleState::IDLE_STATION || m_state == VehicleState::RETURNING_TO_BASE);
}

std::string EmergencyVehicle::getResupplyStatus() const {
    if (m_state == VehicleState::REFUELING_DEPOT) return "REFUELING";
    if (m_state == VehicleState::REPLENISHING_WATER) return "REPLENISHING_WATER";
    if (m_state == VehicleState::SEEKING_RESUPPLY) return "SEEKING_RESUPPLY";
    if (isLowFuel()) return "LOW_FUEL";
    if (isLowWater()) return "LOW_WATER";
    return m_resupplyStatus;
}

void EmergencyVehicle::detourToResupply(const std::string& depotNode, const RoadNetwork& network, RouteOptimizer& optimizer) {
    m_state = VehicleState::SEEKING_RESUPPLY;
    m_resupplyStatus = "SEEKING_RESUPPLY";
    m_destinationNodeId = depotNode;

    std::string start = m_currentNodeId;
    if (start.empty()) start = network.getNearestNode(m_x, m_y);

    RouteResult route = optimizer.findShortestRoute(network, start, depotNode);
    if (route.reachable) {
        assignRoute(route.pathNodes, depotNode, VehicleState::SEEKING_RESUPPLY);
    }
}

void EmergencyVehicle::setAssignedIncident(const std::string& incidentId, int severity) {
    m_assignedIncidentId = incidentId;
    m_assignedIncidentSeverity = severity;
    if (incidentId.empty()) {
        clearStaging();
    }
}

void EmergencyVehicle::assignRoute(const std::vector<std::string>& path, const std::string& destNode, VehicleState newState) {
    m_activeRoutePath = path;
    m_routeIndex = 0;
    m_progressOnSegmentKm = 0.0;
    m_destinationNodeId = destNode;
    m_state = newState;
}

bool EmergencyVehicle::rerouteTo(const std::string& destNode, const RoadNetwork& network, RouteOptimizer& optimizer) {
    std::string startNode = m_currentNodeId;
    if (startNode.empty()) {
        startNode = network.getNearestNode(m_x, m_y);
    }

    RouteResult route = optimizer.findShortestRoute(network, startNode, destNode);
    if (route.reachable) {
        assignRoute(route.pathNodes, destNode, m_state);
        return true;
    }
    return false;
}

bool EmergencyVehicle::checkAndRerouteIfBlocked(const RoadNetwork& network, RouteOptimizer& optimizer) {
    if (m_activeRoutePath.empty() || m_routeIndex + 1 >= m_activeRoutePath.size()) {
        return false;
    }

    // Check if any upcoming segment on current active route is blocked
    bool blockedAhead = false;
    for (size_t i = m_routeIndex; i + 1 < m_activeRoutePath.size(); ++i) {
        const RoadSegment* seg = network.getSegment(m_activeRoutePath[i], m_activeRoutePath[i + 1]);
        if (seg && seg->isBlocked) {
            blockedAhead = true;
            break;
        }
    }

    if (!blockedAhead) {
        return false;
    }

    // Reroute from next accessible node
    std::string start = m_activeRoutePath[m_routeIndex];
    RouteResult newRoute = optimizer.findShortestRoute(network, start, m_destinationNodeId);
    if (newRoute.reachable) {
        assignRoute(newRoute.pathNodes, m_destinationNodeId, m_state);
        return true;
    }

    // If direct destination is unreachable and vehicle is en route to an incident, attempt perimeter staging route
    if (m_state == VehicleState::EN_ROUTE_INCIDENT && !m_assignedIncidentId.empty()) {
        const Intersection* destInter = network.getNode(m_destinationNodeId);
        double targetX = destInter ? destInter->x : m_x;
        double targetY = destInter ? destInter->y : m_y;
        PerimeterRouteResult pRoute = optimizer.findPerimeterStagingRoute(network, start, m_destinationNodeId, targetX, targetY);
        if (pRoute.stagingFeasible && !pRoute.stagingNodeId.empty() && pRoute.stagingNodeId != start) {
            setStagingTarget(m_assignedIncidentId, pRoute.stagingNodeId, pRoute.straightLineDistanceToTargetKm);
            assignRoute(pRoute.pathNodes, pRoute.stagingNodeId, VehicleState::EN_ROUTE_INCIDENT);
            return true;
        }
    }

    return false;
}

void EmergencyVehicle::recallToBase(const RoadNetwork& network, RouteOptimizer& optimizer) {
    m_assignedIncidentId = "";
    m_assignedIncidentSeverity = 1;
    clearStaging();
    m_destinationNodeId = m_homeBaseNode;

    std::string start = m_currentNodeId;
    if (start.empty()) {
        start = network.getNearestNode(m_x, m_y);
    }

    RouteResult route = optimizer.findShortestRoute(network, start, m_homeBaseNode);
    if (route.reachable) {
        assignRoute(route.pathNodes, m_homeBaseNode, VehicleState::RETURNING_TO_BASE);
    } else {
        m_state = VehicleState::IDLE_STATION;
        const Intersection* base = network.getNode(m_homeBaseNode);
        if (base) {
            m_x = base->x;
            m_y = base->y;
        }
    }
}

void EmergencyVehicle::advanceSimulationTime(double deltaMinutes, const RoadNetwork& network, RouteOptimizer& optimizer) {
    if (m_state == VehicleState::IDLE_STATION) {
        return;
    }

    // Holding at Perimeter Staging
    if (m_state == VehicleState::STAGED_AT_PERIMETER) {
        // Idle burn while holding at perimeter staging: 0.05 L/min
        burnFuel(0.05 * deltaMinutes);
        return;
    }

    // Timed stationary states: ON_SCENE, AT_HOSPITAL_TURNOVER, REFUELING_DEPOT, REPLENISHING_WATER
    if (m_state == VehicleState::ON_SCENE || 
        m_state == VehicleState::AT_HOSPITAL_TURNOVER ||
        m_state == VehicleState::REFUELING_DEPOT ||
        m_state == VehicleState::REPLENISHING_WATER) {

        // Idle scene burn rate: 0.05 L/min
        burnFuel(0.05 * deltaMinutes);

        // Water suppression depletion for structural fires (Severity 3-5) at 250 L/min
        if (m_state == VehicleState::ON_SCENE && m_type == "FIRE_ENGINE" && m_assignedIncidentSeverity >= 3) {
            dischargeWater(250.0 * deltaMinutes);
            if (getCurrentWaterLiters() <= 0.0) {
                m_savedIncidentId = m_assignedIncidentId;
                m_savedSceneTimerMinutes = m_stateTimerMinutes;
                detourToResupply(m_homeBaseNode, network, optimizer);
                return;
            }
        }

        m_stateTimerMinutes -= deltaMinutes;
        if (m_stateTimerMinutes <= 0.0) {
            m_stateTimerMinutes = 0.0;
            onStateTimerExpired(network, optimizer);
        }
        return;
    }

    // Moving states: EN_ROUTE_INCIDENT, TRANSPORTING_HOSPITAL, RETURNING_TO_BASE, SEEKING_RESUPPLY
    if (m_state == VehicleState::EN_ROUTE_INCIDENT || 
        m_state == VehicleState::TRANSPORTING_HOSPITAL || 
        m_state == VehicleState::RETURNING_TO_BASE ||
        m_state == VehicleState::SEEKING_RESUPPLY) {

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
            burnFuel(0.05 * deltaMinutes); // Idle burn while holding
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

        // Transit fuel burn rate: 0.15 L/km
        burnFuel(0.15 * distanceToMove);

        // Check low fuel safety threshold (< 20%) while returning to base
        if (isLowFuel() && m_state == VehicleState::RETURNING_TO_BASE) {
            m_state = VehicleState::SEEKING_RESUPPLY;
            m_resupplyStatus = "SEEKING_RESUPPLY";
        }

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
        // Check if arrived at a perimeter staging node rather than incident scene
        if (!m_perimeterStagingNodeId.empty() && m_destinationNodeId == m_perimeterStagingNodeId) {
            m_state = VehicleState::STAGED_AT_PERIMETER;
            m_isStagedAtPerimeter = true;
            m_currentNodeId = m_destinationNodeId;
            const Intersection* node = network.getNode(m_destinationNodeId);
            if (node) {
                m_x = node->x;
                m_y = node->y;
            }
            return;
        }

        m_state = VehicleState::ON_SCENE;
        m_stateTimerMinutes = (m_savedSceneTimerMinutes > 0.0) ? m_savedSceneTimerMinutes : (m_assignedIncidentSeverity * 5.0);
        m_savedSceneTimerMinutes = 0.0;
        const Intersection* node = network.getNode(m_destinationNodeId);
        if (node) {
            m_x = node->x;
            m_y = node->y;
        }
    } else if (m_state == VehicleState::SEEKING_RESUPPLY) {
        const Intersection* node = network.getNode(m_destinationNodeId);
        if (node) {
            m_x = node->x;
            m_y = node->y;
        }
        m_currentNodeId = m_destinationNodeId;
        if (isLowWater()) {
            startWaterReplenishment();
        } else {
            startRefueling();
        }
    } else if (m_state == VehicleState::RETURNING_TO_BASE) {
        m_assignedIncidentId = "";
        clearStaging();
        m_destinationNodeId = m_homeBaseNode;
        m_currentNodeId = m_homeBaseNode;
        const Intersection* base = network.getNode(m_homeBaseNode);
        if (base) {
            m_x = base->x;
            m_y = base->y;
        }
        if (isLowFuel()) {
            startRefueling();
        } else {
            m_state = VehicleState::IDLE_STATION;
        }
    }
}

void EmergencyVehicle::onStateTimerExpired(const RoadNetwork& network, RouteOptimizer& optimizer) {
    if (m_state == VehicleState::ON_SCENE) {
        // Default behavior: return to base
        m_state = VehicleState::RETURNING_TO_BASE;
        m_destinationNodeId = m_homeBaseNode;
        clearStaging();
        RouteResult route = optimizer.findShortestRoute(network, m_currentNodeId, m_homeBaseNode);
        if (route.reachable) {
            assignRoute(route.pathNodes, m_homeBaseNode, VehicleState::RETURNING_TO_BASE);
        } else {
            m_state = VehicleState::IDLE_STATION;
        }
    } else if (m_state == VehicleState::REFUELING_DEPOT) {
        refuel();
        m_state = VehicleState::IDLE_STATION;
    } else if (m_state == VehicleState::REPLENISHING_WATER) {
        replenishWater();
        m_state = VehicleState::IDLE_STATION;
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
        << "\"currentFuelLiters\":" << m_currentFuelLiters << ","
        << "\"maxFuelLiters\":" << m_maxFuelLiters << ","
        << "\"fuelPercentage\":" << getFuelPercentage() << ","
        << "\"resupplyStatus\":\"" << getResupplyStatus() << "\","
        << "\"isStagedAtPerimeter\":" << (isStagedAtPerimeter() ? "true" : "false") << ","
        << "\"perimeterStagingNodeId\":\"" << m_perimeterStagingNodeId << "\","
        << "\"stagingDistanceKm\":" << m_stagingDistanceKm << ","
        << "\"waterPercentage\":" << (m_type == "FIRE_ENGINE" ? std::to_string(getWaterPercentage()) : "null") << ","
        << "\"currentWaterLiters\":" << (m_type == "FIRE_ENGINE" ? std::to_string(getCurrentWaterLiters()) : "null") << ","
        << "\"activeRoutePath\":[";
    for (size_t i = 0; i < m_activeRoutePath.size(); ++i) {
        if (i > 0) oss << ",";
        oss << "\"" << m_activeRoutePath[i] << "\"";
    }
    oss << "]}";
    return oss.str();
}
