#ifndef ROUTE_OPTIMIZER_H
#define ROUTE_OPTIMIZER_H

#include "RoadNetwork.h"
#include <string>
#include <vector>

struct RouteResult {
    bool reachable = false;
    std::vector<std::string> pathNodes;
    double totalDistanceKm = 0.0;
    double estimatedTimeMinutes = 0.0;
};

struct PerimeterRouteResult {
    bool fullyReachable = false;
    bool stagingFeasible = false;
    std::string stagingNodeId;
    std::vector<std::string> pathNodes;
    double travelTimeToStagingMinutes = 0.0;
    double travelDistanceToStagingKm = 0.0;
    double straightLineDistanceToTargetKm = 0.0;
};

class RouteOptimizer {
public:
    RouteOptimizer() = default;

    RouteResult findShortestRoute(const RoadNetwork& network, 
                                 const std::string& startNodeId, 
                                 const std::string& endNodeId) const;

    PerimeterRouteResult findPerimeterStagingRoute(const RoadNetwork& network,
                                                 const std::string& startNodeId,
                                                 const std::string& endNodeId,
                                                 double targetX,
                                                 double targetY) const;

    static double calculateSegmentTravelTimeMinutes(const RoadSegment& segment);
};

#endif // ROUTE_OPTIMIZER_H
