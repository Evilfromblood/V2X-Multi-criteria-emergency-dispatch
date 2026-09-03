# V2X Multi-Criteria Emergency Dispatch & Fleet Telemetry Platform

The emergency dispatch platform has been successfully started and verified.

## Active Services

| Service | Port | Status | URL |
|---|---|---|---|
| **C++ Core Engine (REST Server)** | `8080` | `RUNNING` | [http://127.0.0.1:8080/api/state](http://127.0.0.1:8080/api/state) |
| **Vite + React Telemetry UI** | `5173` | `RUNNING` | [http://localhost:5173](http://localhost:5173) |

---

## Verification Results

1. **C++ Core Unit Tests**:
   - Ran `.\build\test_core.exe` &mdash; 7/7 test suites passed (Road network, Dijkstra shortest-time pathfinder & V2X rerouting, suitability scoring, co-dispatch, priority preemption, vehicle lifecycle, JSON telemetry).
2. **Telemetry API Verification**:
   - Queried `GET /api/state` directly and through the Vite reverse proxy; confirmed real-time JSON payload generation with node topology, road segments, vehicle states, and KPIs.
3. **Browser Interface & Live Telemetry**:
   - Automated browser verification at `http://localhost:5173`.
   - Verified 16-node graph visualization on dynamic 2D canvas.
   - Verified active fleet tracking across all 7 emergency units (`AMB-101` through `ENG-203`).
   - Tested discrete-event simulation controls (`+1m`, `+5m`, `Reset`, and `Play/Pause`).
   - Zero console errors or warnings.

---

## Live System Previews

![Platform Overview](C:/Users/Rhyth/.gemini/antigravity-ide/brain/ee8f0001-76e1-447a-9d88-295a91033305/initial_page_load_1788417230366.png)

![Live Simulation Execution](C:/Users/Rhyth/.gemini/antigravity-ide/brain/ee8f0001-76e1-447a-9d88-295a91033305/live_telemetry_running_1788417313184.png)
