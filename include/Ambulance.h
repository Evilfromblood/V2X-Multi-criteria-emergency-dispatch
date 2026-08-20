#ifndef AMBULANCE_H
#define AMBULANCE_H

#include "EmergencyVehicle.h"

class Ambulance : public EmergencyVehicle {
private:
    int maxTriageLevel;
    bool hasParamedic;

public:
    Ambulance(const std::string& id,
              double x,
              double y,
              double speed,
              int triageLevel,
              bool paramedicAvailable);

    double calculateSuitability(const Incident& incident) const override;
    void displayInfo() const override;
    std::string getVehicleType() const override;

    int getMaxTriageLevel() const;
    bool hasParamedicOnBoard() const;
};

#endif // AMBULANCE_H