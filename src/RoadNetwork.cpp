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

    // 1. Core Metropolitan Grid (16 Baseline Nodes)
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

    // 2. West Sector: Outer Bypass Highway & Airport Corridor
    net.addNode({"N28_CARGO_DEPOT", 1.0, 2.0, "Cargo Transit Depot", "STATION"});
    net.addNode({"N27_OUTER_BYPASS", 1.0, 5.0, "West Outer Ringway", "INTERSECTION"});
    net.addNode({"N26_AIRPORT_DEPOT", 1.0, 8.0, "Airport Fire & EMS Station", "STATION"});
    net.addNode({"N25_AIRPORT", 1.0, 11.0, "Metro International Airport", "COMMERCIAL"});

    // 3. North Sector: Industrial Zone & Logistics Depot
    net.addNode({"N20_NORTH_GATE", 2.0, 17.0, "North Gate Expressway", "INTERSECTION"});
    net.addNode({"N17_LOGISTICS", 5.0, 17.0, "Logistics Hub & Depot", "STATION"});
    net.addNode({"N18_INDUSTRIAL", 8.0, 17.0, "North Industrial Park", "INDUSTRIAL"});
    net.addNode({"N19_RAIL_YARD", 11.0, 17.0, "Freight Rail Terminal", "INDUSTRIAL"});
    net.addNode({"N29_FREIGHT_HUB", 5.0, 23.0, "Metropolitan Freight Complex", "INDUSTRIAL"});
    net.addNode({"N30_NORTH_METRO", 11.0, 23.0, "North Metro Perimeter Plaza", "COMMERCIAL"});

    // 4. South-East Sector: Suburban District & Community Clinic
    net.addNode({"N23_MARINA", 18.0, 2.0, "Coastal Marina & Yacht Basin", "COMMERCIAL"});
    net.addNode({"N21_CLINIC", 18.0, 5.0, "East Community Clinic", "HOSPITAL"});
    net.addNode({"N22_SUBURB_EAST", 18.0, 8.0, "Evergreen Suburban District", "RESIDENTIAL"});
    net.addNode({"N24_TECH_CAMPUS", 18.0, 11.0, "Silicon Bay Tech Campus", "COMMERCIAL"});
    net.addNode({"N31_COASTAL_SOUTH", 24.0, 2.0, "Coastal Point South", "RESIDENTIAL"});
    net.addNode({"N32_COASTAL_NORTH", 24.0, 8.0, "Coastal Point North", "COMMERCIAL"});

    // Core Horizontal links (3 km apart)
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

    // Core Vertical links (3 km apart)
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

    // Core Diagonal Express Highways
    net.addBidirectionalSegment("N1_HQ", "N6", 4.24, 70.0);
    net.addBidirectionalSegment("N6", "N11_HOSPITAL", 4.24, 70.0);
    net.addBidirectionalSegment("N7", "N12", 4.24, 65.0);
    net.addBidirectionalSegment("N10", "N15", 4.24, 60.0);

    // West Sector Outer Bypass Corridors (80 km/h)
    net.addBidirectionalSegment("N28_CARGO_DEPOT", "N27_OUTER_BYPASS", 3.0, 80.0);
    net.addBidirectionalSegment("N27_OUTER_BYPASS", "N26_AIRPORT_DEPOT", 3.0, 80.0);
    net.addBidirectionalSegment("N26_AIRPORT_DEPOT", "N25_AIRPORT", 3.0, 80.0);

    // West-to-Core Connectors
    net.addBidirectionalSegment("N28_CARGO_DEPOT", "N1_HQ", 1.0, 60.0);
    net.addBidirectionalSegment("N27_OUTER_BYPASS", "N5", 1.0, 60.0);
    net.addBidirectionalSegment("N26_AIRPORT_DEPOT", "N9", 1.0, 60.0);
    net.addBidirectionalSegment("N25_AIRPORT", "N13", 1.0, 60.0);

    // West Diagonal Bypasses
    net.addBidirectionalSegment("N27_OUTER_BYPASS", "N6", 4.0, 75.0);
    net.addBidirectionalSegment("N26_AIRPORT_DEPOT", "N10", 4.0, 75.0);

    // North Sector Corridors
    net.addBidirectionalSegment("N13", "N20_NORTH_GATE", 6.0, 70.0);
    net.addBidirectionalSegment("N14", "N17_LOGISTICS", 6.0, 70.0);
    net.addBidirectionalSegment("N15", "N18_INDUSTRIAL", 6.0, 70.0);
    net.addBidirectionalSegment("N16", "N19_RAIL_YARD", 6.0, 70.0);
    net.addBidirectionalSegment("N25_AIRPORT", "N20_NORTH_GATE", 6.08, 85.0);

    net.addBidirectionalSegment("N20_NORTH_GATE", "N17_LOGISTICS", 3.0, 65.0);
    net.addBidirectionalSegment("N17_LOGISTICS", "N18_INDUSTRIAL", 3.0, 65.0);
    net.addBidirectionalSegment("N18_INDUSTRIAL", "N19_RAIL_YARD", 3.0, 65.0);

    net.addBidirectionalSegment("N17_LOGISTICS", "N29_FREIGHT_HUB", 6.0, 75.0);
    net.addBidirectionalSegment("N19_RAIL_YARD", "N30_NORTH_METRO", 6.0, 75.0);
    net.addBidirectionalSegment("N29_FREIGHT_HUB", "N30_NORTH_METRO", 6.0, 80.0);

    // North Diagonal Expressways
    net.addBidirectionalSegment("N11_HOSPITAL", "N17_LOGISTICS", 9.48, 80.0);
    net.addBidirectionalSegment("N14", "N18_INDUSTRIAL", 6.7, 70.0);

    // South-East Sector Corridors
    net.addBidirectionalSegment("N4", "N23_MARINA", 7.0, 65.0);
    net.addBidirectionalSegment("N8", "N21_CLINIC", 7.0, 65.0);
    net.addBidirectionalSegment("N12", "N22_SUBURB_EAST", 7.0, 65.0);
    net.addBidirectionalSegment("N16", "N24_TECH_CAMPUS", 7.0, 65.0);

    net.addBidirectionalSegment("N23_MARINA", "N21_CLINIC", 3.0, 55.0);
    net.addBidirectionalSegment("N21_CLINIC", "N22_SUBURB_EAST", 3.0, 55.0);
    net.addBidirectionalSegment("N22_SUBURB_EAST", "N24_TECH_CAMPUS", 3.0, 60.0);

    net.addBidirectionalSegment("N23_MARINA", "N31_COASTAL_SOUTH", 6.0, 70.0);
    net.addBidirectionalSegment("N22_SUBURB_EAST", "N32_COASTAL_NORTH", 6.0, 70.0);
    net.addBidirectionalSegment("N31_COASTAL_SOUTH", "N32_COASTAL_NORTH", 6.0, 75.0);

    // South-East Diagonal Emergency Links
    net.addBidirectionalSegment("N11_HOSPITAL", "N21_CLINIC", 10.44, 85.0);
    net.addBidirectionalSegment("N19_RAIL_YARD", "N24_TECH_CAMPUS", 9.22, 80.0);

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
