#ifndef ROUTE_OPTIMIZER_H
#define ROUTE_OPTIMIZER_H

#include <vector>
#include <string>
#include "RoadNetwork.h"

struct RouteResult {
    bool reachable;
    std::vector<std::string> pathNodes;
    double totalDistanceKm;
    double estimatedTimeMinutes;
};

class RouteOptimizer {
public:
    RouteResult calculateFastestRoute(const RoadNetwork& network, const std::string& startNode, const std::string& endNode) const;
};

#endif // ROUTE_OPTIMIZER_H
