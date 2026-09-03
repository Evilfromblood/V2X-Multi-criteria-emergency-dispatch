#include "RoadNetwork.h"
#include "RouteOptimizer.h"
#include "Incident.h"
#include "EmergencyVehicle.h"
#include "Ambulance.h"
#include "FireEngine.h"
#include "V2XHub.h"
#include "DispatchCenter.h"
#include "AnalyticsEngine.h"

#include <iostream>
#include <cassert>
#include <cmath>

#define ASSERT_TRUE(condition, message) \
    do { \
        if (!(condition)) { \
            std::cerr << "Assertion FAILED: " #condition << " (" << message << ") at " \
                      << __FILE__ << ":" << __LINE__ << std::endl; \
            std::exit(1); \
        } \
    } while (0)

#define ASSERT_FALSE(condition, message) ASSERT_TRUE(!(condition), message)

void testRoadNetwork() {
    std::cout << "[Test 1] RoadNetwork construction and nearest node lookup..." << std::endl;
    RoadNetwork net = RoadNetwork::createDefaultCityGrid();

    ASSERT_TRUE(net.hasNode("N1_HQ"), "Central Station HQ must exist");
    ASSERT_TRUE(net.hasNode("N11_HOSPITAL"), "Hospital must exist");

    std::string nearestToHQ = net.getNearestNode(2.1, 2.05);
    ASSERT_TRUE(nearestToHQ == "N1_HQ", "Should snap to N1_HQ");

    std::string nearestToMidtown = net.getNearestNode(8.1, 4.9);
    ASSERT_TRUE(nearestToMidtown == "N7", "Should snap to N7");

    const RoadSegment* seg = net.getSegment("N1_HQ", "N2");
    ASSERT_TRUE(seg != nullptr, "N1-N2 segment must exist");
    ASSERT_TRUE(seg->lengthKm == 3.0, "N1-N2 length should be 3.0 km");
    std::cout << "  -> PASSED" << std::endl;
}

void testRouteOptimizerAndV2X() {
    std::cout << "[Test 2] Dijkstra shortest-time pathfinder and V2X rerouting..." << std::endl;
    RoadNetwork net = RoadNetwork::createDefaultCityGrid();
    RouteOptimizer opt;

    // Nominal shortest route from N1_HQ to N11_HOSPITAL (express: N1_HQ -> N6 -> N11_HOSPITAL)
    RouteResult res1 = opt.findShortestRoute(net, "N1_HQ", "N11_HOSPITAL");
    ASSERT_TRUE(res1.reachable, "Direct highway route should be reachable");
    ASSERT_TRUE(res1.pathNodes.size() == 3, "Optimal express route should have 3 nodes (N1_HQ -> N6 -> N11_HOSPITAL)");
    ASSERT_TRUE(res1.pathNodes[1] == "N6", "Middle node must be N6 Downtown");
    double initialTime = res1.estimatedTimeMinutes;

    // Inject heavy traffic congestion on N1_HQ -> N6 (multiplier 4.0)
    net.updateSegmentHazard("N1_HQ", "N6", "CONSTRUCTION", 4.0, false);
    RouteResult res2 = opt.findShortestRoute(net, "N1_HQ", "N11_HOSPITAL");
    ASSERT_TRUE(res2.reachable, "Route must still be reachable");
    ASSERT_TRUE(res2.estimatedTimeMinutes > initialTime, "Congested travel time must increase");

    // Block N1_HQ -> N6 completely (ROAD CLOSED)
    net.updateSegmentHazard("N1_HQ", "N6", "ACCIDENT", 1.0, true);
    RouteResult res3 = opt.findShortestRoute(net, "N1_HQ", "N11_HOSPITAL");
    ASSERT_TRUE(res3.reachable, "Detour route must be reachable");
    // Detour must NOT use the blocked segment
    for (size_t i = 0; i + 1 < res3.pathNodes.size(); ++i) {
        bool isBlockedEdge = (res3.pathNodes[i] == "N1_HQ" && res3.pathNodes[i+1] == "N6") ||
                             (res3.pathNodes[i] == "N6" && res3.pathNodes[i+1] == "N1_HQ");
        ASSERT_FALSE(isBlockedEdge, "Detour must not use blocked edge N1_HQ - N6");
    }

    // Restore segment
    net.resolveSegmentHazard("N1_HQ", "N6");
    RouteResult res4 = opt.findShortestRoute(net, "N1_HQ", "N11_HOSPITAL");
    ASSERT_TRUE(res4.pathNodes[1] == "N6", "Route should restore to N6 express after hazard resolved");
    std::cout << "  -> PASSED" << std::endl;
}

