#include <iostream>
#include "Ambulance.h"

int main() {
    Ambulance ambulance("AMB-101", 2.5, 4.0, 70.0, 5, true);

    EmergencyVehicle* responder = &ambulance;

    std::cout << "Vehicle type: "
              << responder->getVehicleType() << '\n';

    responder->displayInfo();

    return 0;
}