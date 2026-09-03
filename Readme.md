# V2X Multi-Criteria Emergency Dispatch & Real-Time Fleet Telemetry Platform

A discrete-event emergency response engine and real-time fleet telemetry visualization platform. The system models dynamic V2X road hazards, multi-attribute suitability vectors, timed discrete-event vehicle lifecycles, and heterogeneous co-dispatch packages, combining a high-performance **C++17 core engine** with an interactive **Vite + React telemetry command dashboard**.

---

## Architecture Overview

```
emergency-dispatch-platform/
├── CMakeLists.txt              # C++17 CMake build definition
├── README.md                   # System documentation & manual
├── include/
│   ├── EmergencyVehicle.h      # Abstract base class & VehicleState lifecycle enum
│   ├── Ambulance.h             # Triage capability, paramedic match & suitability
│   ├── FireEngine.h            # Water capacity, aerial ladder & suitability
│   ├── Incident.h              # Incident model (ID, type, severity 1-5, coords)
│   ├── RoadNetwork.h           # Graph topology (Intersections & RoadSegments)
│   ├── V2XHub.h                # Live hazard broadcast & clearance
│   ├── RouteOptimizer.h        # Dynamic Dijkstra shortest-time pathfinder
│   ├── DispatchCenter.h        # Fleet orchestration, co-dispatch & discrete loop
│   ├── AnalyticsEngine.h       # KPI metrics & chronological event logging
│   └── WebBridge.h             # Winsock2 HTTP REST telemetry server
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
│   ├── WebBridge.cpp
│   └── main.cpp                # Backend server executable / CLI harness
├── tests/
│   └── test_core.cpp           # Non-interactive unit assertions (7/7 suites)
└── web/
    ├── package.json
    ├── index.html
    ├── src/
    │   ├── App.jsx             # Command center dashboard & live controls
    │   ├── components/
    │   │   ├── MapCanvas.jsx   # 2D Canvas road network & moving units
    │   │   ├── FleetTable.jsx  # Active vehicle status & state timers
    │   │   ├── HazardPanel.jsx # Live V2X hazard toggle & injection
    │   │   ├── IncidentQueue.jsx # Incident log & manual dispatch trigger
    │   │   └── AnalyticsKPI.jsx # Success rate, Mean ETA, Preemptions
    │   └── main.jsx
    └── vite.config.js
```

---

## Mathematical Formulations & Algorithms

### 1. Dynamic Edge Travel Time Function
Every road segment $e = (u, v)$ has distance $L_e$ (km), base speed limit $V_e$ (km/h), and dynamic V2X congestion multiplier $C_e \ge 1.0$:

$$\text{Travel Time (hours)} = \frac{L_e}{V_e} \times C_e$$
$$\text{Travel Time (minutes)} = \frac{L_e}{V_e} \times C_e \times 60.0$$

If $e.\text{isBlocked} = \text{true}$, the cost is treated as $\infty$, completely excluding the segment from Dijkstra graph relaxation.

### 2. Multi-Attribute Suitability Scoring Vectors
Units compute dynamic suitability scores factoring travel time, incident severity, specialized equipment, and mid-route interception:

- **Ambulance**:
  $$\text{Score} = 100 - (\text{ETA}_{\text{mins}} \times 3.0) + \Delta_{\text{triage}} + \Delta_{\text{paramedic}} + \Delta_{\text{intercept}}$$
  - $\Delta_{\text{triage}} = +10$ if $\text{maxTriage} \ge \text{severity}$, else $-40$.
  - $\Delta_{\text{paramedic}} = +35$ if required and present, else $-60$.
  - $\Delta_{\text{intercept}} = +15$ if vehicle is currently `RETURNING_TO_BASE`.

- **Fire Engine**:
  $$\text{Score} = 100 - (\text{ETA}_{\text{mins}} \times 3.0) + \Delta_{\text{water}} + \Delta_{\text{ladder}} + \Delta_{\text{intercept}}$$
  - $\Delta_{\text{water}} = +25$ if $\text{waterCapacity} \ge 3500\text{L}$ on high severity calls, else $-20$.
  - $\Delta_{\text{ladder}} = +15$ if $\text{ladderLength} \ge 30\text{m}$ on high severity calls, else $-10$.
  - $\Delta_{\text{intercept}} = +15$ if vehicle is currently `RETURNING_TO_BASE`.