void testSuitabilityScoring() {
    std::cout << "[Test 3] Ambulance and FireEngine suitability scoring..." << std::endl;
    RoadNetwork net = RoadNetwork::createDefaultCityGrid();
    RouteOptimizer opt;

    // High severity medical call requiring paramedic
    Incident critMedical("INC-TEST-1", "MEDICAL", 5, 8.0, 8.0, "Cardiac Arrest at Metro Hospital");
    critMedical.setNearestNodeId("N11_HOSPITAL");

    Ambulance ambWithParamedic("AMB-P", "N1_HQ", 2.0, 2.0, 5, true);
    Ambulance ambNoParamedic("AMB-B", "N1_HQ", 2.0, 2.0, 2, false);

    double scoreP = ambWithParamedic.calculateSuitability(critMedical, net, opt);
    double scoreB = ambNoParamedic.calculateSuitability(critMedical, net, opt);

    ASSERT_TRUE(scoreP > scoreB, "Paramedic ALS ambulance must score significantly higher for Severity 5 medical");

    // High severity fire requiring high water capacity and ladder reach
    Incident critFire("INC-TEST-2", "FIRE", 5, 11.0, 5.0, "Industrial Complex Blaze");
    critFire.setNearestNodeId("N8");

    FireEngine heavyEngine("ENG-H", "N1_HQ", 2.0, 2.0, 5000.0, 35.0);
    FireEngine lightEngine("ENG-L", "N1_HQ", 2.0, 2.0, 2000.0, 15.0);

    double scoreHeavy = heavyEngine.calculateSuitability(critFire, net, opt);
    double scoreLight = lightEngine.calculateSuitability(critFire, net, opt);

    ASSERT_TRUE(scoreHeavy > scoreLight, "Heavy engine with large water tank and ladder must outscore light engine on Severity 5 fire");
    std::cout << "  -> PASSED" << std::endl;
}

void testCoDispatchLogic() {
    std::cout << "[Test 4] Heterogeneous Co-Dispatch requirements..." << std::endl;
    DispatchCenter center;

    // Severity 5 Fire requires 1 FireEngine + 1 Ambulance
    std::string incId = center.createIncident("FIRE", 5, 8.0, 5.0, "High-Rise Commercial Fire");
    
    // Find incident
    const auto& incs = center.getIncidents();
    ASSERT_TRUE(!incs.empty(), "Incident must be registered");
    const Incident& inc = incs.back();

    ASSERT_TRUE(inc.getRequiredFireEngines() == 1, "Level 5 Fire requires 1 FireEngine");
    ASSERT_TRUE(inc.getRequiredAmbulances() == 1, "Level 5 Fire requires 1 Ambulance");
    ASSERT_TRUE(inc.getStatus() == "DISPATCHED", "Incident should be atomically dispatched");
    ASSERT_TRUE(inc.getAssignedVehicleIds().size() == 2, "Exactly 2 vehicles must be co-dispatched");

    bool hasAmb = false;
    bool hasEng = false;
    for (const auto& vid : inc.getAssignedVehicleIds()) {
        EmergencyVehicle* v = center.getVehicleById(vid);
        ASSERT_TRUE(v != nullptr, "Assigned vehicle must exist in fleet");
        if (v->getType() == "AMBULANCE") hasAmb = true;
        if (v->getType() == "FIRE_ENGINE") hasEng = true;
        ASSERT_TRUE(v->getState() == VehicleState::EN_ROUTE_INCIDENT, "Dispatched unit must be EN_ROUTE_INCIDENT");
    }

    ASSERT_TRUE(hasAmb && hasEng, "Co-dispatch package must contain both Ambulance and FireEngine");
    std::cout << "  -> PASSED" << std::endl;
}

