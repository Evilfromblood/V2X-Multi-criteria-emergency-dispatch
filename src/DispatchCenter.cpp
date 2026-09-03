#include "DispatchCenter.h"
#include <sstream>
#include <iomanip>
#include <algorithm>
#include <iostream>
#include <cmath>

DispatchCenter::DispatchCenter() {
    resetSimulation();
}

void DispatchCenter::resetSimulation() {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_currentClockMinutes = 0.0;
    m_incidentCounter = 1;

    m_network = RoadNetwork::createDefaultCityGrid();
    m_v2xHub.clearAllHazards(m_network);
    m_analytics.reset();
    m_fleet.clear();
    m_incidents.clear();

    initializeDefaultFleet();
}

void DispatchCenter::initializeDefaultFleet() {
    // Deploy a modern emergency response fleet stationed strategically across city depots
    
    // Central HQ (N1_HQ - Southwest Core)
    m_fleet.push_back(std::make_unique<Ambulance>("AMB-101", "N1_HQ", 2.0, 2.0, 5, true, 65.0)); // ALS with Paramedic
    m_fleet.push_back(std::make_unique<Ambulance>("AMB-102", "N1_HQ", 2.0, 2.0, 3, false, 65.0)); // BLS standard
    m_fleet.push_back(std::make_unique<FireEngine>("ENG-201", "N1_HQ", 2.0, 2.0, 4500.0, 32.0, 55.0)); // Heavy Pumper & Aerial

    // East Depot (N3 - Southeast Core)
    m_fleet.push_back(std::make_unique<Ambulance>("AMB-103", "N3", 8.0, 2.0, 4, true, 65.0));
    m_fleet.push_back(std::make_unique<FireEngine>("ENG-202", "N3", 8.0, 2.0, 3800.0, 28.0, 55.0));

    // Northwest Base (N9 - Northwest Core)
    m_fleet.push_back(std::make_unique<Ambulance>("AMB-104", "N9", 2.0, 8.0, 3, false, 65.0));
    m_fleet.push_back(std::make_unique<FireEngine>("ENG-203", "N9", 2.0, 8.0, 5000.0, 35.0, 55.0)); // Heavy Industrial Pumper

    // North Sector: Logistics Depot Hub (N17_LOGISTICS)
    m_fleet.push_back(std::make_unique<FireEngine>("ENG-204", "N17_LOGISTICS", 5.0, 17.0, 5500.0, 36.0, 55.0));

    // West Sector: Airport Emergency Station (N26_AIRPORT_DEPOT)
    m_fleet.push_back(std::make_unique<FireEngine>("ENG-205", "N26_AIRPORT_DEPOT", 1.0, 8.0, 6000.0, 40.0, 60.0));
}

void DispatchCenter::addVehicle(std::unique_ptr<EmergencyVehicle> vehicle) {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_fleet.push_back(std::move(vehicle));
}

EmergencyVehicle* DispatchCenter::getVehicleById(const std::string& id) {
    for (auto& v : m_fleet) {
        if (v->getId() == id) {
            return v.get();
        }
    }
    return nullptr;
}

std::string DispatchCenter::createIncident(const std::string& type, int severity, 
                                           double x, double y, const std::string& desc,
                                           const std::string& customId) {
    std::lock_guard<std::mutex> lock(m_mutex);

    std::string id = customId.empty() ? ("INC-" + std::to_string(m_incidentCounter++)) : customId;

    // Explicit Bounding Box Clamping [0.5, 24.5] km
    double clampedX = std::max(0.5, std::min(24.5, x));
    double clampedY = std::max(0.5, std::min(24.5, y));

    std::string nearestNode = m_network.getNearestNode(clampedX, clampedY);

    Incident inc(id, type, severity, clampedX, clampedY, desc.empty() ? (type + " Level " + std::to_string(severity)) : desc);
    inc.setNearestNodeId(nearestNode);

    // Off-Grid First/Last-Mile Transit Penalty Calculation
    const Intersection* node = m_network.getNode(nearestNode);
    if (node) {
        double dx = clampedX - node->x;
        double dy = clampedY - node->y;
        double offRoadDistKm = std::sqrt(dx * dx + dy * dy);
        inc.setOffRoadApproach(offRoadDistKm, 20.0); // 20 km/h local approach speed penalty
    }

    inc.setCreatedAtMinutes(m_currentClockMinutes);

    m_incidents.push_back(inc);

    std::string penaltyMsg = "";
    if (inc.getOffRoadDistanceKm() > 0.1) {
        std::ostringstream poss;
        poss << std::fixed << std::setprecision(1);
        poss << " (+" << inc.getOffRoadDistanceKm() << "km off-grid, +" 
             << inc.getOffRoadApproachMinutes() << "m approach)";
        penaltyMsg = poss.str();
    }

    m_analytics.logEvent(m_currentClockMinutes, "INCIDENT_CREATED", id, "DISPATCH",
                         "Incident reported at (" + std::to_string((int)clampedX) + "," + std::to_string((int)clampedY) + 
                         ") near " + nearestNode + penaltyMsg + " (Severity " + std::to_string(severity) + ")");

    attemptDispatch(m_incidents.back());

    return id;
}

