#include "RoadNetwork.h"
#include <cmath>
#include <sstream>
#include <iomanip>
#include <limits>
#include <algorithm>

const std::vector<RoadSegment> RoadNetwork::s_emptySegments;

void RoadNetwork::addNode(const Intersection& node) {
    m_nodes[node.id] = node;
}

void RoadNetwork::addDirectedSegment(const RoadSegment& segment) {
    m_adjacency[segment.fromNode].push_back(segment);
}

void RoadNetwork::addBidirectionalSegment(const std::string& from, const std::string& to, 
                                        double lengthKm, double speedLimitKmH) {
    RoadSegment forward;
    forward.id = from + "_" + to;
    forward.fromNode = from;
    forward.toNode = to;
    forward.lengthKm = lengthKm;
    forward.speedLimitKmH = speedLimitKmH;
    forward.congestionMultiplier = 1.0;
    forward.isBlocked = false;
    forward.hazardType = "NONE";
    m_adjacency[from].push_back(forward);

    RoadSegment backward;
    backward.id = to + "_" + from;
    backward.fromNode = to;
    backward.toNode = from;
    backward.lengthKm = lengthKm;
    backward.speedLimitKmH = speedLimitKmH;
    backward.congestionMultiplier = 1.0;
    backward.isBlocked = false;
    backward.hazardType = "NONE";
    m_adjacency[to].push_back(backward);
}

std::string RoadNetwork::getNearestNode(double x, double y) const {
    std::string nearestId = "";
    double minDistance = std::numeric_limits<double>::infinity();

    for (const auto& pair : m_nodes) {
        const auto& node = pair.second;
        double dx = node.x - x;
        double dy = node.y - y;
        double distSq = dx * dx + dy * dy;
        if (distSq < minDistance) {
            minDistance = distSq;
            nearestId = node.id;
        }
    }
    return nearestId;
}

const Intersection* RoadNetwork::getNode(const std::string& id) const {
    auto it = m_nodes.find(id);
    if (it != m_nodes.end()) {
        return &it->second;
    }
    return nullptr;
}

bool RoadNetwork::hasNode(const std::string& id) const {
    return m_nodes.find(id) != m_nodes.end();
}

const std::vector<RoadSegment>& RoadNetwork::getOutgoingSegments(const std::string& nodeId) const {
    auto it = m_adjacency.find(nodeId);
    if (it != m_adjacency.end()) {
        return it->second;
    }
    return s_emptySegments;
}

const RoadSegment* RoadNetwork::getSegment(const std::string& from, const std::string& to) const {
    auto it = m_adjacency.find(from);
    if (it != m_adjacency.end()) {
        for (const auto& seg : it->second) {
            if (seg.toNode == to) {
                return &seg;
            }
        }
    }
    return nullptr;
}

bool RoadNetwork::updateSegmentHazard(const std::string& from, const std::string& to,
                                     const std::string& hazardType, double multiplier, bool isBlocked) {
    bool updated = false;

    // Update forward direction
    auto itFrom = m_adjacency.find(from);
    if (itFrom != m_adjacency.end()) {
        for (auto& seg : itFrom->second) {
            if (seg.toNode == to) {
                seg.congestionMultiplier = (multiplier < 1.0) ? 1.0 : multiplier;
                seg.isBlocked = isBlocked;
                seg.hazardType = hazardType;
                updated = true;
                break;
            }
        }
    }

    // Update reverse direction
    auto itTo = m_adjacency.find(to);
    if (itTo != m_adjacency.end()) {
        for (auto& seg : itTo->second) {
            if (seg.toNode == from) {
                seg.congestionMultiplier = (multiplier < 1.0) ? 1.0 : multiplier;
                seg.isBlocked = isBlocked;
                seg.hazardType = hazardType;
                updated = true;
                break;
            }
        }
    }

    return updated;
}

bool RoadNetwork::resolveSegmentHazard(const std::string& from, const std::string& to) {
    return updateSegmentHazard(from, to, "NONE", 1.0, false);
}

void RoadNetwork::clearAllHazards() {
    for (auto& pair : m_adjacency) {
        for (auto& seg : pair.second) {
            seg.congestionMultiplier = 1.0;
            seg.isBlocked = false;
            seg.hazardType = "NONE";
        }
    }
}

std::vector<RoadSegment> RoadNetwork::getAllSegments() const {
    std::vector<RoadSegment> all;
    for (const auto& pair : m_adjacency) {
        for (const auto& seg : pair.second) {
            all.push_back(seg);
        }
    }
    return all;
}

