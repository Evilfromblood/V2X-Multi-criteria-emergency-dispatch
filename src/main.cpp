#include <iostream>
#include <memory>
#include "DispatchCenter.h"
#include "Incident.h"
#include "Ambulance.h"
#include "FireEngine.h"
#include "RoadNetwork.h"
#include "V2XHub.h"
#include "RouteOptimizer.h"

int main() {
    std::cout << "===================================================\n";
    std::cout << "  Multi-Criteria Emergency Dispatch Simulation System\n";
    std::cout << "  Phase 4: Dynamic Route Optimization & Rescheduling\n";
    std::cout << "===================================================\n\n";

    // Initialize Road Network
    RoadNetwork roadNetwork;
    RouteOptimizer routeOptimizer;
    
    // Add 6 intersections
    roadNetwork.addIntersection("A", 10.0, 10.0);
    roadNetwork.addIntersection("B", 30.0, 10.0);
    roadNetwork.addIntersection("C", 30.0, 30.0);
    roadNetwork.addIntersection("D", 10.0, 30.0);
    roadNetwork.addIntersection("E", 20.0, 20.0); // Central hub
    roadNetwork.addIntersection("F", 50.0, 50.0); // Bypass

    // Add road segments
    roadNetwork.addRoadSegment("A", "B", 20.0, 60.0);
    roadNetwork.addRoadSegment("B", "C", 20.0, 60.0);
    roadNetwork.addRoadSegment("C", "D", 20.0, 60.0);
    roadNetwork.addRoadSegment("D", "A", 20.0, 60.0);
    roadNetwork.addRoadSegment("A", "E", 14.1, 50.0);
    roadNetwork.addRoadSegment("B", "E", 14.1, 50.0);
    roadNetwork.addRoadSegment("C", "E", 14.1, 50.0);
    roadNetwork.addRoadSegment("D", "E", 14.1, 50.0);
    roadNetwork.addRoadSegment("C", "F", 28.2, 80.0);

    // Initialize V2X Hub
    V2XHub v2xHub;
    
    std::cout << "\n[Simulation] Broadcasting live hazards...\n";
    v2xHub.broadcastHazard(roadNetwork, {"A", "E", "Heavy Traffic", 2.5, false});
    v2xHub.broadcastHazard(roadNetwork, {"C", "F", "Accident Blockage", 10.0, true});
    
    v2xHub.displayActiveHazards();
    roadNetwork.displayNetwork();

    DispatchCenter dispatchCenter(&roadNetwork, &routeOptimizer);

    // 1. Create and add Fleet
    dispatchCenter.addVehicle(std::make_unique<Ambulance>("AMB-01", 10.0, 10.0, 80.0, 5, true)); // At Node A
    auto amb2 = std::make_unique<Ambulance>("AMB-02", 50.0, 50.0, 75.0, 3, false); // At Node F
    amb2->setAvailable(false); // Busy
    dispatchCenter.addVehicle(std::move(amb2));
    
    dispatchCenter.addVehicle(std::make_unique<FireEngine>("ENG-01", 30.0, 10.0, 65.0, 4000.0, 30.0)); // At Node B
    auto eng2 = std::make_unique<FireEngine>("ENG-02", 10.0, 30.0, 60.0, 2000.0, 15.0); // At Node D
    eng2->setAvailable(false); // Make busy to test preemption later
    dispatchCenter.addVehicle(std::move(eng2));

    // Display Fleet Details
    std::cout << "\n";
    dispatchCenter.printFleetStatus();

    // 2. Initial Incidents
    Incident minorFire("INC-101", "Fire", 30.0, 10.0, 2); // Minor fire at Node B
    std::cout << "\n--- Initial Incident ---\n";
    minorFire.displayInfo();

    dispatchCenter.dispatchToIncident(minorFire);

    // Now ENG-01 is assigned to INC-101 (Severity 2).
    // Let's create a Critical Incident that needs a FireEngine.
    Incident criticalFire("INC-102", "Fire", 20.0, 20.0, 5); // Critical fire at Node E (Central)
    
    std::cout << "\n--- Critical Incident Occurs ---\n";
    criticalFire.displayInfo();

    // 3. Dispatch to Critical Incident
    // Since ENG-02 is busy and ENG-01 is on a Severity 2 incident, ENG-01 should be preempted.
    dispatchCenter.dispatchToIncident(criticalFire);

    std::cout << "\n[Status Update] Fleet after dispatching:\n";
    dispatchCenter.printFleetStatus();

    std::cout << "\n===================================================\n";
    std::cout << " Dispatch Simulation completed successfully.\n";
    std::cout << "===================================================\n";

    return 0;
}