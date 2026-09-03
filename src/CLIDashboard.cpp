#include "CLIDashboard.h"
#include <iostream>
#include <iomanip>
#include <sstream>

void CLIDashboard::printHeader(const std::string& title) {
    std::cout << "\n===================================================\n";
    int padding = (51 - title.length()) / 2;
    if (padding < 0) padding = 0;
    std::string padStr(padding, ' ');
    std::cout << padStr << title << "\n";
    std::cout << "===================================================\n";
}

void CLIDashboard::printFleetTable(const std::vector<std::unique_ptr<EmergencyVehicle>>& fleet) {
    printHeader("FLEET STATUS");
    std::cout << std::left << std::setw(10) << "ID" 
              << std::setw(15) << "Type" 
              << std::setw(12) << "Status" 
              << std::setw(15) << "Assignment" << "\n";
    std::cout << "---------------------------------------------------\n";
    for (const auto& vehicle : fleet) {
        std::string status = vehicle->isAvailable() ? "Available" : "Busy";
        std::string assignment = vehicle->getAssignedIncidentId().empty() ? "None" : vehicle->getAssignedIncidentId();
        std::cout << std::left << std::setw(10) << vehicle->getId()
                  << std::setw(15) << vehicle->getVehicleType()
                  << std::setw(12) << status
                  << std::setw(15) << assignment << "\n";
    }
}

void CLIDashboard::printDispatchDecision(const Incident& incident, const EmergencyVehicle* vehicle, const RouteResult& route, double score) {
    std::cout << "\n>>> DISPATCH DECISION: Assigning " << vehicle->getId() 
              << " to " << incident.getId() << "\n";
    if (route.reachable) {
        std::cout << "    Suitability Score: " << std::fixed << std::setprecision(2) << score << "\n";
        std::cout << "    Estimated Time:    " << std::fixed << std::setprecision(1) << route.estimatedTimeMinutes << " mins\n";
        std::cout << "    Route Distance:    " << std::fixed << std::setprecision(1) << route.totalDistanceKm << " km\n";
        std::cout << "    Route Path:        ";
        for (size_t i = 0; i < route.pathNodes.size(); ++i) {
            std::cout << route.pathNodes[i] << (i + 1 == route.pathNodes.size() ? "" : " -> ");
        }
        std::cout << "\n";
    } else {
        std::cout << "    No reachable route found!\n";
    }
}

void CLIDashboard::printHazardTable(const std::vector<V2XReport>& activeHazards) {
    printHeader("ACTIVE V2X HAZARDS");
    if (activeHazards.empty()) {
        std::cout << "No active hazards reported.\n";
        return;
    }
    std::cout << std::left << std::setw(15) << "Segment" 
              << std::setw(20) << "Hazard Type" 
              << std::setw(15) << "Impact" << "\n";
    std::cout << "---------------------------------------------------\n";
    for (const auto& hazard : activeHazards) {
        std::string segment = hazard.segmentFrom + " -> " + hazard.segmentTo;
        
        std::string impact;
        if (hazard.roadClosed) {
            impact = "CLOSED";
        } else {
            std::stringstream ss;
            ss << "Delay x" << std::fixed << std::setprecision(1) << hazard.severityMultiplier;
            impact = ss.str();
        }
        
        std::cout << std::left << std::setw(15) << segment
                  << std::setw(20) << hazard.hazardType
                  << std::setw(15) << impact << "\n";
    }
}
