#include "RoadNetwork.h"
#include <iostream>

void RoadNetwork::addIntersection(const std::string& id, double x, double y) {
    intersections[id] = {id, x, y};
}

void RoadNetwork::addRoadSegment(const std::string& u, const std::string& v, double lengthKm, double speedLimitKmH) {
    adjacencyList[u].push_back({u, v, lengthKm, speedLimitKmH, 1.0, false});
    adjacencyList[v].push_back({v, u, lengthKm, speedLimitKmH, 1.0, false});
}

void RoadNetwork::displayNetwork() const {
    std::cout << "\n--- Road Network Status ---\n";
    for (const auto& pair : adjacencyList) {
        for (const auto& segment : pair.second) {
            std::cout << "Segment [" << segment.fromNode << " -> " << segment.toNode << "] "
                      << "| Length: " << segment.lengthKm << " km | Speed Limit: " << segment.speedLimitKmH << " km/h "
                      << "| Congestion: " << segment.congestionMultiplier << "x "
                      << "| Blocked: " << (segment.isBlocked ? "Yes" : "No") << "\n";
        }
    }
}

RoadSegment* RoadNetwork::getSegment(const std::string& u, const std::string& v) {
    auto it = adjacencyList.find(u);
    if (it != adjacencyList.end()) {
        for (auto& segment : it->second) {
            if (segment.toNode == v) {
                return &segment;
            }
        }
    }
    return nullptr;
}

const std::unordered_map<std::string, std::vector<RoadSegment>>& RoadNetwork::getAdjacencyList() const {
    return adjacencyList;
}

const std::unordered_map<std::string, Intersection>& RoadNetwork::getIntersections() const {
    return intersections;
}

std::string RoadNetwork::getNearestNode(double x, double y) const {
    std::string nearest = "";
    double min_dist = -1.0;
    
    for (const auto& pair : intersections) {
        double dist = (pair.second.x - x) * (pair.second.x - x) + (pair.second.y - y) * (pair.second.y - y);
        if (min_dist < 0 || dist < min_dist) {
            min_dist = dist;
            nearest = pair.first;
        }
    }
    return nearest;
}
