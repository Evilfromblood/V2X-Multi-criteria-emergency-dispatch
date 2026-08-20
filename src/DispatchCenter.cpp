#include "DispatchCenter.h"
#include <iostream>
#include <iomanip>

DispatchCenter::DispatchCenter() {}

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

EmergencyVehicle* DispatchCenter::findBestVehicle(const Incident& incident) const {
    EmergencyVehicle* bestVehicle = nullptr;
    double highestScore = -1.0;

    for (const auto& vehicle : fleet) {
        double score = vehicle->calculateSuitability(incident);
        if (score > highestScore && score > 0.0) {
            highestScore = score;
            bestVehicle = vehicle.get();
        }
    }
    return bestVehicle;
}

void DispatchCenter::dispatchToIncident(const Incident& incident) {
    std::cout << "\n===================================================\n";
    std::cout << " DISPATCH EVALUATION: " << incident.getId() 
              << " (" << incident.getType() << " - Severity " << incident.getSeverityLevel() << ")\n";
    std::cout << "===================================================\n";
    std::cout << std::left << std::setw(12) << "Vehicle ID" 
              << std::setw(15) << "Type" 
              << std::setw(12) << "Status" 
              << "Suitability Score\n";
    std::cout << "---------------------------------------------------\n";

    for (const auto& vehicle : fleet) {
        double score = vehicle->calculateSuitability(incident);
        std::cout << std::left << std::setw(12) << vehicle->getId()
                  << std::setw(15) << vehicle->getVehicleType()
                  << std::setw(12) << (vehicle->isAvailable() ? "Available" : "Busy")
                  << std::fixed << std::setprecision(2) << score << "\n";
    }

    EmergencyVehicle* bestVehicle = findBestVehicle(incident);
    std::cout << "---------------------------------------------------\n";
    if (bestVehicle != nullptr) {
        std::cout << ">>> DISPATCH DECISION: Assigning " << bestVehicle->getId() 
                  << " to " << incident.getId() << "\n";
        bestVehicle->setAvailable(false); // Mark as dispatched/busy
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
