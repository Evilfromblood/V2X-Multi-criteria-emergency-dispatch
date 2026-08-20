#include "DispatchCenter.h"
#include "CLIDashboard.h"
#include <iostream>
#include <iomanip>
#include <cmath>

DispatchCenter::DispatchCenter(RoadNetwork* net, RouteOptimizer* opt) 
    : network(net), optimizer(opt) {}

void DispatchCenter::addVehicle(std::unique_ptr<EmergencyVehicle> vehicle) {
    fleet.push_back(std::move(vehicle));
}

void DispatchCenter::printFleetStatus() const {
    CLIDashboard::printFleetTable(fleet);
}

void DispatchCenter::addIncident(const Incident& incident) {
    activeIncidents.push_back(incident);
}

EmergencyVehicle* DispatchCenter::findBestVehicle(const Incident& incident, double& bestTime) const {
    EmergencyVehicle* bestVehicle = nullptr;
    double highestScore = -1.0;
    bestTime = -1.0;

    std::string incidentNode = "";
    if (network) {
        incidentNode = network->getNearestNode(incident.getPosX(), incident.getPosY());
    }

    // Pass 1: Find best available vehicle
    for (const auto& vehicle : fleet) {
        if (!vehicle->isAvailable()) {
            continue;
        }

        double travelTimeMin = -1.0;
        if (network && optimizer) {
            std::string vehicleNode = network->getNearestNode(vehicle->getPosX(), vehicle->getPosY());
            RouteResult route = optimizer->calculateFastestRoute(*network, vehicleNode, incidentNode);
            if (route.reachable) {
                travelTimeMin = route.estimatedTimeMinutes;
            } else {
                continue; // Cannot reach
            }
        } else {
            // Fallback to Euclidean
            double dx = incident.getPosX() - vehicle->getPosX();
            double dy = incident.getPosY() - vehicle->getPosY();
            double distanceKm = std::sqrt(dx * dx + dy * dy);
            travelTimeMin = (distanceKm / vehicle->getSpeedKmH()) * 60.0;
        }

        double score = vehicle->calculateSuitability(incident, travelTimeMin);
        if (score > highestScore && score > 0.0) {
            highestScore = score;
            bestVehicle = vehicle.get();
            bestTime = travelTimeMin;
        }
    }

    // Pass 2: Priority Preemption (if severity 5 and no available vehicle found)
    if (bestVehicle == nullptr && incident.getSeverityLevel() == 5) {
        std::cout << "[PREEMPTION EVALUATION] Critical Incident " << incident.getId() << " needs a vehicle!\n";
        for (const auto& vehicle : fleet) {
            if (vehicle->isAvailable()) continue; // Already handled above

            if (vehicle->getAssignedIncidentSeverity() == 1 || vehicle->getAssignedIncidentSeverity() == 2) {
                double travelTimeMin = -1.0;
                if (network && optimizer) {
                    std::string vehicleNode = network->getNearestNode(vehicle->getPosX(), vehicle->getPosY());
                    RouteResult route = optimizer->calculateFastestRoute(*network, vehicleNode, incidentNode);
                    if (route.reachable) travelTimeMin = route.estimatedTimeMinutes;
                    else continue;
                } else {
                    double dx = incident.getPosX() - vehicle->getPosX();
                    double dy = incident.getPosY() - vehicle->getPosY();
                    travelTimeMin = (std::sqrt(dx*dx + dy*dy) / vehicle->getSpeedKmH()) * 60.0;
                }
                
                // Temporarily mark available to calculate score
                vehicle->setAvailable(true);
                double score = vehicle->calculateSuitability(incident, travelTimeMin);
                vehicle->setAvailable(false); // Revert

                if (score > highestScore && score > 0.0) {
                    highestScore = score;
                    bestVehicle = vehicle.get();
                    bestTime = travelTimeMin;
                }
            }
        }
        if (bestVehicle) {
            std::cout << ">>> PREEMPTION CANDIDATE FOUND: " << bestVehicle->getId() 
                      << " (Currently on Severity " << bestVehicle->getAssignedIncidentSeverity() << ")\n";
        }
    }

    return bestVehicle;
}

void DispatchCenter::dispatchToIncident(const Incident& incident) {
    analytics.incrementIncidentsProcessed();

    std::cout << "\n===================================================\n";
    std::cout << " DISPATCH EVALUATION: " << incident.getId() 
              << " (" << incident.getType() << " - Severity " << incident.getSeverityLevel() << ")\n";
    std::cout << "===================================================\n";
    
    double bestTime = -1.0;
    EmergencyVehicle* bestVehicle = findBestVehicle(incident, bestTime);
    
    DispatchRecord record;
    record.incidentId = incident.getId();
    record.incidentType = incident.getType();
    record.severity = incident.getSeverityLevel();
    record.preempted = false;
    record.travelTimeMinutes = bestTime;
    record.routeDistanceKm = 0.0;
    record.assignedVehicleId = "None";
    record.vehicleType = "None";

    if (bestVehicle != nullptr) {
        if (!bestVehicle->isAvailable()) {
            std::cout << ">>> [PREEMPTION TRIGGERED] Re-routing " << bestVehicle->getId() 
                      << " from Incident " << bestVehicle->getAssignedIncidentId() 
                      << " to Critical Incident " << incident.getId() << "\n";
            record.preempted = true;
        }
        
        record.assignedVehicleId = bestVehicle->getId();
        record.vehicleType = bestVehicle->getVehicleType();
        
        RouteResult finalRoute;
        finalRoute.reachable = false;
        
        if (bestTime >= 0.0) {
            // Recalculate route just to show and get distance
            if (network && optimizer) {
                std::string vNode = network->getNearestNode(bestVehicle->getPosX(), bestVehicle->getPosY());
                std::string iNode = network->getNearestNode(incident.getPosX(), incident.getPosY());
                finalRoute = optimizer->calculateFastestRoute(*network, vNode, iNode);
                if (finalRoute.reachable) {
                    record.routeDistanceKm = finalRoute.totalDistanceKm;
                }
            } else {
                double dx = incident.getPosX() - bestVehicle->getPosX();
                double dy = incident.getPosY() - bestVehicle->getPosY();
                record.routeDistanceKm = std::sqrt(dx * dx + dy * dy);
                finalRoute.reachable = true;
                finalRoute.estimatedTimeMinutes = bestTime;
                finalRoute.totalDistanceKm = record.routeDistanceKm;
            }
        }
        
        double score = bestVehicle->calculateSuitability(incident, bestTime);
        CLIDashboard::printDispatchDecision(incident, bestVehicle, finalRoute, score);
        
        bestVehicle->setAssignedIncident(incident.getId(), incident.getSeverityLevel());
    } else {
        std::cout << ">>> DISPATCH DECISION: No suitable vehicles available for " 
                  << incident.getId() << "!\n";
    }
    
    analytics.logDispatch(record);
}

void DispatchCenter::dispatchAll() {
    for (const auto& incident : activeIncidents) {
        dispatchToIncident(incident);
    }
}
