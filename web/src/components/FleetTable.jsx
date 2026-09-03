import React from 'react';
import { Shield, Flame, Activity, Clock, Navigation, MapPin, Crosshair } from 'lucide-react';

export default function FleetTable({ fleet = [], focusedVehicleId, onFocusVehicle }) {
  const getStateBadge = (state, timer) => {
    const displayTimer = (timer != null) ? Number(timer).toFixed(1) : '0.0';

    switch (state) {
      case 'IDLE_STATION':
        return (
          <span className="badge badge-idle">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            AVAILABLE
          </span>
        );
      case 'EN_ROUTE_INCIDENT':
        return (
          <span className="badge badge-enroute">
            <Navigation className="w-3 h-3 text-sky-400 animate-spin" style={{ animationDuration: '4s' }} />
            EN ROUTE
          </span>
        );
      case 'ON_SCENE':
        return (
          <span className="badge badge-onscene">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
            ON SCENE ({displayTimer}m)
          </span>
        );
      case 'TRANSPORTING_HOSPITAL':
        return (
          <span className="badge badge-transport">
            <Activity className="w-3 h-3 text-purple-400" />
            TRANSPORTING
          </span>
        );
      case 'AT_HOSPITAL_TURNOVER':
        return (
          <span className="badge badge-turnover">
            <Clock className="w-3 h-3 text-amber-400" />
            TURNOVER ({displayTimer}m)
          </span>
        );
      case 'RETURNING_TO_BASE':
        return (
          <span className="badge badge-returning">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
            RETURNING (INTERCEPTABLE)
          </span>
        );
      default:
        return (
          <span className="badge text-slate-400 bg-slate-800">
            {state || 'UNKNOWN'}
          </span>
        );
    }
  };

  const getProgressVisual = (vehicle) => {
    const timer = vehicle.stateTimerMinutes ?? 0;
    if (vehicle.state === 'ON_SCENE' || vehicle.state === 'AT_HOSPITAL_TURNOVER') {
      const maxTimer = 15.0;
      const pct = Math.min(100, Math.max(5, (1.0 - (timer / maxTimer)) * 100));
      return (
        <div className="flex flex-col gap-1 w-20">
          <div className="progress-track">
            <div 
              className="progress-fill"
              style={{
                width: `${pct}%`,
                background: vehicle.state === 'ON_SCENE' ? '#ef4444' : '#f59e0b'
              }}
            />
          </div>
          <span className="text-[9px] font-mono text-slate-400">{timer.toFixed(1)}m left</span>
        </div>
      );
    } else if (vehicle.state === 'EN_ROUTE_INCIDENT' || vehicle.state === 'TRANSPORTING_HOSPITAL') {
      return (
        <div className="flex flex-col gap-1 w-20">
          <div className="progress-track">
            <div 
              className="progress-fill"
              style={{
                width: '65%',
                background: '#38bdf8'
              }}
            />
          </div>
          <span className="text-[9px] font-mono text-sky-400">In Transit</span>
        </div>
      );
    }
    return <span className="text-[10px] font-mono text-slate-500">—</span>;
  };

  return (
    <div className="glass-panel p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
          <Activity className="w-4 h-4 text-sky-400" />
          Active Fleet Telemetry ({fleet.length} Units)
        </h3>
        <span className="text-[11px] font-mono text-slate-400">
          Discrete V2X State Engine
        </span>
      </div>

      <div className="overflow-x-auto" style={{ maxHeight: '480px' }}>
        <table className="w-full text-left text-xs" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-mono text-[10px] uppercase">
              <th className="pb-2">Unit ID</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Progress</th>
              <th className="pb-2">Current Node</th>
              <th className="pb-2">Assigned Call</th>
              <th className="pb-2">Specs</th>
              <th className="pb-2 text-right">Odo</th>
              <th className="pb-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850">
            {fleet.map((v) => {
              const isAmbulance = v.type === 'AMBULANCE';
              const isFocused = focusedVehicleId === v.id;
              const odo = (v.totalDistanceTraveledKm ?? v.odometerKm ?? 0);

              return (
                <tr 
                  key={v.id} 
                  className={`hover:bg-slate-800/40 transition-colors ${
                    isFocused ? 'bg-sky-950/40' : ''
                  }`}
                >
                  {/* Unit ID & Type */}
                  <td className="py-2.5 font-bold font-mono text-slate-100 flex items-center gap-1.5">
                    {isAmbulance ? (
                      <Shield className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                    ) : (
                      <Flame className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                    )}
                    <span>{v.id}</span>
                  </td>

                  {/* Status Badge */}
                  <td className="py-2.5">
                    {getStateBadge(v.state, v.stateTimerMinutes)}
                  </td>

                  {/* Progress Visual */}
                  <td className="py-2.5">
                    {getProgressVisual(v)}
                  </td>

                  {/* Current Position / Node */}
                  <td className="py-2.5 font-mono text-slate-300">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      <span>{v.currentNodeId || 'Transit'}</span>
                    </div>
                  </td>

                  {/* Assigned Incident */}
                  <td className="py-2.5 font-mono">
                    {v.assignedIncidentId ? (
                      <span className="text-rose-400 font-bold bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800/60">
                        {v.assignedIncidentId}
                      </span>
                    ) : (
                      <span className="text-slate-500">Unassigned</span>
                    )}
                  </td>

                  {/* Capabilities / Specs */}
                  <td className="py-2.5 font-mono text-[10px] text-slate-400">
                    {isAmbulance ? (
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                        {v.hasParamedic ? 'ALS (Paramedic)' : 'BLS (EMT)'}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-orange-300 border border-slate-700">
                        {v.waterCapacityLiters || 4000}L · {v.aerialLadderMeters || 30}m
                      </span>
                    )}
                  </td>

                  {/* Odometer */}
                  <td className="py-2.5 font-mono text-right text-slate-300">
                    {Number(odo).toFixed(1)}km
                  </td>

                  {/* Quick Focus Button */}
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => onFocusVehicle && onFocusVehicle(v.id)}
                      className={`btn-tactical text-[10px] px-2 py-1 ${
                        isFocused ? 'btn-tactical-primary' : ''
                      }`}
                      title="Focus this vehicle on tactical map"
                    >
                      <Crosshair className="w-3 h-3" />
                      <span>{isFocused ? 'LOCKED' : 'FOCUS'}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
