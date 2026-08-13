#include "Ambulance.h"
#include <iostream>

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
    // Incident-based scoring will be added in Phase 2.
    double score = 50.0;

    score += maxTriageLevel * 8.0;

    if (hasParamedic) {
        score += 15.0;
    }

    if (!available) {
        score = 0.0;
    }

    return score;
}

void Ambulance::displayInfo() const {
    std::cout << "\n--- Ambulance Information ---\n";
    std::cout << "ID: " << vehicleId << '\n';
    std::cout << "Location: (" << posX << ", " << posY << ")\n";
    std::cout << "Speed: " << speedKmH << " km/h\n";
    std::cout << "Maximum triage level: " << maxTriageLevel << '\n';
    std::cout << "Paramedic on board: "
              << (hasParamedic ? "Yes" : "No") << '\n';
    std::cout << "Status: "
              << (available ? "Available" : "Busy") << '\n';
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