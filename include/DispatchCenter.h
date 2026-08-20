#ifndef DISPATCH_CENTER_H
#define DISPATCH_CENTER_H

#include <vector>
#include <memory>
#include "EmergencyVehicle.h"
#include "Incident.h"
#include "RoadNetwork.h"
#include "RouteOptimizer.h"

class DispatchCenter {
private:
    std::vector<std::unique_ptr<EmergencyVehicle>> fleet;
    std::vector<Incident> activeIncidents;
    RoadNetwork* network;
    RouteOptimizer* optimizer;

public:
    DispatchCenter(RoadNetwork* net = nullptr, RouteOptimizer* opt = nullptr);

    // Fleet management
    void addVehicle(std::unique_ptr<EmergencyVehicle> vehicle);
    void printFleetStatus() const;

    // Incident management
    void addIncident(const Incident& incident);
    
    // Dispatch logic
    EmergencyVehicle* findBestVehicle(const Incident& incident, double& bestTime) const;
    void dispatchToIncident(const Incident& incident);
    void dispatchAll(); // Dispatches to all active incidents
};

#endif // DISPATCH_CENTER_H