### 3. Heterogeneous Co-Dispatch Packages
- **Severity 4-5 Fire**: Atomically dispatches $1\times$ `FireEngine` $+ 1\times$ `Ambulance` (medical backup).
- **Severity 4-5 Rescue**: Atomically dispatches $1\times$ `FireEngine` $+ 1\times$ `Ambulance` (Paramedic required).
- **Severity 1-3 Fire**: $1\times$ `FireEngine`.
- **Standard Medical**: $1\times$ `Ambulance` (Paramedic prioritized on high severity).

### 4. Priority Preemption Protocol
When a catastrophic emergency (Severity 5) occurs and no idle units are available:
1. The dispatch engine inspects units currently `EN_ROUTE_INCIDENT` assigned to low-severity calls (Severity 1-2).
2. The low-severity call is immediately preempted and transitioned to `PREEMPTED_QUEUED`.
3. The en-route unit is dynamically reassigned and rerouted to the critical scene.
4. Preemption count is incremented in `AnalyticsEngine`.

### 5. Discrete-Event Vehicle State Machine
Units cycle through timed lifecycle phases:
- `IDLE_STATION` $\to$ `EN_ROUTE_INCIDENT` (traveling along Dijkstra path)
- `EN_ROUTE_INCIDENT` $\to$ `ON_SCENE` (active scene timer: $\text{severity} \times 5.0\text{ min}$)
- `ON_SCENE` $\to$ `TRANSPORTING_HOSPITAL` (Ambulances only: routing to hospital)
- `TRANSPORTING_HOSPITAL` $\to$ `AT_HOSPITAL_TURNOVER` (10.0 min turnover & disinfection)
- `AT_HOSPITAL_TURNOVER` $\to$ `RETURNING_TO_BASE` (returning home; available for interception)
- `RETURNING_TO_BASE` $\to$ `IDLE_STATION` (docked at home depot)

---

## Build & Execution Instructions

### Prerequisites
- GCC / G++ (C++17 support)
- CMake (>= 3.15) and Ninja (or MinGW Make)
- Node.js (>= 18) and NPM

### 1. Build and Run C++ Core Engine

```powershell
# Navigate to platform root
cd C:\Users\Rhyth\.gemini\antigravity\scratch\emergency-dispatch-platform

# Configure and compile with CMake and Ninja
cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build

# Run non-interactive unit tests (7/7 test suites)
.\build\test_core.exe

# Launch backend simulation REST server (port 8080)
.\build\emergency_dispatch_server.exe
```

### 2. Launch Modern Web Dashboard

In a separate terminal:
```powershell
cd C:\Users\Rhyth\.gemini\antigravity\scratch\emergency-dispatch-platform\web

# Install dependencies (first time only)
npm install

# Start development visualizer (port 5173)
npm run dev
```

Open your browser at:
👉 **`http://localhost:5173`**

---

## Telemetry REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/state` | Returns complete city topology, fleet units, active calls, hazards, and KPIs |
| `POST` | `/api/step` | Advances simulation clock by `deltaMinutes` (e.g. `{"deltaMinutes": 1.0}`) |
| `POST` | `/api/play` | Starts background auto-advance loop (1 sec real = 1 min sim) |
| `POST` | `/api/pause` | Pauses auto-advance simulation loop |
| `POST` | `/api/hazard` | Injects V2X hazard (`from`, `to`, `hazardType`, `multiplier`, `isBlocked`, `description`) |
| `POST` | `/api/resolve_hazard` | Clears hazard and restores segment to free-flow (`from`, `to`) |
| `POST` | `/api/incident` | Creates and dispatches incident (`type`, `severity`, `x`, `y`, `description`) |
| `POST` | `/api/reset` | Resets simulation time, fleet positions, and network hazards |
