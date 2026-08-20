#include "FireEngine.h"
#include "Incident.h"
#include <iostream>
#include <cmath>
#include <algorithm>

FireEngine::FireEngine(const std::string& id,
                       double x,
                       double y,
                       double speed,
                       double waterCapacity,
                       double ladderLength)
    : EmergencyVehicle(id, x, y, speed),
      waterCapacityLiters(waterCapacity),
      ladderLengthMeters(ladderLength) {
}

double FireEngine::calculateSuitability(const Incident& incident) const {
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
    if (incident.getType() == "Fire") {
        score += 50.0;
    } else if (incident.getType() == "Rescue") {
        score += 30.0;
    } else {
        score += 5.0;
    }

    // Capacity bonuses
    score += (waterCapacityLiters / 500.0);
    score += (ladderLengthMeters / 5.0);

    // High severity fire bonus
    if (incident.getType() == "Fire" && incident.getSeverityLevel() >= 4) {
        if (waterCapacityLiters >= 3000.0) {
            score += 20.0;
        }
    }

    return std::max(0.0, score);
}

void FireEngine::displayInfo() const {
    std::cout << "\n[FireEngine Info]\n";
    std::cout << "  ID:                  " << vehicleId << '\n';
    std::cout << "  Location:            (" << posX << ", " << posY << ")\n";
    std::cout << "  Speed:               " << speedKmH << " km/h\n";
    std::cout << "  Water Capacity:      " << waterCapacityLiters << " Liters\n";
    std::cout << "  Ladder Length:       " << ladderLengthMeters << " Meters\n";
    std::cout << "  Status:              " << (available ? "Available" : "Busy") << '\n';
}

std::string FireEngine::getVehicleType() const {
    return "FireEngine";
}

double FireEngine::getWaterCapacityLiters() const {
    return waterCapacityLiters;
}

double FireEngine::getLadderLengthMeters() const {
    return ladderLengthMeters;
}
