#include "Incident.h"
#include <iostream>

Incident::Incident(const std::string& id,
                   const std::string& type,
                   double x,
                   double y,
                   int severity)
    : incidentId(id),
      type(type),
      posX(x),
      posY(y),
      severityLevel(severity) {
}

std::string Incident::getId() const {
    return incidentId;
}

std::string Incident::getType() const {
    return type;
}

double Incident::getPosX() const {
    return posX;
}

double Incident::getPosY() const {
    return posY;
}

double Incident::getX() const {
    return posX;
}

double Incident::getY() const {
    return posY;
}

int Incident::getSeverityLevel() const {
    return severityLevel;
}

int Incident::getSeverity() const {
    return severityLevel;
}

void Incident::displayInfo() const {
    std::cout << "--- Incident Information ---\n";
    std::cout << "Incident ID: " << incidentId << "\n";
    std::cout << "Type:        " << type << "\n";
    std::cout << "Location:    (" << posX << ", " << posY << ")\n";
    std::cout << "Severity:    " << severityLevel << "/5\n";
    std::cout << "----------------------------\n";
}
