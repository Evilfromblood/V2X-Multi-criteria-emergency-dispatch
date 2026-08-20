#include "EmergencyVehicle.h"

EmergencyVehicle::EmergencyVehicle(const std::string& id,
                                   double x,
                                   double y,
                                   double speed)
    : vehicleId(id), posX(x), posY(y), speedKmH(speed), available(true), assignedIncidentSeverity(0), assignedIncidentId("") {
}

EmergencyVehicle::~EmergencyVehicle() {
}

std::string EmergencyVehicle::getId() const {
    return vehicleId;
}

double EmergencyVehicle::getPosX() const {
    return posX;
}

double EmergencyVehicle::getPosY() const {
    return posY;
}

double EmergencyVehicle::getSpeedKmH() const {
    return speedKmH;
}

bool EmergencyVehicle::isAvailable() const {
    return available;
}

int EmergencyVehicle::getAssignedIncidentSeverity() const {
    return assignedIncidentSeverity;
}

std::string EmergencyVehicle::getAssignedIncidentId() const {
    return assignedIncidentId;
}

// Setters
void EmergencyVehicle::setAvailable(bool status) {
    available = status;
    if (status) {
        assignedIncidentSeverity = 0;
        assignedIncidentId = "";
    }
}

void EmergencyVehicle::setPosition(double x, double y) {
    posX = x;
    posY = y;
}

void EmergencyVehicle::setSpeedKmH(double speed) {
    speedKmH = speed;
}

void EmergencyVehicle::setAssignedIncident(const std::string& incidentId, int severity) {
    assignedIncidentId = incidentId;
    assignedIncidentSeverity = severity;
    setAvailable(false);
}