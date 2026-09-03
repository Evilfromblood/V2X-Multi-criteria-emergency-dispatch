#ifndef ROAD_NETWORK_H
#define ROAD_NETWORK_H

#include <string>
#include <vector>
#include <unordered_map>
#include <optional>

struct Intersection {
    std::string id;
    double x = 0.0;
    double y = 0.0;
    std::string label;
    std::string type; // "STATION", "HOSPITAL", "INTERSECTION", "COMMERCIAL", "RESIDENTIAL"
};

struct RoadSegment {
    std::string id;
    std::string fromNode;
    std::string toNode;
    double lengthKm = 1.0;
    double speedLimitKmH = 50.0;
    double congestionMultiplier = 1.0; // >= 1.0 (1.0 = free flow, >1.5 = heavy congestion)
    bool isBlocked = false;            // Road closure / impassable
    std::string hazardType = "NONE";   // "NONE", "ACCIDENT", "FLOOD", "CONSTRUCTION", "DEBRIS"
};

class RoadNetwork {
public:
    RoadNetwork() = default;

    void addNode(const Intersection& node);
    void addBidirectionalSegment(const std::string& from, const std::string& to, 
                                double lengthKm, double speedLimitKmH);
    void addDirectedSegment(const RoadSegment& segment);

    std::string getNearestNode(double x, double y) const;
    const Intersection* getNode(const std::string& id) const;
    bool hasNode(const std::string& id) const;

    const std::vector<RoadSegment>& getOutgoingSegments(const std::string& nodeId) const;
    const RoadSegment* getSegment(const std::string& from, const std::string& to) const;

    bool updateSegmentHazard(const std::string& from, const std::string& to,
                             const std::string& hazardType, double multiplier, bool isBlocked);
    bool resolveSegmentHazard(const std::string& from, const std::string& to);
    void clearAllHazards();

    const std::unordered_map<std::string, Intersection>& getAllNodes() const { return m_nodes; }
    std::vector<RoadSegment> getAllSegments() const;

    static RoadNetwork createDefaultCityGrid();

    std::string toJson() const;

private:
    std::unordered_map<std::string, Intersection> m_nodes;
    std::unordered_map<std::string, std::vector<RoadSegment>> m_adjacency;
    static const std::vector<RoadSegment> s_emptySegments;
};

#endif // ROAD_NETWORK_H
