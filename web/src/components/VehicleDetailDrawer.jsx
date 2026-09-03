import React from 'react';
import { 
  X, Crosshair, Navigation, Gauge, Shield, Droplet, 
  Flame, Stethoscope, BatteryCharging, CheckCircle2, RotateCcw, AlertTriangle
} from 'lucide-react';

export default function VehicleDetailDrawer({ 
  vehicle, 
  onClose, 
  onRecall, 
  isFocused, 
  onToggleFocus 
}) {
  if (!vehicle) return null;

  const isAmbulance = vehicle.type === 'AMBULANCE';
  const stateColor = 
    vehicle.state === 'ON_SCENE' ? '#f87171' :
    vehicle.state === 'EN_ROUTE_INCIDENT' ? '#38bdf8' :
    vehicle.state === 'TRANSPORTING_HOSPITAL' ? '#c084fc' :
    vehicle.state === 'RETURNING_TO_BASE' ? '#2dd4bf' : '#34d399';

  return (
    <div 
      className="glass-panel p-4 flex flex-col gap-3.5 transition-all"
      style={{
        border: '1px solid rgba(56, 189, 248, 0.4)',
        background: 'rgba(11, 17, 32, 0.95)',
        boxShadow: '0 15px 35px -10px rgba(0, 0, 0, 0.75)'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2.5">
          <div 
            className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs"
            style={{
              background: isAmbulance ? 'rgba(6, 182, 212, 0.2)' : 'rgba(234, 88, 12, 0.2)',
              color: isAmbulance ? '#22d3ee' : '#fb923c',
              border: `1px solid ${isAmbulance ? 'rgba(6, 182, 212, 0.4)' : 'rgba(234, 88, 12, 0.4)'}`
            }}
          >
            {isAmbulance ? <Stethoscope className="w-4 h-4" /> : <Flame className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-extrabold text-sm text-slate-100">{vehicle.id}</span>
              <span 
                className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold"
                style={{
                  background: `${stateColor}15`,
                  color: stateColor,
                  border: `1px solid ${stateColor}40`
                }}
              >
                {vehicle.state}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Home Base: {vehicle.homeBaseNode || 'N1_HQ'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onToggleFocus(vehicle.id)}
            className={`btn-tactical text-xs px-2 py-1 ${isFocused ? 'bg-sky-500/30 text-sky-300 border-sky-400' : ''}`}
            title="Lock camera focus on unit"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>{isFocused ? 'LOCKED' : 'FOCUS'}</span>
          </button>
          <button
            onClick={onClose}
            className="btn-tactical text-xs p-1 hover:text-rose-400"
            style={{ border: 'none', background: 'transparent' }}
          >
            <X className="w-4 h-4 text-slate-400 hover:text-white" />
          </button>
        </div>
      </div>

      {/* Real-time Telemetry Readout */}
      <div className="grid grid-cols-3 gap-2 text-xs font-mono">
        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex flex-col">
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Gauge className="w-3 h-3 text-sky-400" /> SPEED
          </span>
          <span className="text-sm font-bold text-slate-100 mt-0.5">
            {vehicle.speedKmH ? `${vehicle.speedKmH.toFixed(0)} km/h` : '60 km/h'}
          </span>
        </div>

        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex flex-col">
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Navigation className="w-3 h-3 text-emerald-400" /> ODOMETER
          </span>
          <span className="text-sm font-bold text-slate-100 mt-0.5">
            {(vehicle.totalDistanceTraveledKm ?? 0).toFixed(1)} km
          </span>
        </div>

        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex flex-col">
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <BatteryCharging className="w-3 h-3 text-amber-400" /> COORDS
          </span>
          <span className="text-xs font-bold text-slate-200 mt-1">
            [{Number(vehicle.x).toFixed(1)}, {Number(vehicle.y).toFixed(1)}]
          </span>
        </div>
      </div>

      {/* Equipment & Capabilities Breakdown */}
      <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 flex flex-col gap-1 text-xs">
        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
          Unit Specifications & Inventory
        </span>
        {isAmbulance ? (
          <div className="flex items-center justify-between text-slate-200 mt-1">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span>Triage Capability: <strong>Level {vehicle.maxTriageLevel ?? 5}</strong></span>
            </div>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
              vehicle.hasParamedic ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-400'
            }`}>
              {vehicle.hasParamedic ? 'ALS PARAMEDIC CERT' : 'BLS STANDARD'}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1 mt-1">
            <div className="flex items-center justify-between text-slate-200">
              <span className="flex items-center gap-1.5">
                <Droplet className="w-3.5 h-3.5 text-sky-400" /> Water Tank:
              </span>
              <span className="font-mono font-bold text-sky-300">
                {vehicle.waterCapacityLiters ?? 4500} Liters
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-200">
              <span className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-400" /> Aerial Ladder Reach:
              </span>
              <span className="font-mono font-bold text-orange-300">
                {vehicle.ladderLengthMeters ?? 32} Meters
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Active Waypoint Sequence */}
      {vehicle.activeRoutePath && vehicle.activeRoutePath.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            Active Navigation Waypoints ({vehicle.activeRoutePath.length} Nodes)
          </span>
          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
            {vehicle.activeRoutePath.map((node, i) => (
              <span
                key={i}
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                  i === vehicle.routeIndex 
                    ? 'bg-sky-500/30 text-sky-300 border-sky-400 font-bold' 
                    : i < vehicle.routeIndex 
                      ? 'bg-slate-900 text-slate-500 border-slate-800 line-through' 
                      : 'bg-slate-900 text-slate-300 border-slate-800'
                }`}
              >
                {node}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Quick Action Footer */}
      <div className="flex items-center gap-2 pt-1">
        {vehicle.state !== 'IDLE_STATION' && (
          <button
            onClick={() => onRecall(vehicle.id)}
            className="btn-tactical btn-tactical-danger flex-1 py-1.5 text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RECALL TO BASE</span>
          </button>
        )}
      </div>
    </div>
  );
}
