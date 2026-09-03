import React, { useState, useEffect } from 'react';
import { Siren, PlusCircle, CheckCircle, Flame, ShieldAlert, HeartPulse, Sparkles, Send, Stethoscope, Compass, Plane } from 'lucide-react';

export default function IncidentQueue({ incidents = [], onCreateIncident, defaultCoords }) {
  const [type, setType] = useState('FIRE');
  const [severity, setSeverity] = useState(5);
  const [coordX, setCoordX] = useState(5.0);
  const [coordY, setCoordY] = useState(5.0);
  const [description, setDescription] = useState('Level 5 Downtown High-Rise Blaze');

  // If user clicked canvas, sync coordinates
  useEffect(() => {
    if (defaultCoords) {
      setCoordX(defaultCoords.x);
      setCoordY(defaultCoords.y);
    }
  }, [defaultCoords]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreateIncident({
      type,
      severity: parseInt(severity),
      x: parseFloat(coordX),
      y: parseFloat(coordY),
      description: description || `${type} Call Level ${severity}`
    });
  };

  const triggerPreset = (scenario) => {
    if (scenario === 'HIGH_RISE_FIRE') {
      onCreateIncident({
        type: 'FIRE',
        severity: 5,
        x: 5.0,
        y: 5.0,
        description: 'Level 5 Downtown High-Rise Fire (Atomic Co-Dispatch Engine + Ambulance)'
      });
    } else if (scenario === 'AIRPORT_HAZMAT') {
      onCreateIncident({
        type: 'RESCUE',
        severity: 5,
        x: 1.0,
        y: 11.0,
        description: 'Airport Fuel Tanker Extrication (West Corridor Crash-Rescue)'
      });
    } else if (scenario === 'LOGISTICS_FIRE') {
      onCreateIncident({
        type: 'FIRE',
        severity: 4,
        x: 5.0,
        y: 17.0,
        description: 'North Logistics Hub Storage Blaze (Heavy Tanker Dispatch)'
      });
    } else if (scenario === 'SUBURBAN_CLINIC_CALL') {
      onCreateIncident({
        type: 'MEDICAL',
        severity: 2,
        x: 18.0,
        y: 8.0,
        description: 'East Suburban District Minor Trauma (Community Clinic BLS)'
      });
    } else if (scenario === 'OFF_GRID_RESCUE') {
      onCreateIncident({
        type: 'RESCUE',
        severity: 3,
        x: 15.0,
        y: 21.0,
        description: 'North Hills Wilderness Trailhead (Off-Grid 20km/h Approach Penalty)'
      });
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <span className="badge badge-turnover">QUEUED</span>;
      case 'DISPATCHED':
        return <span className="badge badge-enroute">DISPATCHED</span>;
      case 'ON_SCENE':
        return <span className="badge badge-onscene">ON SCENE</span>;
      case 'RESOLVED':
        return <span className="badge badge-idle"><CheckCircle className="w-2.5 h-2.5" /> RESOLVED</span>;
      case 'PREEMPTED_QUEUED':
        return <span className="badge badge-transport">PREEMPTED</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const activeIncidents = incidents.filter(i => i.status !== 'RESOLVED');

  return (
    <div className="glass-panel p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
          <Siren className="w-4 h-4 text-rose-400" />
          Emergency CAD Dispatch Console
        </h3>
        <span className="text-[11px] font-mono text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/60">
          {activeIncidents.length} Active Calls
        </span>
      </div>

      {/* Multi-Sector Rapid Algorithm Presets */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-400" />
          Metropolitan Sector Test Scenarios (25km Grid)
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => triggerPreset('HIGH_RISE_FIRE')}
            className="btn-tactical text-left flex flex-col items-start p-2 hover:border-orange-500/50"
            style={{ background: 'rgba(30, 41, 59, 0.6)' }}
          >
            <span className="text-xs font-bold text-orange-400 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" /> Downtown Fire (L5)
            </span>
            <span className="text-[10px] text-slate-400">Co-Dispatch (Engine + Amb)</span>
          </button>

          <button
            onClick={() => triggerPreset('AIRPORT_HAZMAT')}
            className="btn-tactical text-left flex flex-col items-start p-2 hover:border-purple-500/50"
            style={{ background: 'rgba(30, 41, 59, 0.6)' }}
          >
            <span className="text-xs font-bold text-purple-400 flex items-center gap-1">
              <Plane className="w-3.5 h-3.5" /> Airport Crash (L5)
            </span>
            <span className="text-[10px] text-slate-400">West Bypass Crash-Rescue Rig</span>
          </button>

          <button
            onClick={() => triggerPreset('LOGISTICS_FIRE')}
            className="btn-tactical text-left flex flex-col items-start p-2 hover:border-amber-500/50"
            style={{ background: 'rgba(30, 41, 59, 0.6)' }}
          >
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" /> Logistics Fire (L4)
            </span>
            <span className="text-[10px] text-slate-400">North Sector Heavy Tanker</span>
          </button>

          <button
            onClick={() => triggerPreset('SUBURBAN_CLINIC_CALL')}
            className="btn-tactical text-left flex flex-col items-start p-2 hover:border-emerald-500/50"
            style={{ background: 'rgba(30, 41, 59, 0.6)' }}
          >
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
              <Stethoscope className="w-3.5 h-3.5" /> East Clinic (L2)
            </span>
            <span className="text-[10px] text-slate-400">Suburban Clinic BLS Ambulance</span>
          </button>
        </div>

        {/* 1-Click Off-Grid Wilderness Scenario */}
        <button
          onClick={() => triggerPreset('OFF_GRID_RESCUE')}
          className="btn-tactical text-left flex items-center justify-between p-2 mt-0.5 border border-amber-500/30 hover:border-amber-400"
          style={{ background: 'rgba(120, 53, 15, 0.25)' }}
        >
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-amber-400" />
            <div>
              <div className="text-xs font-bold text-amber-300">Off-Grid Wilderness Rescue (L3)</div>
              <div className="text-[10px] text-slate-400">Tests 20 km/h local approach speed penalty added to Dijkstra ETA</div>
            </div>
          </div>
          <span className="text-[10px] font-mono text-amber-400 font-bold px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-800">
            [15km, 21km]
          </span>
        </button>
      </div>

      {/* Manual Incident Creator Form */}
      <form onSubmit={handleSubmit} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-2.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
          Targeted Incident Dispatch (0.5 – 24.5 km)
        </span>

        <div className="grid grid-cols-3 gap-2">
          {/* Type */}
          <div>
            <label className="text-[10px] text-slate-400 font-mono">TYPE</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full mt-1 p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono"
            >
              <option value="FIRE">FIRE</option>
              <option value="MEDICAL">MEDICAL</option>
              <option value="RESCUE">RESCUE</option>
            </select>
          </div>

          {/* Severity */}
          <div>
            <label className="text-[10px] text-slate-400 font-mono">SEVERITY (1-5)</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full mt-1 p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono"
            >
              <option value="1">1 - Minimal</option>
              <option value="2">2 - Minor</option>
              <option value="3">3 - Moderate</option>
              <option value="4">4 - Severe</option>
              <option value="5">5 - Critical (L5)</option>
            </select>
          </div>

          {/* Coords */}
          <div>
            <label className="text-[10px] text-slate-400 font-mono">COORDS (X, Y)</label>
            <div className="flex gap-1 mt-1">
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="24.5"
                value={coordX}
                onChange={(e) => setCoordX(e.target.value)}
                className="w-1/2 p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono"
              />
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="24.5"
                value={coordY}
                onChange={(e) => setCoordY(e.target.value)}
                className="w-1/2 p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-[10px] text-slate-400 font-mono">DESCRIPTION</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full mt-1 p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200"
            placeholder="Emergency call details..."
          />
        </div>

        <button
          type="submit"
          className="btn-tactical btn-tactical-primary w-full py-2 mt-1"
        >
          <Send className="w-3.5 h-3.5" />
          <span>TRANSMIT CAD DISPATCH</span>
        </button>
      </form>

      {/* Active Incidents Queue */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
          Incident Log ({incidents.length} Calls Total)
        </span>

        <div className="overflow-y-auto max-h-48 flex flex-col gap-1.5 pr-1">
          {incidents.map((inc) => (
            <div 
              key={inc.id}
              className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${
                  inc.severity >= 4 ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                }`}>
                  L{inc.severity}
                </span>
                <div>
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    <span>{inc.id}</span>
                    <span className="text-[10px] text-slate-400">({inc.type})</span>
                    {inc.offRoadDistanceKm > 0.1 && (
                      <span className="text-[9px] font-mono text-orange-400 bg-orange-950/60 px-1 rounded border border-orange-800/60">
                        +{Number(inc.offRoadDistanceKm).toFixed(1)}km off-road
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">{inc.description}</div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                {getStatusBadge(inc.status)}
                {inc.assignedVehicleIds && inc.assignedVehicleIds.length > 0 && (
                  <span className="text-[10px] font-mono text-sky-400">
                    Units: {inc.assignedVehicleIds.join(', ')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
