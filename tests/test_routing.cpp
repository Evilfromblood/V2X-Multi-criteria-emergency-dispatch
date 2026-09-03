#include <iostream>
#include <cassert>
#include <cmath>
#include <vector>
#include <string>

#include "RoadNetwork.h"
#include "RouteOptimizer.h"
#include "V2XHub.h"
#include "Ambulance.h"
#include "FireEngine.h"
#include "Incident.h"

// Epsilon tolerance for floating-point comparisons
constexpr double EPSILON = 1e-4;

static bool approximatelyEqual(double a, double b) {
    return std::abs(a - b) < EPSILON;
}

void testDijkstraFreeFlow() {
    std::cout << "[RUNNING TEST 1] testDijkstraFreeFlow...\n";

    RoadNetwork net;
    RouteOptimizer optimizer;

    // Build deterministic test topology
    // Intersections
    net.addIntersection("A", 0.0, 0.0);
    net.addIntersection("B", 10.0, 0.0);
    net.addIntersection("C", 20.0, 0.0);
    net.addIntersection("D", 10.0, 10.0);

    // Primary route: A -> B -> C
    // Edge A-B: 10 km @ 60 km/h = 10.0 minutes
    // Edge B-C: 10 km @ 60 km/h = 10.0 minutes
    // Total: 20 km, 20.0 minutes
    net.addRoadSegment("A", "B", 10.0, 60.0);
    net.addRoadSegment("B", "C", 10.0, 60.0);

    // Alternative slower route: A -> D -> C
    // Edge A-D: 15 km @ 60 km/h = 15.0 minutes
    // Edge D-C: 15 km @ 60 km/h = 15.0 minutes
    // Total: 30 km, 30.0 minutes
    net.addRoadSegment("A", "D", 15.0, 60.0);
    net.addRoadSegment("D", "C", 15.0, 60.0);

    // 1. Calculate route from A to C
    RouteResult result = optimizer.calculateFastestRoute(net, "A", "C");

    assert(result.reachable && "Route between connected nodes A and C must be reachable");
    assert(result.pathNodes.size() == 3 && "Fastest path must contain exactly 3 nodes: A -> B -> C");
    assert(result.pathNodes[0] == "A" && result.pathNodes[1] == "B" && result.pathNodes[2] == "C" && "Path sequence mismatch");
    assert(approximatelyEqual(result.totalDistanceKm, 20.0) && "Total distance should be exactly 20.0 km");
    assert(approximatelyEqual(result.estimatedTimeMinutes, 20.0) && "Total travel time should be exactly 20.0 minutes");

    // 2. Same start and end node (self-loop)
    RouteResult sameNodeResult = optimizer.calculateFastestRoute(net, "A", "A");
    assert(sameNodeResult.reachable && "Route from node to itself must be reachable");
    assert(sameNodeResult.pathNodes.size() == 1 && sameNodeResult.pathNodes[0] == "A");
    assert(approximatelyEqual(sameNodeResult.estimatedTimeMinutes, 0.0));

    // 3. Disconnected / unknown node
    RouteResult unknownResult = optimizer.calculateFastestRoute(net, "A", "NON_EXISTENT");
    assert(!unknownResult.reachable && "Route to non-existent node must not be reachable");

    std::cout << "  * testDijkstraFreeFlow PASSED: Shortest path, self-loop, and disconnected nodes verified.\n\n";
}

