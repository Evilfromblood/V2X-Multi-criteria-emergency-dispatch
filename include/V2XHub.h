#ifndef V2X_HUB_H
#define V2X_HUB_H

#include <string>
#include <vector>
#include "RoadNetwork.h"

struct V2XReport {
    std::string segmentFrom;
    std::string segmentTo;
    std::string hazardType; // "Heavy Traffic", "Flooding", "Accident Blockage"
    double severityMultiplier;
    bool roadClosed;
};

class V2XHub {
private:
    std::vector<V2XReport> activeHazards;

public:
    void broadcastHazard(RoadNetwork& network, const V2XReport& report);
    void resolveHazard(RoadNetwork& network, const std::string& u, const std::string& v);
    void displayActiveHazards() const;
};

#endif // V2X_HUB_H
