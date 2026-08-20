#include "RouteOptimizer.h"
#include <queue>
#include <unordered_map>
#include <limits>
#include <algorithm>

RouteResult RouteOptimizer::calculateFastestRoute(const RoadNetwork& network, const std::string& startNode, const std::string& endNode) const {
    RouteResult result;
    result.reachable = false;
    result.totalDistanceKm = 0.0;
    result.estimatedTimeMinutes = 0.0;

    if (startNode == endNode) {
        result.reachable = true;
        result.pathNodes.push_back(startNode);
        return result;
    }

    const auto& adjacencyList = network.getAdjacencyList();
    if (adjacencyList.find(startNode) == adjacencyList.end() || adjacencyList.find(endNode) == adjacencyList.end()) {
        return result;
    }

    std::unordered_map<std::string, double> minTimes;
    std::unordered_map<std::string, std::string> previousNode;
    std::unordered_map<std::string, double> distances; // Track distance to reconstruct path cost

    for (const auto& pair : network.getIntersections()) {
        minTimes[pair.first] = std::numeric_limits<double>::infinity();
    }
    
    minTimes[startNode] = 0.0;
    distances[startNode] = 0.0;

    using QueueElement = std::pair<double, std::string>;
    std::priority_queue<QueueElement, std::vector<QueueElement>, std::greater<QueueElement>> pq;
    pq.push({0.0, startNode});

    while (!pq.empty()) {
        double current_time = pq.top().first;
        std::string u = pq.top().second;
        pq.pop();

        if (u == endNode) {
            break;
        }

        if (current_time > minTimes[u]) {
            continue;
        }

        auto it = adjacencyList.find(u);
        if (it != adjacencyList.end()) {
            for (const auto& edge : it->second) {
                if (edge.isBlocked) {
                    continue;
                }

                double edgeTime = (edge.lengthKm / edge.speedLimitKmH) * edge.congestionMultiplier * 60.0;
                double newTime = current_time + edgeTime;

                if (newTime < minTimes[edge.toNode]) {
                    minTimes[edge.toNode] = newTime;
                    distances[edge.toNode] = distances[u] + edge.lengthKm;
                    previousNode[edge.toNode] = u;
                    pq.push(std::make_pair(newTime, edge.toNode));
                }
            }
        }
    }

    if (minTimes[endNode] != std::numeric_limits<double>::infinity()) {
        result.reachable = true;
        result.estimatedTimeMinutes = minTimes[endNode];
        result.totalDistanceKm = distances[endNode];

        std::string curr = endNode;
        while (curr != startNode) {
            result.pathNodes.push_back(curr);
            curr = previousNode[curr];
        }
        result.pathNodes.push_back(startNode);
        std::reverse(result.pathNodes.begin(), result.pathNodes.end());
    }

    return result;
}
