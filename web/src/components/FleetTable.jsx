import React, { useState, useMemo } from 'react';
import { Shield, Flame, Activity, Clock, Navigation, MapPin, Crosshair, Search, RotateCcw } from 'lucide-react';

export default function FleetTable({ 
  fleet = [], 
  focusedVehicleId, 
  onFocusVehicle, 
  onSelectVehicle, 
  onRecallVehicle 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'AVAILABLE' | 'ACTIVE'

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
            RETURNING
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

  const filteredFleet = useMemo(() => {
    return fleet.filter((v) => {
      const matchSearch = v.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (v.homeBaseNode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          v.type.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;
      if (statusFilter === 'AVAILABLE') return v.state === 'IDLE_STATION' || v.state === 'RETURNING_TO_BASE';
      if (statusFilter === 'ACTIVE') return v.state !== 'IDLE_STATION';
      return true;
    });
  }, [fleet, searchQuery, statusFilter]);

  return (
    <div className="glass-panel p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
          <Activity className="w-4 h-4 text-sky-400" />
          Active Fleet Telemetry Deck
        </h3>
        <span className="text-[11px] font-mono text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/60">
          {fleet.length} Units Registered
        </span>
      </div>

      {/* Search & Status Filter Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search unit ID, station, type..."
            className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800">
          {['ALL', 'AVAILABLE', 'ACTIVE'].map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                statusFilter === f 
                  ? 'bg-blue-600 text-white' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              style={{ border: 'none', cursor: 'pointer' }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Fleet Table */}
      <div className="overflow-x-auto">
        <table className="tactical-table w-full text-left">
          <thead>
            <tr>
              <th>UNIT</th>
              <th>TYPE</th>
              <th>STATUS</th>
              <th>BASE / NODE</th>
              <th>ODOMETER</th>
              <th className="text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredFleet.map((v) => {
              const isAmbulance = v.type === 'AMBULANCE';
              const isFocused = focusedVehicleId === v.id;

              return (
                <tr
                  key={v.id}
                  className={`transition-colors cursor-pointer ${isFocused ? 'bg-sky-950/40' : 'hover:bg-slate-900/50'}`}
                  onClick={() => onSelectVehicle && onSelectVehicle(v)}
                >
                  {/* Unit ID */}
                  <td className="font-mono font-bold text-slate-100">
                    <div className="flex items-center gap-1.5">
                      {isAmbulance ? (
                        <Shield className="w-3.5 h-3.5 text-cyan-400" />
                      ) : (
                        <Flame className="w-3.5 h-3.5 text-orange-500" />
                      )}
                      <span>{v.id}</span>
                    </div>
                  </td>

                  {/* Type */}
                  <td className="font-mono text-xs text-slate-400">
                    {isAmbulance ? (v.hasParamedic ? 'ALS PARAMEDIC' : 'BLS AMB') : 'FIRE PUMPER'}
                  </td>

                  {/* Status Badge */}
                  <td>{getStateBadge(v.state, v.stateTimerMinutes)}</td>

                  {/* Location */}
                  <td className="font-mono text-xs text-slate-300">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      <span>{v.currentNodeId || v.homeBaseNode || 'N1_HQ'}</span>
                    </div>
                  </td>

                  {/* Odometer */}
                  <td className="font-mono text-xs text-slate-400">
                    {(v.totalDistanceTraveledKm ?? 0).toFixed(1)} km
                  </td>

                  {/* Actions */}
                  <td className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {v.state !== 'IDLE_STATION' && onRecallVehicle && (
                        <button
                          onClick={() => onRecallVehicle(v.id)}
                          className="btn-tactical text-[10px] px-1.5 py-1 text-rose-400 hover:bg-rose-950/50"
                          title="Recall unit to base"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          onFocusVehicle(v.id);
                          if (onSelectVehicle) onSelectVehicle(v);
                        }}
                        className={`btn-tactical text-[10px] px-2 py-1 ${
                          isFocused ? 'bg-sky-500/20 text-sky-300 border-sky-400 font-bold' : ''
                        }`}
                        title="Lock camera focus on unit"
                      >
                        <Crosshair className="w-3 h-3" />
                        <span>{isFocused ? 'LOCKED' : 'FOCUS'}</span>
                      </button>
                    </div>
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
