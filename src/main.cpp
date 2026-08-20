#include <iostream>
#include <memory>
#include "DispatchCenter.h"
#include "Incident.h"
#include "Ambulance.h"
#include "FireEngine.h"

int main() {
    std::cout << "===================================================\n";
    std::cout << "  Multi-Criteria Emergency Dispatch Simulation System\n";
    std::cout << "                  Phase 2: Dispatch Engine         \n";
    std::cout << "===================================================\n\n";

    DispatchCenter dispatchCenter;

    // 1. Create and add Fleet
    dispatchCenter.addVehicle(std::make_unique<Ambulance>("AMB-01", 10.0, 12.0, 80.0, 5, true));
    
    // Create an ambulance and mark it busy
    auto amb2 = std::make_unique<Ambulance>("AMB-02", 50.0, 50.0, 75.0, 3, false);
    amb2->setAvailable(false);
    dispatchCenter.addVehicle(std::move(amb2));
    
    dispatchCenter.addVehicle(std::make_unique<FireEngine>("ENG-01", 28.0, 40.0, 65.0, 4000.0, 30.0));
    dispatchCenter.addVehicle(std::make_unique<FireEngine>("ENG-02", 15.0, 20.0, 60.0, 2000.0, 15.0));

    // Display Fleet Details
    dispatchCenter.printFleetStatus();

    // 2. Create and add active Incidents
    Incident medicalIncident("INC-101", "Medical", 12.0, 15.0, 4);
    Incident fireIncident("INC-102", "Fire", 30.0, 45.0, 5);
    
    std::cout << "\n";
    medicalIncident.displayInfo();
    std::cout << "\n";
    fireIncident.displayInfo();
    std::cout << "\n";

    dispatchCenter.addIncident(medicalIncident);
    dispatchCenter.addIncident(fireIncident);

    // 3. Dispatch to all incidents
    dispatchCenter.dispatchAll();

    // 4. Print Fleet Status after dispatch
    std::cout << "\n[Status Update] Fleet after dispatching:\n";
    dispatchCenter.printFleetStatus();

    std::cout << "\n===================================================\n";
    std::cout << " Dispatch Simulation completed successfully.\n";
    std::cout << "===================================================\n";

    return 0;
}