void testPriorityPreemption() {
    std::cout << "[Test 5] Priority preemption for Level 5 emergency under fleet saturation..." << std::endl;
    DispatchCenter center;

    // Dispatch all ambulances to low-severity calls (Severity 1)
    center.createIncident("MEDICAL", 1, 2.0, 5.0, "Minor cuts");
    center.createIncident("MEDICAL", 1, 5.0, 2.0, "Sprained ankle");
    center.createIncident("MEDICAL", 1, 8.0, 2.0, "Minor nosebleed");
    center.createIncident("MEDICAL", 1, 2.0, 8.0, "Minor bruise");

    // All 4 ambulances are now EN_ROUTE_INCIDENT on Severity 1 calls!
    // Now create a critical Severity 5 Mass Casualty / Rescue Incident
    std::string critId = center.createIncident("RESCUE", 5, 5.0, 5.0, "Major Highway Collision with Trapped Victims");

    ASSERT_TRUE(center.getAnalytics().getPreemptionCount() > 0, "Preemption count must be incremented");

    const auto& incs = center.getIncidents();
    bool foundPreemptedCall = false;
    for (const auto& inc : incs) {
        if (inc.getStatus() == "PREEMPTED_QUEUED") {
            foundPreemptedCall = true;
            break;
        }
    }
    ASSERT_TRUE(foundPreemptedCall, "A low-severity call must be placed into PREEMPTED_QUEUED state");
    std::cout << "  -> PASSED" << std::endl;
}

void testDiscreteEventVehicleLifecycle() {
    std::cout << "[Test 6] Discrete-time vehicle lifecycle state transitions..." << std::endl;
    RoadNetwork net = RoadNetwork::createDefaultCityGrid();
    RouteOptimizer opt;

    // Test Ambulance full cycle: IDLE -> EN_ROUTE -> ON_SCENE -> TRANSPORTING -> AT_HOSPITAL -> RETURNING -> IDLE
    Ambulance amb("AMB-LIFECYCLE", "N1_HQ", 2.0, 2.0, 4, true, 60.0);
    amb.setAssignedHospitalNode("N11_HOSPITAL");
    ASSERT_TRUE(amb.getState() == VehicleState::IDLE_STATION, "Initial state should be IDLE_STATION");

    Incident inc("INC-LIFE", "MEDICAL", 2, 5.0, 5.0, "Downtown Incident");
    inc.setNearestNodeId("N6");

    RouteResult route = opt.findShortestRoute(net, "N1_HQ", "N6");
    amb.setAssignedIncident(inc.getId(), inc.getSeverity());
    amb.assignRoute(route.pathNodes, "N6", VehicleState::EN_ROUTE_INCIDENT);

    ASSERT_TRUE(amb.getState() == VehicleState::EN_ROUTE_INCIDENT, "Should be EN_ROUTE_INCIDENT");

    // Advance time until arrival at scene (route is ~4.24 km at ~60 km/h = ~4.24 min)
    for (int i = 0; i < 10; ++i) {
        amb.advanceSimulationTime(1.0, net, opt);
        if (amb.getState() == VehicleState::ON_SCENE) break;
    }
    ASSERT_TRUE(amb.getState() == VehicleState::ON_SCENE, "Vehicle must transition to ON_SCENE upon arrival");
    ASSERT_TRUE(amb.getStateTimerMinutes() == 10.0, "Severity 2 * 5.0 min = 10.0 min on scene");

    // Advance 10 minutes on scene
    amb.advanceSimulationTime(10.0, net, opt);
    ASSERT_TRUE(amb.getState() == VehicleState::TRANSPORTING_HOSPITAL, "Ambulance must transition to TRANSPORTING_HOSPITAL");

    // Advance time to arrive at hospital
    for (int i = 0; i < 10; ++i) {
        amb.advanceSimulationTime(1.0, net, opt);
        if (amb.getState() == VehicleState::AT_HOSPITAL_TURNOVER) break;
    }
    ASSERT_TRUE(amb.getState() == VehicleState::AT_HOSPITAL_TURNOVER, "Ambulance must transition to AT_HOSPITAL_TURNOVER");
    ASSERT_TRUE(amb.getStateTimerMinutes() == 10.0, "Turnover duration must be 10.0 minutes");

    // Finish turnover
    amb.advanceSimulationTime(10.0, net, opt);
    ASSERT_TRUE(amb.getState() == VehicleState::RETURNING_TO_BASE, "Ambulance must transition to RETURNING_TO_BASE");

    // Advance time to return to base N1_HQ
    for (int i = 0; i < 15; ++i) {
        amb.advanceSimulationTime(1.0, net, opt);
        if (amb.getState() == VehicleState::IDLE_STATION) break;
    }
    ASSERT_TRUE(amb.getState() == VehicleState::IDLE_STATION, "Ambulance must transition back to IDLE_STATION");
    std::cout << "  -> PASSED" << std::endl;
}