bool DispatchCenter::attemptDispatch(Incident& incident, bool canPreempt) {
    if (incident.getStatus() == "RESOLVED" || incident.getStatus() == "ON_SCENE") {
        return true;
    }

    int reqAmb = incident.getRequiredAmbulances();
    int reqEng = incident.getRequiredFireEngines();

    struct Candidate {
        EmergencyVehicle* vehicle;
        double score;
        RouteResult route;
    };

    std::vector<Candidate> ambCandidates;
    std::vector<Candidate> engCandidates;

    for (auto& v : m_fleet) {
        if (!v->isAvailableForDispatch()) {
            continue;
        }

        double score = v->calculateSuitability(incident, m_network, m_optimizer);
        if (score < 0.0) {
            continue; // Infeasible / unreachable
        }

        std::string startNode = v->getCurrentNodeId();
        if (startNode.empty()) startNode = m_network.getNearestNode(v->getX(), v->getY());
        RouteResult r = m_optimizer.findShortestRoute(m_network, startNode, incident.getNearestNodeId());

        if (!r.reachable) {
            continue;
        }

        if (v->getType() == "AMBULANCE") {
            ambCandidates.push_back({v.get(), score, r});
        } else if (v->getType() == "FIRE_ENGINE") {
            engCandidates.push_back({v.get(), score, r});
        }
    }

    // Sort by suitability descending
    std::sort(ambCandidates.begin(), ambCandidates.end(), [](const Candidate& a, const Candidate& b) {
        return a.score > b.score;
    });
    std::sort(engCandidates.begin(), engCandidates.end(), [](const Candidate& a, const Candidate& b) {
        return a.score > b.score;
    });

    // Check if atomic package dispatch can be satisfied
    if (static_cast<int>(ambCandidates.size()) >= reqAmb && 
        static_cast<int>(engCandidates.size()) >= reqEng) {

        incident.clearAssignedVehicles();

        for (int i = 0; i < reqAmb; ++i) {
            auto* amb = ambCandidates[i].vehicle;
            amb->setAssignedIncident(incident.getId(), incident.getSeverity());
            amb->assignRoute(ambCandidates[i].route.pathNodes, incident.getNearestNodeId(), VehicleState::EN_ROUTE_INCIDENT);
            incident.addAssignedVehicle(amb->getId());

            m_analytics.logEvent(m_currentClockMinutes, "DISPATCH", incident.getId(), amb->getId(),
                                 "Dispatched " + amb->getId() + " (Score: " + std::to_string((int)ambCandidates[i].score) + 
                                 ", ETA: " + std::to_string((int)ambCandidates[i].route.estimatedTimeMinutes) + "m)");
        }

        for (int i = 0; i < reqEng; ++i) {
            auto* eng = engCandidates[i].vehicle;
            eng->setAssignedIncident(incident.getId(), incident.getSeverity());
            eng->assignRoute(engCandidates[i].route.pathNodes, incident.getNearestNodeId(), VehicleState::EN_ROUTE_INCIDENT);
            incident.addAssignedVehicle(eng->getId());

            m_analytics.logEvent(m_currentClockMinutes, "DISPATCH", incident.getId(), eng->getId(),
                                 "Dispatched " + eng->getId() + " (Score: " + std::to_string((int)engCandidates[i].score) + 
                                 ", ETA: " + std::to_string((int)engCandidates[i].route.estimatedTimeMinutes) + "m)");
        }

        incident.setStatus("DISPATCHED");
        incident.setDispatchedAtMinutes(m_currentClockMinutes);
        m_analytics.recordIncidentDispatched();
        return true;
    }

    // Fleet saturated: Check for Priority Preemption for high-severity calls (Severity 5)
    if (incident.getSeverity() >= 5 && canPreempt) {
        if (attemptPriorityPreemption(incident)) {
            return true;
        }
    }

    incident.setStatus("PENDING");
    return false;
}

