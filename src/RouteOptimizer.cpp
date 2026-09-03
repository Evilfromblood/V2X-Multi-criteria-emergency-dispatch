#include "RouteOptimizer.h"
#include <cmath>
#include <queue>
#include <unordered_map>
#include <limits>
#include <algorithm>

double RouteOptimizer::calculateSegmentTravelTimeMinutes(const RoadSegment& segment) {
    if (segment.isBlocked) {
        return std::numeric_limits<double>::infinity();
    }
    double multiplier = (segment.congestionMultiplier < 1.0) ? 1.0 : segment.congestionMultiplier;
    double speedKmH = (segment.speedLimitKmH <= 0.0) ? 50.0 : segment.speedLimitKmH;
    double timeHours = (segment.lengthKm / speedKmH) * multiplier;
    return timeHours * 60.0;
}

RouteResult RouteOptimizer::findShortestRoute(const RoadNetwork& network, 
                                             const std::string& startNodeId, 
                                             const std::string& endNodeId) const {
    RouteResult result;
    result.reachable = false;
    result.totalDistanceKm = 0.0;
    result.estimatedTimeMinutes = 0.0;

    if (!network.hasNode(startNodeId) || !network.hasNode(endNodeId)) {
        return result;
    }

    if (startNodeId == endNodeId) {
        result.reachable = true;
        result.pathNodes.push_back(startNodeId);
        return result;
    }

    // Min-heap: pair<travelTimeMinutes, nodeId>
    typedef std::pair<double, std::string> Element;
    std::priority_queue<Element, std::vector<Element>, std::greater<Element>> pq;

    std::unordered_map<std::string, double> minTime;
    std::unordered_map<std::string, double> distanceSoFar;
    std::unordered_map<std::string, std::string> prevNode;
    std::unordered_map<std::string, double> prevEdgeDistance;

    for (const auto& pair : network.getAllNodes()) {
        minTime[pair.first] = std::numeric_limits<double>::infinity();
        distanceSoFar[pair.first] = 0.0;
    }

    minTime[startNodeId] = 0.0;
    pq.push({0.0, startNodeId});

    while (!pq.empty()) {
        auto [currentTime, u] = pq.top();
        pq.pop();

        if (currentTime > minTime[u]) {
            continue;
        }

        if (u == endNodeId) {
            break; // Reached destination with optimal time
        }

        for (const auto& edge : network.getOutgoingSegments(u)) {
            if (edge.isBlocked) {
                continue;
            }

            double edgeTime = calculateSegmentTravelTimeMinutes(edge);
            if (std::isinf(edgeTime)) {
                continue;
            }

            double newTime = currentTime + edgeTime;
            if (newTime < minTime[edge.toNode]) {
                minTime[edge.toNode] = newTime;
                distanceSoFar[edge.toNode] = distanceSoFar[u] + edge.lengthKm;
                prevNode[edge.toNode] = u;
                prevEdgeDistance[edge.toNode] = edge.lengthKm;
                pq.push({newTime, edge.toNode});
            }
        }
    }

    if (std::isinf(minTime[endNodeId])) {
        return result; // Unreachable
    }

    // Reconstruct path
    std::vector<std::string> path;
    std::string curr = endNodeId;
    while (curr != startNodeId && prevNode.find(curr) != prevNode.end()) {
        path.push_back(curr);
        curr = prevNode[curr];
    }
    path.push_back(startNodeId);
    std::reverse(path.begin(), path.end());

    result.reachable = true;
    result.pathNodes = path;
    result.estimatedTimeMinutes = minTime[endNodeId];
    result.totalDistanceKm = distanceSoFar[endNodeId];

    return result;
}

