#include "AnalyticsEngine.h"
#include <iostream>
#include <iomanip>

void AnalyticsEngine::logDispatch(const DispatchRecord& record) {
    records.push_back(record);
}

void AnalyticsEngine::renderAnalyticsSummary() const {
    int successCount = 0;
    double totalETA = 0.0;
    double totalDistance = 0.0;
    int preemptionCount = 0;

    for (const auto& r : records) {
        if (!r.assignedVehicleId.empty() && r.assignedVehicleId != "None") {
            successCount++;
            totalETA += r.travelTimeMinutes;
            totalDistance += r.routeDistanceKm;
        }
        if (r.preempted) {
            preemptionCount++;
        }
    }

    double successRate = totalIncidentsProcessed > 0 ? (static_cast<double>(successCount) / totalIncidentsProcessed) * 100.0 : 0.0;
    double meanETA = successCount > 0 ? totalETA / successCount : 0.0;

    std::cout << "\n===================================================\n";
    std::cout << "               ANALYTICS KPI SUMMARY               \n";
    std::cout << "===================================================\n";
    std::cout << std::left << std::setw(30) << "Total Incidents Processed:" << totalIncidentsProcessed << "\n";
    std::cout << std::left << std::setw(30) << "Dispatch Success Rate:" << std::fixed << std::setprecision(1) << successRate << "%\n";
    std::cout << std::left << std::setw(30) << "Mean ETA:" << std::fixed << std::setprecision(2) << meanETA << " mins\n";
    std::cout << std::left << std::setw(30) << "Total Fleet Distance:" << std::fixed << std::setprecision(2) << totalDistance << " km\n";
    std::cout << std::left << std::setw(30) << "Preemption Count:" << preemptionCount << "\n";
    std::cout << "===================================================\n";
}
