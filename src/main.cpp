#include <iostream>
#include <vector>
#include <memory>
#include <iomanip>
#include "Incident.h"
#include "Ambulance.h"
#include "FireEngine.h"

int main() {
    std::cout << "===================================================\n";
    std::cout << "  Multi-Criteria Emergency Dispatch Simulation System\n";
    std::cout << "===================================================\n\n";

    // 1. Create active Incidents
    Incident medicalIncident("INC-101", "Medical", 12.0, 15.0, 4);
    Incident fireIncident("INC-102", "Fire", 30.0, 45.0, 5);

    medicalIncident.displayInfo();
    std::cout << "\n";
    fireIncident.displayInfo();
    std::cout << "\n";

    // 2. Create Fleet using runtime polymorphism with std::unique_ptr
    std::vector<std::unique_ptr<EmergencyVehicle>> fleet;

    fleet.push_back(std::make_unique<Ambulance>("AMB-01", 10.0, 12.0, 80.0, 5, true));
    fleet.push_back(std::make_unique<Ambulance>("AMB-02", 50.0, 50.0, 75.0, 3, false));
    fleet.push_back(std::make_unique<FireEngine>("ENG-01", 28.0, 40.0, 65.0, 4000.0, 30.0));
    fleet.push_back(std::make_unique<FireEngine>("ENG-02", 15.0, 20.0, 60.0, 2000.0, 15.0));

    // Mark one vehicle busy to test availability scoring
    fleet[1]->setAvailable(false);

    // 3. Display Fleet Details
    std::cout << "===================================================\n";
    std::cout << "                 CURRENT FLEET LIST                \n";
    std::cout << "===================================================\n";
    for (const auto& vehicle : fleet) {
        vehicle->displayInfo();
    }

    // 4. Evaluate Suitability Scores for Medical Incident
    std::cout << "\n===================================================\n";
    std::cout << " SUITABILITY EVALUATION: " << medicalIncident.getId() 
              << " (" << medicalIncident.getType() << " - Severity " << medicalIncident.getSeverityLevel() << ")\n";
    std::cout << "===================================================\n";
    std::cout << std::left << std::setw(12) << "Vehicle ID" 
              << std::setw(15) << "Type" 
              << std::setw(12) << "Status" 
              << "Suitability Score\n";
    std::cout << "---------------------------------------------------\n";

    for (const auto& vehicle : fleet) {
        double score = vehicle->calculateSuitability(medicalIncident);
        std::cout << std::left << std::setw(12) << vehicle->getId()
                  << std::setw(15) << vehicle->getVehicleType()
                  << std::setw(12) << (vehicle->isAvailable() ? "Available" : "Busy")
                  << std::fixed << std::setprecision(2) << score << "\n";
    }

    // 5. Evaluate Suitability Scores for Fire Incident
    std::cout << "\n===================================================\n";
    std::cout << " SUITABILITY EVALUATION: " << fireIncident.getId() 
              << " (" << fireIncident.getType() << " - Severity " << fireIncident.getSeverityLevel() << ")\n";
    std::cout << "===================================================\n";
    std::cout << std::left << std::setw(12) << "Vehicle ID" 
              << std::setw(15) << "Type" 
              << std::setw(12) << "Status" 
              << "Suitability Score\n";
    std::cout << "---------------------------------------------------\n";

    for (const auto& vehicle : fleet) {
        double score = vehicle->calculateSuitability(fireIncident);
        std::cout << std::left << std::setw(12) << vehicle->getId()
                  << std::setw(15) << vehicle->getVehicleType()
                  << std::setw(12) << (vehicle->isAvailable() ? "Available" : "Busy")
                  << std::fixed << std::setprecision(2) << score << "\n";
    }

    std::cout << "\n===================================================\n";
    std::cout << " Dispatch Simulation completed successfully.\n";
    std::cout << "===================================================\n";

    return 0;
}