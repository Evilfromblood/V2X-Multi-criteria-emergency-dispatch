#ifndef V2X_HUB_H
#define V2X_HUB_H

#include "RoadNetwork.h"
#include <string>
#include <vector>
#include <unordered_map>

struct HazardAlert {
    std::string id;
    std::string fromNode;
    std::string toNode;
    std::string hazardType; // "ACCIDENT", "FLOOD", "CONSTRUCTION", "DEBRIS", "GRIDLOCK"
    double congestionMultiplier = 2.0;
    bool isBlocked = false;
    double timestampMinutes = 0.0;
    std::string description;
};

class V2XHub {
public:
    V2XHub() = default;

    bool broadcastHazard(RoadNetwork& network, const std::string& from, const std::string& to,
                         const std::string& hazardType, double multiplier, bool isBlocked,
                         const std::string& description = "", double timestamp = 0.0);

    bool resolveHazard(RoadNetwork& network, const std::string& from, const std::string& to);

    void clearAllHazards(RoadNetwork& network);

    const std::vector<HazardAlert>& getActiveHazards() const { return m_activeHazards; }
    
    std::string toJson() const;

private:
    std::vector<HazardAlert> m_activeHazards;
    int m_hazardCounter = 1;
};

#endif // V2X_HUB_H
