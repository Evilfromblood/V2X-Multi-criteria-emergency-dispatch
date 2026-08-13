#ifndef EMERGENCY_VEHICLE_H
#define EMERGENCY_VEHICLE_H

#include <string>

class Incident;  // Declared now; implemented in a later phase.

class EmergencyVehicle {
protected:
    std::string vehicleId;
    double posX;
    double posY;
    double speedKmH;
    bool available;

public:
    EmergencyVehicle(const std::string& id,
                     double x,
                     double y,
                     double speed);

    virtual ~EmergencyVehicle();

    virtual double calculateSuitability(const Incident& incident) const = 0;
    virtual void displayInfo() const = 0;
    virtual std::string getVehicleType() const = 0;

    std::string getId() const;
    double getX() const;
    double getY() const;
    double getSpeedKmH() const;
    bool isAvailable() const;

    void setAvailable(bool status);
};

#endif