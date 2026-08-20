#ifndef EMERGENCY_VEHICLE_H
#define EMERGENCY_VEHICLE_H

#include <string>

class Incident; // Forward declaration

class EmergencyVehicle {
protected:
    std::string vehicleId;
    double posX;
    double posY;
    double speedKmH;
    bool available;
    int assignedIncidentSeverity;
    std::string assignedIncidentId;

public:
    EmergencyVehicle(const std::string& id,
                     double x,
                     double y,
                     double speed);

    virtual ~EmergencyVehicle();

    // Pure virtual functions for polymorphism
    virtual double calculateSuitability(const Incident& incident, double travelTimeMin) const = 0;
    virtual void displayInfo() const = 0;
    virtual std::string getVehicleType() const = 0;

    // Getters
    std::string getId() const;
    double getPosX() const;
    double getPosY() const;
    double getSpeedKmH() const;
    bool isAvailable() const;
    int getAssignedIncidentSeverity() const;
    std::string getAssignedIncidentId() const;

    // Setters
    void setAvailable(bool status);
    void setPosition(double x, double y);
    void setSpeedKmH(double speed);
    void setAssignedIncident(const std::string& incidentId, int severity);
};

#endif // EMERGENCY_VEHICLE_H