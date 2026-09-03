#include "V2XHub.h"
#include <sstream>
#include <iomanip>
#include <algorithm>

bool V2XHub::broadcastHazard(RoadNetwork& network, const std::string& from, const std::string& to,
                             const std::string& hazardType, double multiplier, bool isBlocked,
                             const std::string& description, double timestamp) {
    bool netUpdated = network.updateSegmentHazard(from, to, hazardType, multiplier, isBlocked);
    if (!netUpdated) {
        return false;
    }

    // Check if hazard already exists for this edge
    bool found = false;
    for (auto& alert : m_activeHazards) {
        if ((alert.fromNode == from && alert.toNode == to) ||
            (alert.fromNode == to && alert.toNode == from)) {
            alert.hazardType = hazardType;
            alert.congestionMultiplier = multiplier;
            alert.isBlocked = isBlocked;
            alert.description = description.empty() ? (hazardType + " reported on " + from + "-" + to) : description;
            alert.timestampMinutes = timestamp;
            found = true;
            break;
        }
    }

    if (!found) {
        HazardAlert alert;
        alert.id = "HAZ-" + std::to_string(m_hazardCounter++);
        alert.fromNode = from;
        alert.toNode = to;
        alert.hazardType = hazardType;
        alert.congestionMultiplier = multiplier;
        alert.isBlocked = isBlocked;
        alert.timestampMinutes = timestamp;
        alert.description = description.empty() ? (hazardType + " reported on " + from + "-" + to) : description;
        m_activeHazards.push_back(alert);
    }

    return true;
}

bool V2XHub::resolveHazard(RoadNetwork& network, const std::string& from, const std::string& to) {
    network.resolveSegmentHazard(from, to);

    auto it = std::remove_if(m_activeHazards.begin(), m_activeHazards.end(),
        [&](const HazardAlert& a) {
            return (a.fromNode == from && a.toNode == to) || (a.fromNode == to && a.toNode == from);
        });

    bool removed = (it != m_activeHazards.end());
    m_activeHazards.erase(it, m_activeHazards.end());
    return removed;
}

void V2XHub::clearAllHazards(RoadNetwork& network) {
    network.clearAllHazards();
    m_activeHazards.clear();
}

std::string V2XHub::toJson() const {
    std::ostringstream oss;
    oss << std::fixed << std::setprecision(2);
    oss << "[";
    for (size_t i = 0; i < m_activeHazards.size(); ++i) {
        if (i > 0) oss << ",";
        const auto& h = m_activeHazards[i];
        oss << "{\"id\":\"" << h.id << "\","
            << "\"from\":\"" << h.fromNode << "\","
            << "\"to\":\"" << h.toNode << "\","
            << "\"hazardType\":\"" << h.hazardType << "\","
            << "\"congestionMultiplier\":" << h.congestionMultiplier << ","
            << "\"isBlocked\":" << (h.isBlocked ? "true" : "false") << ","
            << "\"timestampMinutes\":" << h.timestampMinutes << ","
            << "\"description\":\"" << h.description << "\"}";
    }
    oss << "]";
    return oss.str();
}
