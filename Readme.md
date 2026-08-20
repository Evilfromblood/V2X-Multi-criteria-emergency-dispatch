# Multi-Criteria Emergency Dispatch and V2X-Informed Route Evaluator

A C++ OOP simulation that models real-time emergency responder allocation and route planning. The system evaluates multi-criteria suitability scores using incident severity, proximity, specialized equipment capability, and simulated V2X (Vehicle-to-Everything) live traffic and road hazard telemetry.

---

## Project Roadmap & Implementation Phases

* **Phase 1: Emergency Vehicle & Incident Foundation (Completed)**
  * Established the abstract base class `EmergencyVehicle` defining shared spatial attributes, speed parameters, and pure virtual contracts (`calculateSuitability`, `displayInfo`).
  * Implemented polymorphic specialized derived units: `Ambulance` (triage levels, paramedic availability) and `FireEngine` (water capacity, ladder reach).
  * Implemented the `Incident` class capturing coordinates, severity indices (1–5), and emergency categories.

* **Phase 2: Multi-Criteria Dispatch Engine & Scoring Heuristics**
  * Design a centralized `DispatchCenter` to manage fleet queues and incoming incident streams.
  * Implement mathematical scoring algorithms combining Euclidean/Manhattan distance, estimated time of arrival (ETA), incident-to-capability matching, and vehicle availability status.

* **Phase 3: V2X Road Network & Live Hazard Simulation**
  * Model road networks using graph representations (nodes as intersections, weighted edges as road segments).
  * Integrate simulated V2X connected-vehicle broadcasts to represent dynamic road conditions (traffic congestion, road blocks, weather hazards).

* **Phase 4: Dynamic Route Optimization & Rescheduling**
  * Integrate pathfinding algorithms (e.g., Dijkstra's / A* search) adjusted dynamically with live V2X edge weights.
  * Implement preemption and rerouting logic for high-severity critical incidents.

* **Phase 5: CLI Interface, Benchmarking & Output Analytics**
  * Build an interactive CLI dashboard displaying fleet statuses, real-time dispatch decisions, and optimal route paths.
  * Implement performance benchmarking and automated unit testing across edge cases.
