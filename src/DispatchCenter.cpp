#include "DispatchCenter.h"
#include <iostream>
#include <iomanip>
#include <cmath>

DispatchCenter::DispatchCenter(RoadNetwork* net, RouteOptimizer* opt) 
    : network(net), optimizer(opt) {}

void DispatchCenter::addVehicle(std::unique_ptr<EmergencyVehicle> vehicle) {
    fleet.push_back(std::move(vehicle));
}

void DispatchCenter::printFleetStatus() const {
    std::cout << "===================================================\n";
    std::cout << "                 CURRENT FLEET LIST                \n";
    std::cout << "===================================================\n";
    for (const auto& vehicle : fleet) {
        vehicle->displayInfo();
    }
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
    std::cout << "\n===================================================\n";
    std::cout << " DISPATCH EVALUATION: " << incident.getId() 
              << " (" << incident.getType() << " - Severity " << incident.getSeverityLevel() << ")\n";
    std::cout << "===================================================\n";
    
    double bestTime = -1.0;
    EmergencyVehicle* bestVehicle = findBestVehicle(incident, bestTime);
    
    if (bestVehicle != nullptr) {
        if (!bestVehicle->isAvailable()) {
            std::cout << ">>> [PREEMPTION TRIGGERED] Re-routing " << bestVehicle->getId() 
                      << " from Incident " << bestVehicle->getAssignedIncidentId() 
                      << " to Critical Incident " << incident.getId() << "\n";
        }
        std::cout << ">>> DISPATCH DECISION: Assigning " << bestVehicle->getId() 
                  << " to " << incident.getId() << "\n";
        if (bestTime >= 0.0) {
            std::cout << "    Estimated Travel Time: " << std::fixed << std::setprecision(1) << bestTime << " mins\n";
            // Optionally output the route if network exists
            if (network && optimizer) {
                std::string vNode = network->getNearestNode(bestVehicle->getPosX(), bestVehicle->getPosY());
                std::string iNode = network->getNearestNode(incident.getPosX(), incident.getPosY());
                RouteResult route = optimizer->calculateFastestRoute(*network, vNode, iNode);
                std::cout << "    Route: ";
                for (size_t i = 0; i < route.pathNodes.size(); ++i) {
                    std::cout << route.pathNodes[i] << (i + 1 == route.pathNodes.size() ? "" : " -> ");
                }
                std::cout << "\n";
            }
        }
        bestVehicle->setAssignedIncident(incident.getId(), incident.getSeverityLevel());
    } else {
        std::cout << ">>> DISPATCH DECISION: No suitable vehicles available for " 
                  << incident.getId() << "!\n";
    }
}

void DispatchCenter::dispatchAll() {
    for (const auto& incident : activeIncidents) {
        dispatchToIncident(incident);
    }
}