PerimeterRouteResult RouteOptimizer::findPerimeterStagingRoute(const RoadNetwork& network,
                                                             const std::string& startNodeId,
                                                             const std::string& endNodeId,
                                                             double targetX,
                                                             double targetY) const {
    PerimeterRouteResult pResult;
    pResult.fullyReachable = false;
    pResult.stagingFeasible = false;
    pResult.stagingNodeId = "";
    pResult.travelTimeToStagingMinutes = 0.0;
    pResult.travelDistanceToStagingKm = 0.0;
    pResult.straightLineDistanceToTargetKm = 0.0;

    if (!network.hasNode(startNodeId)) {
        return pResult;
    }

    // If destination node coordinates are not explicitly given, use end node's position
    if (targetX <= 0.0 || targetY <= 0.0) {
        const Intersection* endNode = network.getNode(endNodeId);
        if (endNode) {
            targetX = endNode->x;
            targetY = endNode->y;
        }
    }

    // First, check if direct full route exists
    RouteResult direct = findShortestRoute(network, startNodeId, endNodeId);
    if (direct.reachable) {
        pResult.fullyReachable = true;
        pResult.stagingFeasible = true;
        pResult.stagingNodeId = endNodeId;
        pResult.pathNodes = direct.pathNodes;
        pResult.travelTimeToStagingMinutes = direct.estimatedTimeMinutes;
        pResult.travelDistanceToStagingKm = direct.totalDistanceKm;
        pResult.straightLineDistanceToTargetKm = 0.0;
        return pResult;
    }

    // If direct route is unreachable, explore all reachable nodes from startNodeId
    typedef std::pair<double, std::string> Element;
    std::priority_queue<Element, std::vector<Element>, std::greater<Element>> pq;

    std::unordered_map<std::string, double> minTime;
    std::unordered_map<std::string, double> distanceSoFar;
    std::unordered_map<std::string, std::string> prevNode;

    for (const auto& pair : network.getAllNodes()) {
        minTime[pair.first] = std::numeric_limits<double>::infinity();
        distanceSoFar[pair.first] = 0.0;
    }

    minTime[startNodeId] = 0.0;
    pq.push({0.0, startNodeId});

    while (!pq.empty()) {
        auto [currentTime, u] = pq.top();
        pq.pop();

        if (currentTime > minTime[u]) {
            continue;
        }

        for (const auto& edge : network.getOutgoingSegments(u)) {
            if (edge.isBlocked) {
                continue;
            }

            double edgeTime = calculateSegmentTravelTimeMinutes(edge);
            if (std::isinf(edgeTime)) {
                continue;
            }

            double newTime = currentTime + edgeTime;
            if (newTime < minTime[edge.toNode]) {
                minTime[edge.toNode] = newTime;
                distanceSoFar[edge.toNode] = distanceSoFar[u] + edge.lengthKm;
                prevNode[edge.toNode] = u;
                pq.push({newTime, edge.toNode});
            }
        }
    }

    // Identify reachable node closest to (targetX, targetY)
    std::string bestStagingNode = "";
    double bestEuclideanDist = std::numeric_limits<double>::infinity();

    for (const auto& pair : network.getAllNodes()) {
        const std::string& nodeId = pair.first;
        if (!std::isinf(minTime[nodeId])) {
            double dx = pair.second.x - targetX;
            double dy = pair.second.y - targetY;
            double dist = std::sqrt(dx * dx + dy * dy);
            if (dist < bestEuclideanDist) {
                bestEuclideanDist = dist;
                bestStagingNode = nodeId;
            }
        }
    }

    if (bestStagingNode.empty()) {
        return pResult;
    }

    // Reconstruct partial path to bestStagingNode
    std::vector<std::string> path;
    std::string curr = bestStagingNode;
    while (curr != startNodeId && prevNode.find(curr) != prevNode.end()) {
        path.push_back(curr);
        curr = prevNode[curr];
    }
    path.push_back(startNodeId);
    std::reverse(path.begin(), path.end());

    pResult.fullyReachable = false;
    pResult.stagingFeasible = true;
    pResult.stagingNodeId = bestStagingNode;
    pResult.pathNodes = path;
    pResult.travelTimeToStagingMinutes = minTime[bestStagingNode];
    pResult.travelDistanceToStagingKm = distanceSoFar[bestStagingNode];
    pResult.straightLineDistanceToTargetKm = bestEuclideanDist;

    return pResult;
}
