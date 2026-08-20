#include "V2XHub.h"
#include <iostream>
#include <algorithm>

void V2XHub::broadcastHazard(RoadNetwork& network, const V2XReport& report) {
    activeHazards.push_back(report);

    RoadSegment* forward = network.getSegment(report.segmentFrom, report.segmentTo);
    RoadSegment* backward = network.getSegment(report.segmentTo, report.segmentFrom);

    if (forward) {
        forward->congestionMultiplier = report.severityMultiplier;
        forward->isBlocked = report.roadClosed;
    }
    if (backward) {
        backward->congestionMultiplier = report.severityMultiplier;
        backward->isBlocked = report.roadClosed;
    }
    
    std::cout << "[V2X ALERT] Hazard reported on segment " << report.segmentFrom << "-" << report.segmentTo 
              << ": " << report.hazardType << ". Severity: " << report.severityMultiplier << "x, Closed: " << (report.roadClosed ? "Yes" : "No") << "\n";
}

void V2XHub::resolveHazard(RoadNetwork& network, const std::string& u, const std::string& v) {
    RoadSegment* forward = network.getSegment(u, v);
    RoadSegment* backward = network.getSegment(v, u);

    if (forward) {
        forward->congestionMultiplier = 1.0;
        forward->isBlocked = false;
    }
    if (backward) {
        backward->congestionMultiplier = 1.0;
        backward->isBlocked = false;
    }

    activeHazards.erase(
        std::remove_if(activeHazards.begin(), activeHazards.end(), 
            [&](const V2XReport& r) { 
                return (r.segmentFrom == u && r.segmentTo == v) || (r.segmentFrom == v && r.segmentTo == u); 
            }), 
        activeHazards.end()
    );

    std::cout << "[V2X CLEAR] Hazard resolved on segment " << u << "-" << v << ". Normal traffic resumed.\n";
}

void V2XHub::displayActiveHazards() const {
    std::cout << "\n--- Active V2X Hazards ---\n";
    if (activeHazards.empty()) {
        std::cout << "No active hazards.\n";
        return;
    }
    for (const auto& hazard : activeHazards) {
        std::cout << "Segment [" << hazard.segmentFrom << " -> " << hazard.segmentTo << "] - "
                  << hazard.hazardType << " (Severity: " << hazard.severityMultiplier << "x, Closed: " << (hazard.roadClosed ? "Yes" : "No") << ")\n";
    }
}