bool DispatchCenter::attemptPriorityPreemption(Incident& highSeverityIncident) {
    int reqAmb = highSeverityIncident.getRequiredAmbulances();
    int reqEng = highSeverityIncident.getRequiredFireEngines();

    int availableAmbCount = 0;
    int availableEngCount = 0;
    for (auto& v : m_fleet) {
        if (v->isAvailableForDispatch()) {
            if (v->getType() == "AMBULANCE") availableAmbCount++;
            else if (v->getType() == "FIRE_ENGINE") availableEngCount++;
        }
    }

    int neededAmb = reqAmb - availableAmbCount;
    int neededEng = reqEng - availableEngCount;
    if (neededAmb <= 0 && neededEng <= 0) {
        return false;
    }

    std::vector<EmergencyVehicle*> preemptedVehicles;

    // Search for low-severity (severity 1 or 2) active calls that can be preempted
    for (auto& v : m_fleet) {
        if (v->getState() == VehicleState::EN_ROUTE_INCIDENT) {
            if (v->getAssignedIncidentSeverity() <= 2) {
                if (v->getType() == "AMBULANCE" && neededAmb > 0) {
                    preemptedVehicles.push_back(v.get());
                    neededAmb--;
                } else if (v->getType() == "FIRE_ENGINE" && neededEng > 0) {
                    preemptedVehicles.push_back(v.get());
                    neededEng--;
                }
            }
        }
        if (neededAmb <= 0 && neededEng <= 0) break;
    }

    if (neededAmb <= 0 && neededEng <= 0 && !preemptedVehicles.empty()) {
        // Preempt low severity vehicles and reassign to high severity call
        for (auto* v : preemptedVehicles) {
            std::string oldIncId = v->getAssignedIncidentId();
            for (auto& oldInc : m_incidents) {
                if (oldInc.getId() == oldIncId) {
                    oldInc.setStatus("PREEMPTED_QUEUED");
                    break;
                }
            }

            m_analytics.logEvent(m_currentClockMinutes, "PREEMPTION", highSeverityIncident.getId(), v->getId(),
                                 "Preempted " + v->getId() + " from " + oldIncId + " for Critical Level 5 Emergency");
            m_analytics.recordPreemption();

            // Set vehicle state to RETURNING_TO_BASE so it becomes available for dispatch
            v->setState(VehicleState::RETURNING_TO_BASE);
            v->setAssignedIncident("", 1);
        }

        // Now run standard dispatch without recursion
        return attemptDispatch(highSeverityIncident, false);
    }

    return false;
}

void DispatchCenter::advanceSimulationClock(double deltaMinutes) {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_currentClockMinutes += deltaMinutes;

    // Advance all vehicles
    for (auto& v : m_fleet) {
        VehicleState prevState = v->getState();
        v->advanceSimulationTime(deltaMinutes, m_network, m_optimizer);
        VehicleState newState = v->getState();

        if (prevState != newState) {
            if (newState == VehicleState::ON_SCENE) {
                m_analytics.logEvent(m_currentClockMinutes, "ARRIVAL", v->getAssignedIncidentId(), v->getId(),
                                     v->getId() + " arrived ON_SCENE at " + v->getCurrentNodeId());
            } else if (newState == VehicleState::AT_HOSPITAL_TURNOVER) {
                m_analytics.logEvent(m_currentClockMinutes, "HOSPITAL_DROP", v->getAssignedIncidentId(), v->getId(),
                                     v->getId() + " patient transfer at hospital " + v->getCurrentNodeId());
            } else if (newState == VehicleState::RETURNING_TO_BASE) {
                m_analytics.logEvent(m_currentClockMinutes, "RETURN_BASE", v->getAssignedIncidentId(), v->getId(),
                                     v->getId() + " clearing scene, returning to base " + v->getHomeBaseNode());
            } else if (newState == VehicleState::IDLE_STATION) {
                m_analytics.logEvent(m_currentClockMinutes, "IDLE_STATION", "", v->getId(),
                                     v->getId() + " returned to home base station and is available");
            }
        }
    }

    // Process Incident transitions
    for (auto& inc : m_incidents) {
        if (inc.getStatus() == "DISPATCHED") {
            // Check if any vehicle has arrived
            bool anyOnScene = false;
            for (const auto& vid : inc.getAssignedVehicleIds()) {
                EmergencyVehicle* v = getVehicleById(vid);
                if (v && (v->getState() == VehicleState::ON_SCENE || 
                          v->getState() == VehicleState::TRANSPORTING_HOSPITAL ||
                          v->getState() == VehicleState::AT_HOSPITAL_TURNOVER)) {
                    anyOnScene = true;
                    break;
                }
            }
            if (anyOnScene) {
                inc.setStatus("ON_SCENE");
                if (inc.getFirstArrivalMinutes() < 0.0) {
                    inc.setFirstArrivalMinutes(m_currentClockMinutes);
                }
            }
        } else if (inc.getStatus() == "ON_SCENE") {
            // Check if all assigned vehicles have finished scene operations
            bool allClearedScene = true;
            for (const auto& vid : inc.getAssignedVehicleIds()) {
                EmergencyVehicle* v = getVehicleById(vid);
                if (v && (v->getState() == VehicleState::ON_SCENE || 
                          v->getState() == VehicleState::EN_ROUTE_INCIDENT)) {
                    allClearedScene = false;
                    break;
                }
            }

            if (allClearedScene) {
                inc.setStatus("RESOLVED");
                inc.setResolvedAtMinutes(m_currentClockMinutes);
                double eta = (inc.getFirstArrivalMinutes() >= 0.0) ? 
                             (inc.getFirstArrivalMinutes() - inc.getCreatedAtMinutes()) : 0.0;
                double totalDuration = m_currentClockMinutes - inc.getCreatedAtMinutes();
                m_analytics.recordIncidentResolved(eta, totalDuration);

                m_analytics.logEvent(m_currentClockMinutes, "INCIDENT_RESOLVED", inc.getId(), "DISPATCH",
                                     "Incident " + inc.getId() + " fully resolved (Response: " + 
                                     std::to_string((int)eta) + "m, Total: " + 
                                     std::to_string((int)totalDuration) + "m)");
            }
        }
    }

    // Retry queued calls (PENDING or PREEMPTED_QUEUED)
    for (auto& inc : m_incidents) {
        if (inc.getStatus() == "PENDING" || inc.getStatus() == "PREEMPTED_QUEUED") {
            attemptDispatch(inc);
        }
    }
}

