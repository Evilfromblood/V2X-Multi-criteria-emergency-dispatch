#include "Ambulance.h"
#include "Incident.h"
#include <iostream>
#include <cmath>
#include <algorithm>

Ambulance::Ambulance(const std::string& id,
                     double x,
                     double y,
                     double speed,
                     int triageLevel,
                     bool paramedicAvailable)
    : EmergencyVehicle(id, x, y, speed),
      maxTriageLevel(triageLevel),
      hasParamedic(paramedicAvailable) {
}

double Ambulance::calculateSuitability(const Incident& incident) const {
    if (!available) {
        return 0.0;
    }

    // Distance calculation
    double dx = incident.getPosX() - posX;
    double dy = incident.getPosY() - posY;
    double distanceKm = std::sqrt(dx * dx + dy * dy);

    // Estimated travel time in minutes
    double travelTimeMin = (distanceKm / speedKmH) * 60.0;

    double score = 100.0 - (travelTimeMin * 1.5);

    // Incident type match weighting
    if (incident.getType() == "Medical") {
        score += 40.0;
    } else if (incident.getType() == "Rescue") {
        score += 20.0;
    } else {
        score += 5.0;
    }

    // Triage capability comparison
    if (maxTriageLevel >= incident.getSeverityLevel()) {
        score += 15.0;
    } else {
        score -= 25.0;
    }

    // Paramedic bonus
    if (hasParamedic) {
        score += 15.0;
    }

    return std::max(0.0, score);
}

void Ambulance::displayInfo() const {
    std::cout << "\n[Ambulance Info]\n";
    std::cout << "  ID:                  " << vehicleId << '\n';
    std::cout << "  Location:            (" << posX << ", " << posY << ")\n";
    std::cout << "  Speed:               " << speedKmH << " km/h\n";
    std::cout << "  Max Triage Level:    " << maxTriageLevel << '\n';
    std::cout << "  Paramedic on Board:  " << (hasParamedic ? "Yes" : "No") << '\n';
    std::cout << "  Status:              " << (available ? "Available" : "Busy") << '\n';
}

std::string Ambulance::getVehicleType() const {
    return "Ambulance";
}

int Ambulance::getMaxTriageLevel() const {
    return maxTriageLevel;
}

bool Ambulance::hasParamedicOnBoard() const {
    return hasParamedic;
}