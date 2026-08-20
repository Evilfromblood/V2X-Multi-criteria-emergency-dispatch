#ifndef ROAD_NETWORK_H
#define ROAD_NETWORK_H

#include <string>
#include <vector>
#include <unordered_map>

struct Intersection {
    std::string id;
    double x;
    double y;
};

struct RoadSegment {
    std::string fromNode;
    std::string toNode;
    double lengthKm;
    double speedLimitKmH;
    double congestionMultiplier = 1.0;
    bool isBlocked = false;
};

class RoadNetwork {
private:
    std::unordered_map<std::string, Intersection> intersections;
    std::unordered_map<std::string, std::vector<RoadSegment>> adjacencyList;

public:
    void addIntersection(const std::string& id, double x, double y);
    void addRoadSegment(const std::string& u, const std::string& v, double lengthKm, double speedLimitKmH);
    void displayNetwork() const;
    RoadSegment* getSegment(const std::string& u, const std::string& v);
    const std::unordered_map<std::string, std::vector<RoadSegment>>& getAdjacencyList() const;
};

#endif // ROAD_NETWORK_H
