#ifndef FIRE_ENGINE_H
#define FIRE_ENGINE_H

#include "EmergencyVehicle.h"

class FireEngine : public EmergencyVehicle {
private:
    double waterCapacityLiters;
    double ladderLengthMeters;

public:
    FireEngine(const std::string& id,
               double x,
               double y,
               double speed,
               double waterCapacity,
               double ladderLength);

    double calculateSuitability(const Incident& incident) const override;
    void displayInfo() const override;
    std::string getVehicleType() const override;

    double getWaterCapacityLiters() const;
    double getLadderLengthMeters() const;
};

#endif // FIRE_ENGINE_H
