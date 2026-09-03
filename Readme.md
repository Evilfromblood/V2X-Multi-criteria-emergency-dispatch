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
* **Automated Unit Test Suite & CMake Integration:** Includes standalone non-interactive test assertions verifying shortest-path routing, V2X road closure detours, and vehicle suitability heuristics.

---

## Implementation Roadmap & Completion Status

| Phase | Milestone | Status | Key Deliverables |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Vehicle & Incident Hierarchy** | Completed | `EmergencyVehicle` base class, `Ambulance`, `FireEngine`, `Incident` model. |
| **Phase 2** | **Central Dispatch Orchestration** | Completed | `DispatchCenter`, exclusive pointer ownership (`std::unique_ptr`), status tracking. |
| **Phase 3** | **V2X Road Network & Telemetry** | Completed | `RoadNetwork` graph structure, `V2XHub` live hazard injection & resolution. |
| **Phase 4** | **Routing & Priority Preemption** | Completed | `RouteOptimizer` (Dijkstra algorithm), V2X detour logic, critical preemption. |
| **Phase 5** | **CLI Dashboard & Analytics Engine**| Completed | `CLIDashboard`, `AnalyticsEngine` metrics logging, automated stress-test suite. |
| **Polish**  | **CMake & Automated Verification**  | Completed | `CMakeLists.txt`, `tests/test_routing.cpp` unit test runner, CTest support. |

---

## Project Structure

```text
Multi-Criteria-Emergency-Dispatch/
├── CMakeLists.txt            # Root CMake build configuration (C++17, strict warnings)
├── Readme.md                 # Project documentation and evaluation guide
├── build.ps1                 # Automated build script for PowerShell
├── build.bat                 # Automated build script for Windows Command Prompt
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
├── src/
│   ├── EmergencyVehicle.cpp
│   ├── Ambulance.cpp
│   ├── FireEngine.cpp
│   ├── Incident.cpp
│   ├── RoadNetwork.cpp
│   ├── V2XHub.cpp
│   ├── RouteOptimizer.cpp
│   ├── DispatchCenter.cpp
│   ├── AnalyticsEngine.cpp
│   ├── CLIDashboard.cpp
│   └── main.cpp              # Application entry point & simulation modes
└── tests/
    └── test_routing.cpp      # Standalone automated unit test suite
```

---

## Quick Start & Evaluation Guide (For Evaluator / Professor)

To compile and execute this project from scratch in any standard terminal:

### 1. CMake Build (Recommended)

Configure and compile both targets (`dispatch_simulation` and `run_tests`):

```powershell
# Configure build directory with MinGW Makefiles (or Ninja)
cmake -B build -G "MinGW Makefiles"

# Build both test runner and simulation
cmake --build build

# Execute the automated unit test suite
.\build\run_tests.exe

# Execute the main simulation
.\build\dispatch_simulation.exe
```

Alternatively, run tests via CTest:
```powershell
ctest --test-dir build --output-on-failure
```

### 2. Direct Compiler Invocations (Fallback)

**Build and Run Unit Tests:**
```powershell
g++ -std=c++17 -Wall -Wextra -Wpedantic -Iinclude tests/test_routing.cpp src/Ambulance.cpp src/AnalyticsEngine.cpp src/CLIDashboard.cpp src/DispatchCenter.cpp src/EmergencyVehicle.cpp src/FireEngine.cpp src/Incident.cpp src/RoadNetwork.cpp src/RouteOptimizer.cpp src/V2XHub.cpp -o run_tests.exe
.\run_tests.exe
```

**Build and Run Simulation:**
```powershell
g++ -std=c++17 -Wall -Wextra -Wpedantic -Iinclude src/main.cpp src/Ambulance.cpp src/AnalyticsEngine.cpp src/CLIDashboard.cpp src/DispatchCenter.cpp src/EmergencyVehicle.cpp src/FireEngine.cpp src/Incident.cpp src/RoadNetwork.cpp src/RouteOptimizer.cpp src/V2XHub.cpp -o dispatch_simulation.exe
.\dispatch_simulation.exe
```

---

## Automated Unit Test Coverage (`tests/test_routing.cpp`)

The test suite validates three core algorithmic areas using standard `<cassert>`:

1. **`testDijkstraFreeFlow()`**:
   - Asserts shortest path selection on known graph topologies (`A -> B -> C`).
   - Verifies exact cumulative distance (20.0 km) and travel time (20.0 minutes).
   - Tests self-loop pathing (`A -> A`) and disconnected node rejection.

2. **`testV2XDetourAndBlockage()`**:
   - Injects a live road blockage via `V2XHub` on segment `B -> C`.
   - Confirms `RouteOptimizer` dynamically recalculates an alternate detour path (`A -> D -> C`).
   - Tests dual-segment blockage to ensure route isolation (`reachable == false`).
   - Verifies that clearing the hazard with `resolveHazard` immediately restores the primary path.

3. **`testSuitabilityScoring()`**:
   - Validates positive suitability scoring for matching emergency types (`Ambulance` $\to$ Medical).
   - Validates that incompatible incident types strictly evaluate to `0.0`.
   - Confirms that unavailable vehicles (`available == false`) or unreachable destinations (`travelTime < 0`) return `0.0`.
   - Validates `FireEngine` suitability for Fire emergencies and `0.0` rejection for pure Medical emergencies.

---

## Interactive Simulation Modes

Upon launching `dispatch_simulation.exe`, choose the desired mode at the prompt:

* **Mode 1 (Scenario Walkthrough):** Step-by-step dispatch evaluation showing V2X hazard rerouting, candidate suitability breakdowns, and preemption handling.
* **Mode 2 (Automated Benchmark):** High-throughput stress test processing 15 randomized incidents under dynamic weather/traffic conditions with a final KPI summary.
