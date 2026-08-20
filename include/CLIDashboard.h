#ifndef CLI_DASHBOARD_H
#define CLI_DASHBOARD_H

#include <string>
#include <vector>
#include <memory>
#include "EmergencyVehicle.h"
#include "Incident.h"
#include "RouteOptimizer.h"
#include "V2XHub.h"

class CLIDashboard {
public:
    static void printHeader(const std::string& title);
    static void printFleetTable(const std::vector<std::unique_ptr<EmergencyVehicle>>& fleet);
    static void printDispatchDecision(const Incident& incident, const EmergencyVehicle* vehicle, const RouteResult& route, double score);
    static void printHazardTable(const std::vector<V2XReport>& activeHazards);
};

#endif // CLI_DASHBOARD_H
