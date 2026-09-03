#ifndef FIRE_ENGINE_H
#define FIRE_ENGINE_H

#include "EmergencyVehicle.h"

class FireEngine : public EmergencyVehicle {
public:
    FireEngine(std::string id, std::string homeBaseNode, double x, double y,
               double waterCapacityLiters = 4000.0, double ladderLengthMeters = 30.0,
               double speedKmH = 55.0);

    double getWaterCapacityLiters() const { return m_waterCapacityLiters; }
    double getLadderLengthMeters() const { return m_ladderLengthMeters; }

    double calculateSuitability(const Incident& incident, const RoadNetwork& network, 
                               RouteOptimizer& optimizer) const override;

    std::string toJson() const override;

protected:
    void onArrivedAtDestination(const RoadNetwork& network, RouteOptimizer& optimizer) override;
    void onStateTimerExpired(const RoadNetwork& network, RouteOptimizer& optimizer) override;

private:
    double m_waterCapacityLiters = 4000.0;
    double m_ladderLengthMeters = 30.0;
};

#endif // FIRE_ENGINE_H