void testV2XDetourAndBlockage() {
    std::cout << "[RUNNING TEST 2] testV2XDetourAndBlockage...\n";

    RoadNetwork net;
    RouteOptimizer optimizer;
    V2XHub v2x;

    // Topology:
    // Route 1 (Preferred): A -> B -> C (10 km + 10 km = 20 km @ 60 km/h = 20 min)
    // Route 2 (Detour):    A -> D -> C (15 km + 15 km = 30 km @ 60 km/h = 30 min)
    net.addIntersection("A", 0.0, 0.0);
    net.addIntersection("B", 10.0, 0.0);
    net.addIntersection("C", 20.0, 0.0);
    net.addIntersection("D", 10.0, 10.0);

    net.addRoadSegment("A", "B", 10.0, 60.0);
    net.addRoadSegment("B", "C", 10.0, 60.0);
    net.addRoadSegment("A", "D", 15.0, 60.0);
    net.addRoadSegment("D", "C", 15.0, 60.0);

    // Initial check: Free flow selects Route 1
    RouteResult initialRoute = optimizer.calculateFastestRoute(net, "A", "C");
    assert(initialRoute.reachable);
    assert(initialRoute.pathNodes == std::vector<std::string>({"A", "B", "C"}));
    assert(approximatelyEqual(initialRoute.estimatedTimeMinutes, 20.0));

    // Inject accident blockage on segment B -> C via V2XHub
    V2XReport blockage{"B", "C", "Accident Road Closure", 10.0, true};
    v2x.broadcastHazard(net, blockage);

    // Verify RouteOptimizer detects road closure and routes via detour A -> D -> C
    RouteResult detourRoute = optimizer.calculateFastestRoute(net, "A", "C");
    assert(detourRoute.reachable && "Detour route via node D must remain reachable");
    assert(detourRoute.pathNodes == std::vector<std::string>({"A", "D", "C"}) && "Optimizer must detour around blocked segment B-C");
    assert(approximatelyEqual(detourRoute.totalDistanceKm, 30.0));
    assert(approximatelyEqual(detourRoute.estimatedTimeMinutes, 30.0));

    // Inject blockage on the detour route (A -> D) as well
    V2XReport detourBlockage{"A", "D", "Flooding Road Closure", 10.0, true};
    v2x.broadcastHazard(net, detourBlockage);

    // Both paths blocked -> should be unreachable
    RouteResult fullyBlockedRoute = optimizer.calculateFastestRoute(net, "A", "C");
    assert(!fullyBlockedRoute.reachable && "Route must be unreachable when all valid paths are blocked");

    // Resolve hazard on primary segment B-C
    v2x.resolveHazard(net, "B", "C");
    RouteResult restoredRoute = optimizer.calculateFastestRoute(net, "A", "C");
    assert(restoredRoute.reachable && "Route should be restored after resolving hazard");
    assert(restoredRoute.pathNodes == std::vector<std::string>({"A", "B", "C"}));
    assert(approximatelyEqual(restoredRoute.estimatedTimeMinutes, 20.0));

    std::cout << "  * testV2XDetourAndBlockage PASSED: V2X blockage, detour selection, and restoration verified.\n\n";
}

void testSuitabilityScoring() {
    std::cout << "[RUNNING TEST 3] testSuitabilityScoring...\n";

    // Create an Ambulance: max triage level 5, with paramedic
    Ambulance amb("AMB-TEST", 0.0, 0.0, 80.0, 5, true);

    // 1. Matching medical emergency with positive travel time
    Incident medicalIncident("INC-MED-01", "Medical", 10.0, 10.0, 3);
    double medScore = amb.calculateSuitability(medicalIncident, 10.0);
    assert(medScore > 0.0 && "Ambulance must evaluate to a positive suitability score for matching Medical incident");

    // 2. Incompatible incident type (e.g. Hazardous Materials or non-medical/rescue emergency)
    Incident incompIncident("INC-HAZ-01", "ChemicalHazmat", 10.0, 10.0, 4);
    double incompScore = amb.calculateSuitability(incompIncident, 10.0);
    assert(incompScore == 0.0 && "Ambulance must evaluate to exactly 0.0 for incompatible incident types");

    // 3. Unavailable / Busy vehicle state
    amb.setAvailable(false);
    double unavailScore = amb.calculateSuitability(medicalIncident, 10.0);
    assert(unavailScore == 0.0 && "Unavailable vehicle cannot be dispatched and must return 0.0");
    amb.setAvailable(true);

    // 4. Negative travel time (unreachable route)
    double unreachScore = amb.calculateSuitability(medicalIncident, -1.0);
    assert(unreachScore == 0.0 && "Unreachable route (negative ETA) must return 0.0 suitability");

    // 5. FireEngine suitability check for compatibility
    FireEngine fireEng("ENG-TEST", 0.0, 0.0, 60.0, 4000.0, 30.0);
    Incident fireIncident("INC-FIRE-01", "Fire", 10.0, 10.0, 4);
    double fireScore = fireEng.calculateSuitability(fireIncident, 10.0);
    assert(fireScore > 0.0 && "FireEngine must evaluate to a positive score for Fire incidents");

    // FireEngine incompatible with pure medical
    double fireOnMedScore = fireEng.calculateSuitability(medicalIncident, 10.0);
    assert(fireOnMedScore == 0.0 && "FireEngine must evaluate to 0.0 for pure Medical emergencies");

    std::cout << "  * testSuitabilityScoring PASSED: Vehicle suitability, compatibility, and availability verified.\n\n";
}

int main() {
    std::cout << "===================================================\n";
    std::cout << "  Multi-Criteria Emergency Dispatch: Unit Test Runner\n";
    std::cout << "===================================================\n\n";

    testDijkstraFreeFlow();
    testV2XDetourAndBlockage();
    testSuitabilityScoring();

    std::cout << "===================================================\n";
    std::cout << "  ALL UNIT TESTS PASSED (3/3 Test Suites Successful)\n";
    std::cout << "===================================================\n";

    return 0;
}