RoadNetwork RoadNetwork::createDefaultCityGrid() {
    RoadNetwork net;

    // 16 Nodes arranged on a 12km x 12km grid
    net.addNode({"N1_HQ", 2.0, 2.0, "Central Station HQ", "STATION"});
    net.addNode({"N2", 5.0, 2.0, "South Junction", "INTERSECTION"});
    net.addNode({"N3", 8.0, 2.0, "East Depot", "STATION"});
    net.addNode({"N4", 11.0, 2.0, "Harbor Tech Zone", "COMMERCIAL"});

    net.addNode({"N5", 2.0, 5.0, "West Boulevard", "INTERSECTION"});
    net.addNode({"N6", 5.0, 5.0, "Downtown Center", "COMMERCIAL"});
    net.addNode({"N7", 8.0, 5.0, "Midtown Crossing", "INTERSECTION"});
    net.addNode({"N8", 11.0, 5.0, "Industrial District", "INDUSTRIAL"});

    net.addNode({"N9", 2.0, 8.0, "Northwest Base", "STATION"});
    net.addNode({"N10", 5.0, 8.0, "University Quarter", "RESIDENTIAL"});
    net.addNode({"N11_HOSPITAL", 8.0, 8.0, "Metro Trauma Center", "HOSPITAL"});
    net.addNode({"N12", 11.0, 8.0, "East Bridge South", "INTERSECTION"});

    net.addNode({"N13", 2.0, 11.0, "Airport Expressway", "COMMERCIAL"});
    net.addNode({"N14", 5.0, 11.0, "North Hills Suburbs", "RESIDENTIAL"});
    net.addNode({"N15", 8.0, 11.0, "Suburban Heights", "RESIDENTIAL"});
    net.addNode({"N16", 11.0, 11.0, "East Bridge North", "INTERSECTION"});

    // Horizontal links (3 km apart)
    net.addBidirectionalSegment("N1_HQ", "N2", 3.0, 60.0);
    net.addBidirectionalSegment("N2", "N3", 3.0, 60.0);
    net.addBidirectionalSegment("N3", "N4", 3.0, 50.0);

    net.addBidirectionalSegment("N5", "N6", 3.0, 45.0);
    net.addBidirectionalSegment("N6", "N7", 3.0, 40.0);
    net.addBidirectionalSegment("N7", "N8", 3.0, 50.0);

    net.addBidirectionalSegment("N9", "N10", 3.0, 50.0);
    net.addBidirectionalSegment("N10", "N11_HOSPITAL", 3.0, 50.0);
    net.addBidirectionalSegment("N11_HOSPITAL", "N12", 3.0, 50.0);

    net.addBidirectionalSegment("N13", "N14", 3.0, 50.0);
    net.addBidirectionalSegment("N14", "N15", 3.0, 45.0);
    net.addBidirectionalSegment("N15", "N16", 3.0, 50.0);

    // Vertical links (3 km apart)
    net.addBidirectionalSegment("N1_HQ", "N5", 3.0, 60.0);
    net.addBidirectionalSegment("N5", "N9", 3.0, 60.0);
    net.addBidirectionalSegment("N9", "N13", 3.0, 75.0); // Arterial express

    net.addBidirectionalSegment("N2", "N6", 3.0, 50.0);
    net.addBidirectionalSegment("N6", "N10", 3.0, 45.0);
    net.addBidirectionalSegment("N10", "N14", 3.0, 50.0);

    net.addBidirectionalSegment("N3", "N7", 3.0, 50.0);
    net.addBidirectionalSegment("N7", "N11_HOSPITAL", 3.0, 55.0);
    net.addBidirectionalSegment("N11_HOSPITAL", "N15", 3.0, 50.0);

    net.addBidirectionalSegment("N4", "N8", 3.0, 60.0);
    net.addBidirectionalSegment("N8", "N12", 3.0, 55.0);
    net.addBidirectionalSegment("N12", "N16", 3.0, 65.0); // River bridge

    // Diagonal Express Highways (hypotenuse: sqrt(3^2 + 3^2) = 4.24 km)
    net.addBidirectionalSegment("N1_HQ", "N6", 4.24, 70.0);
    net.addBidirectionalSegment("N6", "N11_HOSPITAL", 4.24, 70.0);
    net.addBidirectionalSegment("N7", "N12", 4.24, 65.0);
    net.addBidirectionalSegment("N10", "N15", 4.24, 60.0);

    return net;
}

std::string RoadNetwork::toJson() const {
    std::ostringstream oss;
    oss << std::fixed << std::setprecision(2);
    oss << "{\"nodes\":[";
    bool firstNode = true;
    for (const auto& pair : m_nodes) {
        if (!firstNode) oss << ",";
        firstNode = false;
        const auto& n = pair.second;
        oss << "{\"id\":\"" << n.id << "\","
            << "\"x\":" << n.x << ","
            << "\"y\":" << n.y << ","
            << "\"label\":\"" << n.label << "\","
            << "\"type\":\"" << n.type << "\"}";
    }
    oss << "],\"segments\":[";
    bool firstSeg = true;
    for (const auto& pair : m_adjacency) {
        for (const auto& s : pair.second) {
            // Only output if fromNode < toNode to avoid duplicate bidirectional lines in visualization
            if (s.fromNode < s.toNode) {
                if (!firstSeg) oss << ",";
                firstSeg = false;
                oss << "{\"id\":\"" << s.id << "\","
                    << "\"from\":\"" << s.fromNode << "\","
                    << "\"to\":\"" << s.toNode << "\","
                    << "\"lengthKm\":" << s.lengthKm << ","
                    << "\"speedLimitKmH\":" << s.speedLimitKmH << ","
                    << "\"congestionMultiplier\":" << s.congestionMultiplier << ","
                    << "\"isBlocked\":" << (s.isBlocked ? "true" : "false") << ","
                    << "\"hazardType\":\"" << s.hazardType << "\"}";
            }
        }
    }
    oss << "]}";
    return oss.str();
}
