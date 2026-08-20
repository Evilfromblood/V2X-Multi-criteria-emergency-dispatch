# Multi-Criteria Emergency Dispatch and V2X-Informed Route Evaluator

A modular C++17 simulation platform engineered to optimize emergency service dispatching and real-time route planning. Rather than relying solely on naive Euclidean distance, the engine evaluates multi-dimensional suitability vectors—combining incident severity, specialized equipment capabilities (paramedic certification, triage ratings, water payload, ladder reach), vehicle availability, and dynamic V2X (Vehicle-to-Everything) connected-vehicle hazard telemetry.

---

## Key System Capabilities

* **Polymorphic Fleet Management:** Built on an abstract `EmergencyVehicle` base class with concrete derived implementations (`Ambulance`, `FireEngine`) executing specialized suitability scoring contracts.
* **Graph-Based Road Network & V2X Hub:** Models urban topology as an adjacency list of intersections and weighted road segments. Supports real-time V2X telemetry broadcasts that dynamically inject congestion multipliers or flag emergency road closures.
* **Dynamic Dijkstra Route Optimization:** Computes minimum-time paths across the road network, dynamically calculating traversal costs as:
  $$\text{Travel Time (hours)} = \frac{\text{Distance (km)}}{\text{Speed Limit (km/h)}} \times \text{Congestion Multiplier}$$
  Strictly routes responders around blocked edges and active hazard corridors.
* **Priority Preemption Engine:** Automatically evaluates ongoing low-severity dispatches (Severity 1–2) to preempt and reroute active units when critical emergencies (Severity 5) arrive during fleet saturation.
* **CLI Dashboard & KPI Benchmarking:** Provides an interactive terminal interface offering both a guided scenario walkthrough and a 15-incident automated stress test with end-of-run analytics (Success Rate, Mean ETA, Fleet Travel Distance, Preemption Counts).

---

## Implementation Roadmap & Completion Status

| Phase | Milestone | Status | Key Deliverables |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Vehicle & Incident Hierarchy** | Completed | `EmergencyVehicle` base class, `Ambulance`, `FireEngine`, `Incident` model. |
| **Phase 2** | **Central Dispatch Orchestration** | Completed | `DispatchCenter`, exclusive pointer ownership (`std::unique_ptr`), status tracking. |
| **Phase 3** | **V2X Road Network & Telemetry** | Completed | `RoadNetwork` graph structure, `V2XHub` live hazard injection & resolution. |
| **Phase 4** | **Routing & Priority Preemption** | Completed | `RouteOptimizer` (Dijkstra algorithm), V2X detour logic, critical preemption. |
| **Phase 5** | **CLI Dashboard & Analytics Engine**| Completed | `CLIDashboard`, `AnalyticsEngine` metrics logging, automated stress-test suite. |

---

## Project Structure

```text
Multi-Criteria-Emergency-Dispatch/
├── include/
│   ├── EmergencyVehicle.h    # Abstract base vehicle interface
│   ├── Ambulance.h           # Triage & paramedic specialization
│   ├── FireEngine.h          # Water capacity & ladder reach specialization
│   ├── Incident.h            # Emergency incident entity model
│   ├── RoadNetwork.h         # Graph topology (Intersections & RoadSegments)
│   ├── V2XHub.h              # Dynamic road condition & hazard broadcaster
│   ├── RouteOptimizer.h      # Dijkstra shortest-time pathfinder
│   ├── DispatchCenter.h      # Fleet orchestration & preemption engine
│   ├── AnalyticsEngine.h     # KPI tracking & summary reporter
│   └── CLIDashboard.h        # ANSI-formatted CLI visualizer
└── src/
    ├── EmergencyVehicle.cpp
    ├── Ambulance.cpp
    ├── FireEngine.cpp
    ├── Incident.cpp
    ├── RoadNetwork.cpp
    ├── V2XHub.cpp
    ├── RouteOptimizer.cpp
    ├── DispatchCenter.cpp
    ├── AnalyticsEngine.cpp
    ├── CLIDashboard.cpp
    └── main.cpp              # Application entry point & simulation modes