bool DispatchCenter::injectHazard(const std::string& from, const std::string& to, 
                                 const std::string& hazardType, double multiplier, 
                                 bool isBlocked, const std::string& desc) {
    std::lock_guard<std::mutex> lock(m_mutex);
    bool ok = m_v2xHub.broadcastHazard(m_network, from, to, hazardType, multiplier, isBlocked, desc, m_currentClockMinutes);
    if (ok) {
        m_analytics.logEvent(m_currentClockMinutes, "HAZARD_INJECTED", "", from + "-" + to,
                             "V2X Alert: " + hazardType + " on " + from + "-" + to + 
                             (isBlocked ? " (ROAD CLOSED)" : (" (x" + std::to_string((int)multiplier) + " Delay)")));
        checkAndRerouteFleet();
    }
    return ok;
}

bool DispatchCenter::resolveHazard(const std::string& from, const std::string& to) {
    std::lock_guard<std::mutex> lock(m_mutex);
    bool ok = m_v2xHub.resolveHazard(m_network, from, to);
    if (ok) {
        m_analytics.logEvent(m_currentClockMinutes, "HAZARD_RESOLVED", "", from + "-" + to,
                             "V2X Alert Cleared: " + from + "-" + to + " restored to free-flow");
        checkAndRerouteFleet();
    }
    return ok;
}

void DispatchCenter::checkAndRerouteFleet() {
    for (auto& v : m_fleet) {
        if (v->checkAndRerouteIfBlocked(m_network, m_optimizer)) {
            m_analytics.recordDynamicReroute();
            m_analytics.logEvent(m_currentClockMinutes, "V2X_REROUTE", v->getAssignedIncidentId(), v->getId(),
                                 "Dynamic V2X Reroute: " + v->getId() + " detoured around hazard to " + v->getDestinationNodeId());
        }
    }
}

std::string DispatchCenter::getFullTelemetryJson() const {
    std::lock_guard<std::mutex> lock(m_mutex);
    std::ostringstream oss;
    oss << std::fixed << std::setprecision(2);
    oss << "{\"clockMinutes\":" << m_currentClockMinutes << ","
        << "\"network\":" << m_network.toJson() << ","
        << "\"fleet\":[";
    for (size_t i = 0; i < m_fleet.size(); ++i) {
        if (i > 0) oss << ",";
        oss << m_fleet[i]->toJson();
    }
    oss << "],\"incidents\":[";
    for (size_t i = 0; i < m_incidents.size(); ++i) {
        if (i > 0) oss << ",";
        oss << m_incidents[i].toJson();
    }
    oss << "],\"hazards\":" << m_v2xHub.toJson() << ","
        << "\"analytics\":" << m_analytics.toJson() << "}";
    return oss.str();
}
