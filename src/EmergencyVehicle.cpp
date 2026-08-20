#include "EmergencyVehicle.h"

EmergencyVehicle::EmergencyVehicle(const std::string& id,
                                   double x,
                                   double y,
                                   double speed)
    : vehicleId(id),
      posX(x),
      posY(y),
      speedKmH(speed),
      available(true) {
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

void EmergencyVehicle::setAvailable(bool status) {
    available = status;
}

void EmergencyVehicle::setPosition(double x, double y) {
    posX = x;
    posY = y;
}

void EmergencyVehicle::setSpeedKmH(double speed) {
    speedKmH = speed;
}