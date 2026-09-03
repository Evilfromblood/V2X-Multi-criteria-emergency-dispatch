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

    double getCurrentWaterLiters() const override { return m_currentWaterLiters; }
    double getMaxWaterLiters() const override { return m_waterCapacityLiters; }
    double getWaterPercentage() const override { 
        return (m_waterCapacityLiters > 0.0) ? (m_currentWaterLiters / m_waterCapacityLiters) * 100.0 : 100.0; 
    }
    bool isLowWater() const override { return getWaterPercentage() < 20.0; }
    void dischargeWater(double liters) override { 
        m_currentWaterLiters = std::max(0.0, m_currentWaterLiters - liters); 
        m_totalWaterDischargedLiters += liters; 
    }
    void replenishWater() override { 
        m_currentWaterLiters = m_waterCapacityLiters; 
        m_resupplyStatus = "NONE"; 
    }
    double getTotalWaterDischargedLiters() const { return m_totalWaterDischargedLiters; }

    double calculateSuitability(const Incident& incident, const RoadNetwork& network, 
                               RouteOptimizer& optimizer) const override;

    std::string toJson() const override;

protected:
    void onArrivedAtDestination(const RoadNetwork& network, RouteOptimizer& optimizer) override;
    void onStateTimerExpired(const RoadNetwork& network, RouteOptimizer& optimizer) override;

private:
    double m_waterCapacityLiters = 4000.0;
    double m_currentWaterLiters = 4000.0;
    double m_totalWaterDischargedLiters = 0.0;
    double m_ladderLengthMeters = 30.0;
};

#endif // FIRE_ENGINE_H
