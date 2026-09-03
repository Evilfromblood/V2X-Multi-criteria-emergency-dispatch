import React, { useState, useMemo } from 'react';
import { Shield, Flame, Activity, Clock, Navigation, Crosshair, Search, RotateCcw, Fuel, Droplets, MapPin } from 'lucide-react';

const STATE_CONFIG = {
  IDLE_STATION: { label: 'AVAILABLE', cls: 'badge-idle', dot: '#34d399' },
  EN_ROUTE_INCIDENT: { label: 'EN ROUTE', cls: 'badge-enroute', dot: '#38bdf8', spin: true },
  ON_SCENE: { label: 'ON SCENE', cls: 'badge-onscene', dot: '#f87171', pulse: true },
  TRANSPORTING_HOSPITAL: { label: 'TRANSPORTING', cls: 'badge-transport', dot: '#c084fc' },
  AT_HOSPITAL_TURNOVER: { label: 'TURNOVER', cls: 'badge-turnover', dot: '#fbbf24' },
  RETURNING_TO_BASE: { label: 'RETURNING', cls: 'badge-returning', dot: '#2dd4bf' },
  REFUELING_DEPOT: { label: 'REFUELING', cls: 'badge-refueling', dot: '#60a5fa' },
  REPLENISHING_WATER: { label: 'WATER REFILL', cls: 'badge-water', dot: '#22d3ee' },
  SEEKING_RESUPPLY: { label: 'RESUPPLY ROUTE', cls: 'badge-resupply', dot: '#fbbf24', spin: true },
  STAGED_AT_PERIMETER: { label: 'STAGED PERIMETER', cls: 'badge-resupply', dot: '#fbbf24', pulse: true },
  DIVERTED_CLINIC: { label: 'DIVERTING', cls: 'badge-diversion', dot: '#fca5a5' },
};

function getFuelBarClass(pct) {
  if (pct > 50) return 'resource-bar-fuel-high';
  if (pct > 20) return 'resource-bar-fuel-mid';
  return 'resource-bar-fuel-low';
}