void testJsonTelemetrySerialization() {
    std::cout << "[Test 7] JSON Telemetry serialization integrity..." << std::endl;
    DispatchCenter center;
    std::string json = center.getFullTelemetryJson();

    ASSERT_TRUE(json.find("\"clockMinutes\"") != std::string::npos, "JSON must contain clockMinutes");
    ASSERT_TRUE(json.find("\"network\"") != std::string::npos, "JSON must contain network");
    ASSERT_TRUE(json.find("\"fleet\"") != std::string::npos, "JSON must contain fleet array");
    ASSERT_TRUE(json.find("\"incidents\"") != std::string::npos, "JSON must contain incidents array");
    ASSERT_TRUE(json.find("\"hazards\"") != std::string::npos, "JSON must contain hazards");
    ASSERT_TRUE(json.find("\"analytics\"") != std::string::npos, "JSON must contain analytics");
    std::cout << "  -> PASSED" << std::endl;
}

void testQueueAgingAndSignalPreemption() {
    std::cout << "[Test 8] Dynamic queue aging anti-starvation policy and V2X green wave preemption..." << std::endl;
    DispatchCenter center;

    // 1. Test Queue Aging
    Incident inc("TEST-AGE-1", "MEDICAL", 1, 5.0, 5.0, "Low priority call");
    inc.setQueuedAtMinutes(0.0);
    inc.updateEffectivePriority(0.0, 0.25);
    ASSERT_TRUE(inc.getEffectivePriority() == 1.0, "Initial effective priority should equal base severity");
    ASSERT_TRUE(!inc.isEscalated(), "Should not be escalated initially");

    // At t = 12.0 min: Peff = 1.0 + 0.25 * 12.0 = 4.0 -> Should escalate to prevent starvation
    bool escalated = inc.updateEffectivePriority(12.0, 0.25);
    ASSERT_TRUE(escalated, "Incident must escalate when Peff >= 4.0");
    ASSERT_TRUE(inc.isEscalated(), "isEscalated flag must be set to true");
    ASSERT_TRUE(inc.getEffectivePriority() >= 4.0, "Effective priority must be >= 4.0");

    // 2. Test Green Wave Preemption signal status
    RoadNetwork& net = center.getRoadNetwork();
    ASSERT_TRUE(net.getNodeDegree("N6") >= 3, "Central junction N6 must have degree >= 3");
    net.setNodeSignalStatus("N6", "GREEN_WAVE_ACTIVE");
    ASSERT_TRUE(net.getNodeSignalStatus("N6") == "GREEN_WAVE_ACTIVE", "Node signal status must be GREEN_WAVE_ACTIVE");

    net.resetAllSignalStatuses();
    ASSERT_TRUE(net.getNodeSignalStatus("N6") == "NORMAL", "Reset signal status must restore NORMAL");

    std::cout << "  -> PASSED" << std::endl;
}

int main() {
    std::cout << "========================================================\n";
    std::cout << "   RUNNING NON-INTERACTIVE V2X CORE ENGINE TEST SUITE   \n";
    std::cout << "========================================================\n";

    testRoadNetwork();
    testRouteOptimizerAndV2X();
    testSuitabilityScoring();
    testCoDispatchLogic();
    testPriorityPreemption();
    testDiscreteEventVehicleLifecycle();
    testJsonTelemetrySerialization();
    testQueueAgingAndSignalPreemption();

    std::cout << "========================================================\n";
    std::cout << "   ALL UNIT TESTS PASSED SUCCESSFULLY! (8/8)            \n";
    std::cout << "========================================================\n";
    return 0;
}
