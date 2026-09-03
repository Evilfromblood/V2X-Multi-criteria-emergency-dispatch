#ifndef AMBULANCE_H
#define AMBULANCE_H

#include "EmergencyVehicle.h"

class Ambulance : public EmergencyVehicle {
public:
    Ambulance(std::string id, std::string homeBaseNode, double x, double y,
              int maxTriageLevel = 3, bool hasParamedic = false, double speedKmH = 65.0);

    int getMaxTriageLevel() const { return m_maxTriageLevel; }
    bool hasParamedic() const { return m_hasParamedic; }
    std::string getAssignedHospitalNode() const { return m_assignedHospitalNode; }
    void setAssignedHospitalNode(const std::string& hospitalNode) { m_assignedHospitalNode = hospitalNode; }

    double calculateSuitability(const Incident& incident, const RoadNetwork& network, 
                               RouteOptimizer& optimizer) const override;

    std::string toJson() const override;

protected:
    void onArrivedAtDestination(const RoadNetwork& network, RouteOptimizer& optimizer) override;
    void onStateTimerExpired(const RoadNetwork& network, RouteOptimizer& optimizer) override;

private:
    int m_maxTriageLevel = 3;
    bool m_hasParamedic = false;
    std::string m_assignedHospitalNode = "N11_HOSPITAL";
};

#endif // AMBULANCE_H