function FleetTableComponent({ fleet = [], focusedVehicleId, onFocusVehicle, onSelectVehicle, onRecallVehicle }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredFleet = useMemo(() => {
    const list = Array.isArray(fleet) ? fleet : [];
    return list.filter((v) => {
      if (!v) return false;
      const vId = (v.id || '').toLowerCase();
      const vBase = (v.homeBaseNode || '').toLowerCase();
      const vType = (v.type || '').toLowerCase();
      const query = (searchQuery || '').toLowerCase();
      const matchSearch = vId.includes(query) || vBase.includes(query) || vType.includes(query);
      if (!matchSearch) return false;
      if (statusFilter === 'AVAILABLE') return v.state === 'IDLE_STATION' || v.state === 'RETURNING_TO_BASE';
      if (statusFilter === 'ACTIVE') return v.state !== 'IDLE_STATION';
      return true;
    });
  }, [fleet, searchQuery, statusFilter]);

  return (
    <div className="flex flex-col gap-2">
      {/* Search & Filter */}
      <div className="flex items-center gap-2">
        <div style={{ flex: 1, position: 'relative' }}>
          <Search style={{ width: 12, height: 12, position: 'absolute', left: 8, top: 8, color: '#64748b' }} />
          <input
            type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search unit..."
            style={{
              width: '100%', paddingLeft: 26, paddingRight: 8, paddingTop: 5, paddingBottom: 5,
              borderRadius: 6, background: 'rgba(9, 13, 22, 0.9)', border: '1px solid rgba(51, 65, 85, 0.45)',
              color: '#e2e8f0', fontSize: 11, fontFamily: 'var(--font-mono)', outline: 'none'
            }}
          />
        </div>
        <div className="flex items-center gap-1" style={{ background: 'rgba(15, 23, 42, 0.6)', padding: 2, borderRadius: 5 }}>
          {['ALL', 'AVAILABLE', 'ACTIVE'].map((f) => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className="btn-tactical" style={{
                padding: '2px 6px', fontSize: 9,
                background: statusFilter === f ? 'rgba(37, 99, 235, 0.3)' : 'transparent',
                color: statusFilter === f ? '#60a5fa' : '#64748b',
                border: statusFilter === f ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent'
              }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Vehicle Cards */}
      <div className="flex flex-col gap-1.5" style={{ maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
        {filteredFleet.map((v) => {
          const isAmbulance = v.type === 'AMBULANCE';
          const isFireEngine = v.type === 'FIRE_ENGINE';
          const isFocused = focusedVehicleId === v.id;
          const stateConf = STATE_CONFIG[v.state] || { label: v.state || 'UNKNOWN', cls: 'badge', dot: '#64748b' };
          const fuelPct = v.fuelPercentage ?? 100;
          const waterPct = v.waterPercentage ?? (isFireEngine ? 100 : null);
          const timer = v.stateTimerMinutes;

          return (
            <div key={v.id} className={`vehicle-card ${isFocused ? 'focused' : ''}`}
              onClick={() => onSelectVehicle && onSelectVehicle(v)}>
              {/* Row 1: ID, Type Icon, State Badge, Actions */}
              <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                <div className="flex items-center gap-2">
                  {isAmbulance
                    ? <Shield style={{ width: 14, height: 14, color: '#22d3ee' }} />
                    : <Flame style={{ width: 14, height: 14, color: '#f97316' }} />
                  }
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>
                    {v.id}
                  </span>
                  <span className={`badge ${stateConf.cls}`}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: stateConf.dot, display: 'inline-block' }}
                      className={stateConf.pulse ? 'blink-critical' : (stateConf.spin ? 'spin-slow' : '')} />
                    {stateConf.label}
                    {(v.state === 'ON_SCENE' || v.state === 'AT_HOSPITAL_TURNOVER' || v.state === 'REFUELING_DEPOT' || v.state === 'REPLENISHING_WATER') && timer != null && (
                      <span style={{ marginLeft: 2 }}>({Number(timer).toFixed(1)}m)</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {v.state !== 'IDLE_STATION' && onRecallVehicle && (
                    <button onClick={() => onRecallVehicle(v.id)} className="btn-tactical"
                      style={{ padding: '2px 4px', color: '#fca5a5' }} title="Recall to base">
                      <RotateCcw style={{ width: 11, height: 11 }} />
                    </button>
                  )}
                  <button onClick={() => { onFocusVehicle(v.id); if (onSelectVehicle) onSelectVehicle(v); }}
                    className="btn-tactical" style={{
                      padding: '2px 6px', fontSize: 9,
                      background: isFocused ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                      color: isFocused ? '#60a5fa' : '#64748b',
                      border: isFocused ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent'
                    }} title="Focus camera">
                    <Crosshair style={{ width: 10, height: 10 }} />
                    <span>{isFocused ? 'LOCKED' : 'FOCUS'}</span>
                  </button>
                </div>
              </div>

              {/* Row 2: Location + Odometer */}
              <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                <div className="flex items-center gap-1" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8' }}>
                  <MapPin style={{ width: 10, height: 10, color: '#64748b' }} />
                  {v.currentNodeId || v.homeBaseNode || 'N1_HQ'}
                  {v.destinationNodeId && v.state !== 'IDLE_STATION' && (
                    <span style={{ color: '#64748b' }}> → {v.destinationNodeId}</span>
                  )}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#64748b' }}>
                  {(v.totalDistanceTraveledKm ?? 0).toFixed(1)} km
                </span>
              </div>

              {/* Row 3: Resource Gauges */}
              <div className="flex flex-col gap-1">
                {/* Fuel Bar */}
                <div className="flex items-center gap-2">
                  <Fuel style={{ width: 10, height: 10, color: fuelPct <= 20 ? '#ef4444' : (fuelPct <= 50 ? '#fbbf24' : '#34d399'), flexShrink: 0 }} />
                  <div className="resource-bar-track" style={{ flex: 1 }}>
                    <div className={`resource-bar-fill ${getFuelBarClass(fuelPct)}`}
                      style={{ width: `${Math.max(0, Math.min(100, fuelPct))}%` }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: fuelPct <= 20 ? '#ef4444' : '#94a3b8', minWidth: 30, textAlign: 'right' }}>
                    {fuelPct.toFixed(0)}%
                  </span>
                </div>

                {/* Water Bar (Fire Engines only) */}
                {isFireEngine && waterPct != null && (
                  <div className="flex items-center gap-2">
                    <Droplets style={{ width: 10, height: 10, color: waterPct <= 20 ? '#f97316' : '#22d3ee', flexShrink: 0 }} />
                    <div className="resource-bar-track" style={{ flex: 1 }}>
                      <div className={`resource-bar-fill ${waterPct <= 20 ? 'resource-bar-water-low' : 'resource-bar-water'}`}
                        style={{ width: `${Math.max(0, Math.min(100, waterPct))}%` }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: waterPct <= 20 ? '#f97316' : '#94a3b8', minWidth: 30, textAlign: 'right' }}>
                      {waterPct.toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default React.memo(FleetTableComponent);
