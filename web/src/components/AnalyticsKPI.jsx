import React, { useState } from 'react';
import { 
  TrendingUp, Clock, AlertOctagon, Route, Gauge, Activity, 
  CheckCircle, ChevronRight, ShieldAlert, Siren, Filter, Zap, ShieldCheck, Fuel, Droplets 
} from 'lucide-react';

export default function AnalyticsKPI({ analytics = {}, clockMinutes = 0, fleet = [] }) {
  const [filterType, setFilterType] = useState('ALL');

  const {
    totalIncidents = 0,
    dispatchedCount = 0,
    resolvedCount = 0,
    preemptionCount = 0,
    rerouteCount = 0,
    starvationEscalationCount = 0,
    greenWavePreemptionCount = 0,
    totalDistanceTraveledKm = 0,
    meanEtaMinutes = 0,
    successRatePercent = 100,
    totalFuelConsumedLiters = 0,
    totalWaterDischargedLiters = 0,
    events = []
  } = (analytics || {});

  // Calculate fleet utilization %
  const safeFleet = Array.isArray(fleet) ? fleet : [];
  const activeUnits = safeFleet.filter(v => v && v.state !== 'IDLE_STATION').length;
  const utilizationPct = safeFleet.length > 0 ? (activeUnits / safeFleet.length) * 100 : 0;

  const getEventBadge = (type) => {
    switch (type) {
      case 'PREEMPTION':
        return <span className="badge badge-transport font-mono text-[9px]">PREEMPTION</span>;
      case 'STARVATION_PREVENTED':
      case 'STARVATION_ESCALATION':
        return <span className="badge font-mono text-[9px]" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }}>STARVATION PREVENTED</span>;
      case 'GREEN_WAVE':
        return <span className="badge font-mono text-[9px]" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)' }}>GREEN WAVE</span>;
      case 'V2X_REROUTE':
        return <span className="badge badge-enroute font-mono text-[9px]">V2X REROUTE</span>;
      case 'DISPATCH':
      case 'INCIDENT_CREATED':
        return <span className="badge badge-onscene font-mono text-[9px]">DISPATCH</span>;
      case 'ARRIVAL':
        return <span className="badge badge-onscene font-mono text-[9px]">ON SCENE</span>;
      case 'INCIDENT_RESOLVED':
        return <span className="badge badge-idle font-mono text-[9px]">RESOLVED</span>;
      case 'HAZARD_INJECTED':
        return <span className="badge badge-turnover font-mono text-[9px]">HAZARD ACTIVE</span>;
      case 'HAZARD_RESOLVED':
        return <span className="badge badge-returning font-mono text-[9px]">HAZARD CLEARED</span>;
      case 'PERIMETER_STAGING':
        return <span className="badge font-mono text-[9px]" style={{ background: 'rgba(245, 158, 11, 0.25)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.5)' }}>PERIMETER STAGING</span>;
      case 'STAGING_RESUMED':
        return <span className="badge font-mono text-[9px]" style={{ background: 'rgba(16, 185, 129, 0.25)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.5)' }}>STAGING RESUMED</span>;
      default:
        return <span className="badge font-mono text-[9px]">{type || 'EVENT'}</span>;
    }
  };

  const safeEvents = Array.isArray(events) ? events : [];
  const filteredEvents = safeEvents.filter(e => {
    if (!e) return false;
    if (filterType === 'ALL') return true;
    if (filterType === 'PREEMPTION') return e.type === 'PREEMPTION';
    if (filterType === 'REROUTE') return e.type === 'V2X_REROUTE';
    if (filterType === 'STAGING') return e.type === 'PERIMETER_STAGING' || e.type === 'STAGING_RESUMED';
    if (filterType === 'DISPATCH') return e.type === 'DISPATCH' || e.type === 'INCIDENT_CREATED';
    if (filterType === 'RESOLVED') return e.type === 'INCIDENT_RESOLVED';
    return true;
  });

  return (
    <div className="flex flex-col gap-3">
      {/* KPI Stat Cards Grid (adapted for sidebar) */}
      <div className="grid grid-cols-2 gap-2">
        {/* 1. Success Rate */}
        <div className="kpi-card">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">RESOLVED CALLS</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400">
            {Number(successRatePercent || 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            {resolvedCount} of {totalIncidents} cleared
          </div>
        </div>

        {/* 2. Mean Response Time (ETA) */}
        <div className="kpi-card">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">MEAN RESPONSE</span>
            <Clock className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl font-bold font-mono text-sky-400">
            {Number(meanEtaMinutes || 0).toFixed(1)} <span className="text-xs font-normal text-slate-400">min</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            Scene arrival average
          </div>
        </div>

        {/* 3. Fleet Utilization */}
        <div className="kpi-card">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">UTILIZATION</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-cyan-400">
            {Number(utilizationPct || 0).toFixed(0)}%
          </div>
          <div className="w-full progress-track mt-1.5">
            <div 
              className="progress-fill" 
              style={{ width: `${utilizationPct}%`, background: '#06b6d4' }}
            />
          </div>
        </div>

        {/* 4. Priority Preemptions */}
        <div className="kpi-card">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">PREEMPTIONS</span>
            <AlertOctagon className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold font-mono text-purple-400">
            {preemptionCount}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            Critical Level 5 overrides
          </div>
        </div>

        {/* 5. V2X Dynamic Reroutes */}
        <div className="kpi-card">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">V2X DETOURS</span>
            <Route className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-400">
            {rerouteCount}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            Real-time hazard escapes
          </div>
        </div>

        {/* 6. Total Fleet Distance */}
        <div className="kpi-card">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">TOTAL MILEAGE</span>
            <Gauge className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-xl font-bold font-mono text-teal-400">
            {Number(totalDistanceTraveledKm || 0).toFixed(1)} <span className="text-xs font-normal text-slate-400">km</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            Cumulative fleet transit
          </div>
        </div>

        {/* 7. Green Wave Preemptions Active */}
        <div className="kpi-card">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">GREEN WAVE</span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400">
            {greenWavePreemptionCount}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            Signal preemption
          </div>
        </div>

        {/* 8. Starvation Escalations Prevented */}
        <div className="kpi-card">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">ANTI-STARVE</span>
            <ShieldCheck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-400">
            {starvationEscalationCount}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            Escalations saved
          </div>
        </div>

        {/* 9. Fuel Consumed */}
        <div className="kpi-card">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">FUEL BURNED</span>
            <Fuel className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-xl font-bold font-mono text-orange-400">
            {Number(totalFuelConsumedLiters || 0).toFixed(1)} <span className="text-xs font-normal text-slate-400">L</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            Total fleet fuel consumed
          </div>
        </div>

        {/* 10. Water Discharged */}
        <div className="kpi-card">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">WATER USED</span>
            <Droplets className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-cyan-400">
            {Number(totalWaterDischargedLiters || 0).toFixed(0)} <span className="text-xs font-normal text-slate-400">L</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            Fire suppression total
          </div>
        </div>
      </div>

      {/* Chronological Event Activity Feed */}
      <div className="glass-panel p-3 flex flex-col gap-2" style={{ marginTop: 8 }}>
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
              TACTICAL EVENT LOG ({events.length})
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-dot-pulse"></span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1">
            <Filter className="w-3 h-3 text-slate-500" />
            {['ALL', 'STAGING', 'PREEMPTION', 'REROUTE', 'DISPATCH', 'RESOLVED'].map((f) => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors ${
                  filterType === f 
                    ? 'bg-blue-600 text-white font-bold' 
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
                style={{ border: 'none', cursor: 'pointer' }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto flex flex-col gap-1 pr-1 font-mono text-xs" style={{ maxHeight: 'calc(100vh - 520px)', minHeight: 80 }}>
          {filteredEvents.length === 0 ? (
            <div className="text-slate-500 text-[11px] py-2 text-center">
              No matching tactical events recorded in current simulation window.
            </div>
          ) : (
            filteredEvents.slice().reverse().map((evt, idx) => {
              const timeVal = evt.timestamp != null ? evt.timestamp : (evt.timestampMinutes ?? 0);
              const msg = evt.message || evt.details || '';
              return (
                <div 
                  key={idx}
                  className="py-1 px-2 rounded hover:bg-slate-800/40 transition-colors flex items-center justify-between text-[11px]"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sky-400 font-bold">
                      T+{Number(timeVal).toFixed(1)}m
                    </span>
                    {getEventBadge(evt.type)}
                    {evt.vehicleId && (
                      <span className="text-slate-300 font-bold">
                        [{evt.vehicleId}]
                      </span>
                    )}
                    <span className="text-slate-300">
                      {msg}
                    </span>
                  </div>
                  {evt.incidentId && (
                    <span className="text-[10px] text-slate-500">
                      {evt.incidentId}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
