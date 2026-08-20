#ifndef INCIDENT_H
#define INCIDENT_H

#include <string>

class Incident {
private:
    std::string incidentId;
    std::string type; // e.g., "Medical", "Fire", "Rescue"
    double posX;
    double posY;
    int severityLevel; // 1 (Minor) to 5 (Critical)

public:
    Incident(const std::string& id,
             const std::string& type,
             double x,
             double y,
             int severity);

    std::string getId() const;
    std::string getType() const;
    double getPosX() const;
    double getPosY() const;
    int getSeverityLevel() const;

    void displayInfo() const;
};

#endif // INCIDENT_H
