import React, { useState, useEffect } from 'react';
import { Siren, PlusCircle, CheckCircle, Flame, ShieldAlert, HeartPulse, Sparkles, Send, Stethoscope } from 'lucide-react';

export default function IncidentQueue({ incidents = [], onCreateIncident, defaultCoords }) {
  const [type, setType] = useState('FIRE');
  const [severity, setSeverity] = useState(5);
  const [coordX, setCoordX] = useState(8.0);
  const [coordY, setCoordY] = useState(5.0);
  const [description, setDescription] = useState('Level 5 High-Rise Commercial Blaze');

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
        x: 8.0,
        y: 5.0,
        description: 'Level 5 High-Rise Fire (Atomic Co-Dispatch Engine + Ambulance)'
      });
    } else if (scenario === 'HIGHWAY_EXTRICATION') {
      onCreateIncident({
        type: 'RESCUE',
        severity: 5,
        x: 5.0,
        y: 5.0,
        description: 'Multi-Car Pileup Extrication (Requires Paramedic & Preemption)'
      });
    } else if (scenario === 'CARDIAC_ARREST') {
      onCreateIncident({
        type: 'MEDICAL',
        severity: 4,
        x: 11.0,
        y: 2.0,
        description: 'Critical Cardiac Arrest at Harbor Tech Zone'
      });
    } else if (scenario === 'LEVEL_2_MEDICAL') {
      onCreateIncident({
        type: 'MEDICAL',
        severity: 2,
        x: 5.0,
        y: 2.0,
        description: 'Downtown Minor Medical Emergency (Standard BLS Ambulance)'
      });
    } else if (scenario === 'ELECTRICAL_FIRE') {
      onCreateIncident({
        type: 'FIRE',
        severity: 3,
        x: 2.0,
        y: 8.0,
        description: 'Substation Transformer Fire'
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

      {/* 1-Click Test Scenarios Grid */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-400" />
          Rapid Algorithm Test Presets
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => triggerPreset('HIGH_RISE_FIRE')}
            className="btn-tactical text-left flex flex-col items-start p-2 hover:border-orange-500/50"
            style={{ background: 'rgba(30, 41, 59, 0.6)' }}
          >
            <span className="text-xs font-bold text-orange-400 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" /> High-Rise Fire (L5)
            </span>
            <span className="text-[10px] text-slate-400">Atomic Co-Dispatch (Eng + Amb)</span>
          </button>

          <button
            onClick={() => triggerPreset('HIGHWAY_EXTRICATION')}
            className="btn-tactical text-left flex flex-col items-start p-2 hover:border-purple-500/50"
            style={{ background: 'rgba(30, 41, 59, 0.6)' }}
          >
            <span className="text-xs font-bold text-purple-400 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" /> Highway Extrication (L5)
            </span>
            <span className="text-[10px] text-slate-400">Triggers Priority Preemption</span>
          </button>

          <button
            onClick={() => triggerPreset('LEVEL_2_MEDICAL')}
            className="btn-tactical text-left flex flex-col items-start p-2 hover:border-emerald-500/50"
            style={{ background: 'rgba(30, 41, 59, 0.6)' }}
          >
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
              <Stethoscope className="w-3.5 h-3.5" /> Downtown Medical (L2)
            </span>
            <span className="text-[10px] text-slate-400">Standard BLS Ambulance</span>
          </button>

          <button
            onClick={() => triggerPreset('CARDIAC_ARREST')}
            className="btn-tactical text-left flex flex-col items-start p-2 hover:border-cyan-500/50"
            style={{ background: 'rgba(30, 41, 59, 0.6)' }}
          >
            <span className="text-xs font-bold text-cyan-400 flex items-center gap-1">
              <HeartPulse className="w-3.5 h-3.5" /> Cardiac Arrest (L4)
            </span>
            <span className="text-[10px] text-slate-400">Paramedic ALS Priority</span>
          </button>
        </div>
      </div>

      {/* Manual Incident Creator Form */}
      <form onSubmit={handleSubmit} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-2.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
          Targeted Incident Dispatch
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
                min="1"
                max="13"
                value={coordX}
                onChange={(e) => setCoordX(e.target.value)}
                className="w-1/2 p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono"
              />
              <input
                type="number"
                step="0.5"
                min="1"
                max="13"
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
