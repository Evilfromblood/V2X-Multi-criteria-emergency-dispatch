#include <iostream>
#include <memory>
#include <vector>
#include <random>
#include <string>

#include "DispatchCenter.h"
#include "Incident.h"
#include "Ambulance.h"
#include "FireEngine.h"
#include "RoadNetwork.h"
#include "V2XHub.h"
#include "RouteOptimizer.h"
#include "CLIDashboard.h"
#include "AnalyticsEngine.h"

void setupNetworkAndFleet(RoadNetwork& roadNetwork, V2XHub& v2xHub, DispatchCenter& dispatchCenter) {
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

    // Initial Hazards
    v2xHub.broadcastHazard(roadNetwork, {"A", "E", "Heavy Traffic", 2.5, false});
    v2xHub.broadcastHazard(roadNetwork, {"C", "F", "Accident Blockage", 10.0, true});

    // Add Fleet
    dispatchCenter.addVehicle(std::make_unique<Ambulance>("AMB-01", 10.0, 10.0, 80.0, 5, true)); // At Node A
    auto amb2 = std::make_unique<Ambulance>("AMB-02", 50.0, 50.0, 75.0, 3, false); // At Node F
    amb2->setAvailable(false); // Busy
    dispatchCenter.addVehicle(std::move(amb2));
    
    dispatchCenter.addVehicle(std::make_unique<FireEngine>("ENG-01", 30.0, 10.0, 65.0, 4000.0, 30.0)); // At Node B
    auto eng2 = std::make_unique<FireEngine>("ENG-02", 10.0, 30.0, 60.0, 2000.0, 15.0); // At Node D
    eng2->setAvailable(false); // Make busy to test preemption later
    dispatchCenter.addVehicle(std::move(eng2));
}

void runScenarioWalkthrough() {
    CLIDashboard::printHeader("MODE 1: SCENARIO WALKTHROUGH");
    RoadNetwork roadNetwork;
    RouteOptimizer routeOptimizer;
    V2XHub v2xHub;
    DispatchCenter dispatchCenter(&roadNetwork, &routeOptimizer);

    setupNetworkAndFleet(roadNetwork, v2xHub, dispatchCenter);
    
    std::vector<V2XReport> activeHazards = {
        {"A", "E", "Heavy Traffic", 2.5, false},
        {"C", "F", "Accident Blockage", 10.0, true}
    };
    CLIDashboard::printHazardTable(activeHazards);

    dispatchCenter.printFleetStatus();

    Incident minorFire("INC-101", "Fire", 30.0, 10.0, 2); // Minor fire at Node B
    std::cout << "\n--- Initial Incident ---\n";
    minorFire.displayInfo();
    dispatchCenter.dispatchToIncident(minorFire);

    Incident criticalFire("INC-102", "Fire", 20.0, 20.0, 5); // Critical fire at Node E (Central)
    std::cout << "\n--- Critical Incident Occurs ---\n";
    criticalFire.displayInfo();
    dispatchCenter.dispatchToIncident(criticalFire);

    std::cout << "\n[Status Update] Fleet after dispatching:\n";
    dispatchCenter.printFleetStatus();
    
    dispatchCenter.getAnalytics().renderAnalyticsSummary();
}

void runAutomatedBenchmark() {
    CLIDashboard::printHeader("MODE 2: AUTOMATED BENCHMARK");
    RoadNetwork roadNetwork;
    RouteOptimizer routeOptimizer;
    V2XHub v2xHub;
    DispatchCenter dispatchCenter(&roadNetwork, &routeOptimizer);

    setupNetworkAndFleet(roadNetwork, v2xHub, dispatchCenter);

    // Make all vehicles available for the benchmark start
    // wait, we can just leave them as they are or we can re-add them clean
    // let's just make sure they are somewhat realistic.
    
    std::mt19937 gen(42);
    std::uniform_int_distribution<> typeDist(0, 2);
    std::uniform_int_distribution<> sevDist(1, 5);
    std::uniform_int_distribution<> nodeDist(0, 5);
    std::uniform_real_distribution<> eventDist(0.0, 1.0);
    
    std::string types[] = {"Medical", "Fire", "Rescue"};
    double nodeX[] = {10.0, 30.0, 30.0, 10.0, 20.0, 50.0};
    double nodeY[] = {10.0, 10.0, 30.0, 30.0, 20.0, 50.0};
    std::string nodes[] = {"A", "B", "C", "D", "E", "F"};
    
    int numIncidents = 15;
    for (int i = 0; i < numIncidents; ++i) {
        int nIdx = nodeDist(gen);
        std::string incId = "INC-BM-" + std::to_string(100 + i);
        Incident inc(incId, types[typeDist(gen)], nodeX[nIdx], nodeY[nIdx], sevDist(gen));
        
        // Randomly resolve or add hazards occasionally
        if (i == 5) {
            std::cout << "\n[V2X Update] Resolving Heavy Traffic on A->E\n";
            v2xHub.resolveHazard(roadNetwork, "A", "E");
            std::cout << "[V2X Update] Flooding reported on B->C\n";
            v2xHub.broadcastHazard(roadNetwork, {"B", "C", "Flooding", 3.0, false});
        }
        
        dispatchCenter.dispatchToIncident(inc);
    }
    
    dispatchCenter.getAnalytics().renderAnalyticsSummary();
}

int main() {
    std::cout << "===================================================\n";
    std::cout << "  Multi-Criteria Emergency Dispatch Simulation System\n";
    std::cout << "  Phase 5: CLI Dashboard & Analytics\n";
    std::cout << "===================================================\n\n";

    std::cout << "Select Mode:\n";
    std::cout << "1. Scenario Walkthrough\n";
    std::cout << "2. Automated Benchmark (15 incidents)\n";
    std::cout << "Choice: ";
    
    int choice;
    if (std::cin >> choice) {
        if (choice == 1) {
            runScenarioWalkthrough();
        } else if (choice == 2) {
            runAutomatedBenchmark();
        } else {
            std::cout << "Invalid choice.\n";
        }
    } else {
        // Fallback for non-interactive execution
        std::cout << "Running Automated Benchmark by default.\n";
        runAutomatedBenchmark();
    }

    return 0;
}