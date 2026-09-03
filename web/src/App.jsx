import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Play, Pause, FastForward, RotateCcw, Activity, Shield, AlertTriangle, 
  Siren, Wifi, WifiOff, Cpu, Crosshair, BarChart3, ListFilter, AlertOctagon,
  Volume2, VolumeX, Keyboard, Download, CloudSun, Compass
} from 'lucide-react';

import MapCanvas from './components/MapCanvas.jsx';
import FleetTable from './components/FleetTable.jsx';
import HazardPanel from './components/HazardPanel.jsx';
import IncidentQueue from './components/IncidentQueue.jsx';
import AnalyticsKPI from './components/AnalyticsKPI.jsx';
import ToastContainer from './components/ToastContainer.jsx';
import VehicleDetailDrawer from './components/VehicleDetailDrawer.jsx';
import EnvironmentalWidget from './components/EnvironmentalWidget.jsx';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal.jsx';
import { soundEffects } from './utils/audio.js';

const MemoizedMapCanvas = React.memo(MapCanvas);
const MemoizedFleetTable = React.memo(FleetTable);
const MemoizedHazardPanel = React.memo(HazardPanel);
const MemoizedIncidentQueue = React.memo(IncidentQueue);
const MemoizedAnalyticsKPI = React.memo(AnalyticsKPI);
const MemoizedToastContainer = React.memo(ToastContainer);

export default function App() {
  const [telemetry, setTelemetry] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1.0); // 1.0x, 2.0x, 5.0x
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('fleet'); // 'fleet' | 'incidents' | 'hazards' | 'weather'
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [clickedCoords, setClickedCoords] = useState(null);
  const [focusedVehicleId, setFocusedVehicleId] = useState(null);
  const [inspectedVehicle, setInspectedVehicle] = useState(null);
  const [toasts, setToasts] = useState([]);

  const lastClockRef = useRef(-1);
  const lastEventCountRef = useRef(0);
  const isMountedRef = useRef(true);

  // Sync sound manager
  useEffect(() => {
    soundEffects.setEnabled(soundEnabled);
  }, [soundEnabled]);

  const addToast = useCallback((type, title, message) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 5);
    const clockStr = lastClockRef.current >= 0 ? `T+${lastClockRef.current.toFixed(1)}m` : 'LIVE';
    setToasts(prev => [...prev.slice(-4), { id, type, title, message, timestamp: clockStr }]);

    setTimeout(() => {
      if (isMountedRef.current) {
        setToasts(prev => prev.filter(t => t.id !== id));
      }
    }, 6000);
  }, []);

  const handleDismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Polling loop
  useEffect(() => {
    isMountedRef.current = true;
    let isFetching = false;

    const fetchTelemetry = async () => {
      if (isFetching) return;
      isFetching = true;

      try {
        const res = await fetch('/api/state');
        if (res.ok) {
          const data = await res.json();
          if (isMountedRef.current) {
            setIsConnected(true);

            if (lastClockRef.current >= 0 && data.clockMinutes > lastClockRef.current) {
              setIsPlaying(true);
            }
            lastClockRef.current = data.clockMinutes;
            setTelemetry(data);

            // Keep inspected vehicle state updated
            if (inspectedVehicle) {
              const updated = (data.fleet || []).find(v => v.id === inspectedVehicle.id);
              if (updated) setInspectedVehicle(updated);
            }

            // Tactical Audio & Toast Notifications on events
            if (data.analytics && data.analytics.events) {
              const events = data.analytics.events;
              if (lastEventCountRef.current > 0 && events.length > lastEventCountRef.current) {
                const newEvents = events.slice(lastEventCountRef.current);
                newEvents.forEach(evt => {
                  const msg = evt.message || evt.details || '';
                  if (evt.type === 'PREEMPTION') {
                    soundEffects.playPreemptionAlert();
                    addToast('PREEMPTION', 'PRIORITY PREEMPTION ALERT', msg);
                  } else if (evt.type === 'V2X_REROUTE') {
                    soundEffects.playHazardTone();
                    addToast('REROUTE', 'DYNAMIC V2X DETOUR', msg);
                  } else if (evt.type === 'INCIDENT_CREATED') {
                    soundEffects.playDispatchChirp();
                    if (msg.includes('Severity 5')) {
                      addToast('DISPATCH', 'CRITICAL LEVEL 5 INCIDENT', msg);
                    }
                  } else if (evt.type === 'HAZARD_INJECTED') {
                    soundEffects.playHazardTone();
                  }
                });
              }
              lastEventCountRef.current = events.length;
            }
          }
        } else {
          if (isMountedRef.current) setIsConnected(false);
        }
      } catch (err) {
        if (isMountedRef.current) setIsConnected(false);
      } finally {
        isFetching = false;
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 600);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [addToast, inspectedVehicle]);

  const handleTogglePlay = useCallback(async () => {
    soundEffects.playClickTick();
    try {
      if (isPlaying) {
        await fetch('/api/pause', { method: 'POST' });
        setIsPlaying(false);
      } else {
        await fetch('/api/play', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interval: 1.0, step: simSpeed })
        });
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Play/pause error', err);
    }
  }, [isPlaying, simSpeed]);

  const handleStep = useCallback(async (deltaMinutes) => {
    soundEffects.playClickTick();
    try {
      await fetch('/api/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deltaMinutes })
      });
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
        lastClockRef.current = data.clockMinutes;
      }
    } catch (err) {
      console.error('Step error', err);
    }
  }, []);

  const handleReset = useCallback(async () => {
    soundEffects.playClickTick();
    try {
      await fetch('/api/reset', { method: 'POST' });
      setFocusedVehicleId(null);
      setInspectedVehicle(null);
      setSelectedSegment(null);
      lastEventCountRef.current = 0;
      setIsPlaying(false);
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
        lastClockRef.current = data.clockMinutes;
        addToast('INFO', 'SIMULATION RESET', 'Simulation clock, fleet positions, and road hazards restored.');
      }
    } catch (err) {
      console.error('Reset error', err);
    }
  }, [addToast]);

  const handleInjectHazard = useCallback(async (hazardData) => {
    soundEffects.playHazardTone();
    try {
      await fetch('/api/hazard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hazardData)
      });
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      }
      addToast(
        hazardData.isBlocked ? 'REROUTE' : 'INFO',
        hazardData.isBlocked ? 'ROADWAY BLOCKED' : 'CONGESTION INJECTED',
        `${hazardData.hazardType} corridor alert: ${hazardData.from} ↔ ${hazardData.to}`
      );
    } catch (err) {
      console.error('Hazard inject error', err);
    }
  }, [addToast]);

  const handleResolveHazard = useCallback(async (from, to) => {
    soundEffects.playClickTick();
    try {
      await fetch('/api/resolve_hazard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to })
      });
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      }
      addToast('RESOLVED', 'ROADWAY RESTORED', `Corridor ${from} ↔ ${to} returned to free-flow.`);
    } catch (err) {
      console.error('Hazard resolve error', err);
    }
  }, [addToast]);

  const handleCreateIncident = useCallback(async (incidentData) => {
    soundEffects.playDispatchChirp();
    try {
      const clampedX = Math.max(0.5, Math.min(24.5, parseFloat(incidentData.x) || 5.0));
      const clampedY = Math.max(0.5, Math.min(24.5, parseFloat(incidentData.y) || 5.0));
      if (clampedX !== incidentData.x || clampedY !== incidentData.y) {
        addToast('INFO', 'COORDINATES SNAPPED', 'Incident coordinates outside operational perimeter; snapped to 25km boundary.');
      }
      const payload = {
        ...incidentData,
        x: clampedX,
        y: clampedY
      };

      await fetch('/api/incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      }
      addToast('DISPATCH', 'EMERGENCY CAD DISPATCHED', `${incidentData.description} (Severity ${incidentData.severity})`);
    } catch (err) {
      console.error('Incident create error', err);
    }
  }, [addToast]);

  const handleMapClick = useCallback((x, y) => {
    soundEffects.playClickTick();
    const clampedX = Math.max(0.5, Math.min(24.5, x));
    const clampedY = Math.max(0.5, Math.min(24.5, y));
    if (clampedX !== x || clampedY !== y) {
      addToast('INFO', 'COORDINATES SNAPPED', 'Coordinates out of operational perimeter; snapped to 25km boundary.');
    }
    setClickedCoords({ x: parseFloat(clampedX.toFixed(1)), y: parseFloat(clampedY.toFixed(1)) });
    setActiveTab('incidents');
  }, [addToast]);

  const handleSelectSegment = useCallback((segment) => {
    soundEffects.playClickTick();
    setSelectedSegment(segment);
    setActiveTab('hazards');
  }, []);

  const handleToggleSegment = useCallback(async (segment) => {
    if (!segment) return;
    try {
      if (segment.isBlocked) {
        soundEffects.playClickTick();
        await fetch('/api/resolve_hazard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: segment.from, to: segment.to })
        });
        addToast('RESOLVED', 'ROADWAY CLEARED', `Corridor ${segment.from} ↔ ${segment.to} reopened.`);
      } else {
        soundEffects.playHazardTone();
        await fetch('/api/hazard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: segment.from,
            to: segment.to,
            hazardType: 'ROAD_CLOSURE',
            multiplier: 1.0,
            isBlocked: true,
            description: `Corridor Closure on ${segment.from} ↔ ${segment.to}`
          })
        });
        addToast('REROUTE', 'ROADWAY BLOCKED', `Corridor ${segment.from} ↔ ${segment.to} closed by dispatcher.`);
      }
      setSelectedSegment(segment);
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      }
    } catch (err) {
      console.error('Toggle segment error', err);
    }
  }, [addToast]);

  const handleFocusVehicle = useCallback((vehicleId) => {
    soundEffects.playClickTick();
    setFocusedVehicleId(prev => prev === vehicleId ? null : vehicleId);
  }, []);

  const handleSelectVehicle = useCallback((vehicle) => {
    soundEffects.playClickTick();
    setInspectedVehicle(vehicle);
  }, []);

  const handleRecallVehicle = useCallback(async (vehicleId) => {
    soundEffects.playClickTick();
    try {
      await fetch('/api/recall_vehicle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId })
      });
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      }
      addToast('INFO', 'VEHICLE RECALLED', `Unit ${vehicleId} ordered to RTB station.`);
    } catch (err) {
      console.error('Recall vehicle error', err);
    }
  }, [addToast]);

  const handleResolveIncident = useCallback(async (incidentId) => {
    soundEffects.playClickTick();
    try {
      await fetch('/api/resolve_incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidentId })
      });
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      }
      addToast('RESOLVED', 'INCIDENT CLEARED', `Call ${incidentId} marked resolved.`);
    } catch (err) {
      console.error('Resolve incident error', err);
    }
  }, [addToast]);

  const handleApplyWeather = useCallback(async (condition, multiplier) => {
    soundEffects.playHazardTone();
    try {
      await fetch('/api/weather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ condition, multiplier })
      });
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      }
      addToast('INFO', 'WEATHER ADVISORY', `City environmental conditions set to ${condition} (x${multiplier} delay)`);
    } catch (err) {
      console.error('Weather error', err);
    }
  }, [addToast]);

  // Export Mission Telemetry Report
  const handleExportReport = useCallback(() => {
    soundEffects.playClickTick();
    if (!telemetry) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(telemetry, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `v2x_mission_telemetry_T${telemetry.clockMinutes.toFixed(0)}m.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    addToast('INFO', 'REPORT EXPORTED', 'Complete mission telemetry snapshot downloaded.');
  }, [telemetry, addToast]);

  // Global Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if inside an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === '1') {
        handleStep(1.0);
      } else if (e.key === '5') {
        handleStep(5.0);
      } else if (e.key === 'r' || e.key === 'R') {
        handleReset();
      } else if (e.key === 'Escape') {
        setFocusedVehicleId(null);
        setInspectedVehicle(null);
        setIsShortcutsOpen(false);
      } else if (e.key === 'm' || e.key === 'M') {
        setSoundEnabled(prev => !prev);
      } else if (e.key === '?') {
        setIsShortcutsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlay, handleStep, handleReset]);

  const clockMinutes = telemetry?.clockMinutes ?? 0.0;
  const fleet = useMemo(() => telemetry?.fleet ?? [], [telemetry?.fleet]);
  const incidents = useMemo(() => telemetry?.incidents ?? [], [telemetry?.incidents]);
  const hazards = useMemo(() => telemetry?.hazards ?? [], [telemetry?.hazards]);
  const analytics = useMemo(() => telemetry?.analytics ?? {}, [telemetry?.analytics]);
  const segments = useMemo(() => telemetry?.network?.segments ?? [], [telemetry?.network?.segments]);

  const activeIncidentsCount = useMemo(() => incidents.filter(i => i.status !== 'RESOLVED').length, [incidents]);
  const availableFleetCount = useMemo(() => fleet.filter(v => v.state === 'IDLE_STATION' || v.state === 'RETURNING_TO_BASE').length, [fleet]);
  const blockedHazardsCount = useMemo(() => hazards.filter(h => h.isBlocked).length, [hazards]);

  return (
    <div className="w-full h-full flex flex-col" style={{ minHeight: '100vh', background: 'var(--bg-deep)' }}>
      {/* Toast Notification Container */}
      <MemoizedToastContainer toasts={toasts} onDismiss={handleDismissToast} />

      {/* Keyboard Shortcuts Reference Modal */}
      <KeyboardShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />

      {/* Mission-Control Header Bar */}
      <header className="command-header">
        <div className="max-w-7xl flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-3">
            <div 
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.3) 0%, rgba(14, 165, 233, 0.15) 100%)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
                boxShadow: '0 0 20px -3px rgba(37, 99, 235, 0.4)'
              }}
            >
              <Cpu className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight text-slate-100 uppercase" style={{ letterSpacing: '0.04em' }}>
                  V2X Operations Command
                </h1>
                <span className="badge font-mono" style={{ background: 'rgba(30, 58, 138, 0.35)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.35)' }}>
                  25KM METRO CORE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Multi-Criteria Autonomous Dispatch & Real-Time Telemetry Center
              </p>
            </div>
          </div>

          {/* Center Quick Stats Ticker */}
          <div className="flex items-center gap-4 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/60 font-mono text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-slate-400">FLEET:</span>
              <span className="font-bold text-slate-200">{availableFleetCount}/{fleet.length} AVAIL</span>
            </div>
            <div className="w-[1px] h-3 bg-slate-800"></div>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${activeIncidentsCount > 0 ? 'bg-rose-500 animate-ping' : 'bg-slate-600'}`}></span>
              <span className="text-slate-400">CALLS:</span>
              <span className="font-bold text-rose-400">{activeIncidentsCount}</span>
            </div>
            <div className="w-[1px] h-3 bg-slate-800"></div>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${blockedHazardsCount > 0 ? 'bg-amber-400' : 'bg-slate-600'}`}></span>
              <span className="text-slate-400">HAZARDS:</span>
              <span className="font-bold text-amber-400">{hazards.length}</span>
            </div>
          </div>

          {/* Right Simulation Clock, Speed, Sound & Playback Controls */}
          <div className="flex items-center gap-2.5">
            {/* Discrete Sim Clock */}
            <div 
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800"
              style={{ background: 'rgba(9, 13, 22, 0.95)' }}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">CLOCK</span>
              <span className="font-mono text-sm font-bold text-sky-400">
                T+{(clockMinutes).toFixed(1)}m
              </span>
            </div>

            {/* Playback Buttons */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
              <button
                onClick={handleTogglePlay}
                className={`btn-tactical ${
                  isPlaying 
                    ? 'btn-tactical-danger' 
                    : 'btn-tactical-primary'
                }`}
                title={isPlaying ? 'Pause simulation loop (Space)' : 'Play continuous simulation (Space)'}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
              </button>

              <button
                onClick={() => handleStep(1.0)}
                className="btn-tactical text-xs"
                title="Advance simulation by 1.0 minute (1)"
              >
                <span>+1.0m</span>
              </button>

              <button
                onClick={() => handleStep(5.0)}
                className="btn-tactical text-xs"
                title="Advance simulation by 5.0 minutes (5)"
              >
                <FastForward className="w-3 h-3" />
                <span>+5.0m</span>
              </button>

              <button
                onClick={handleReset}
                className="btn-tactical text-xs hover:text-rose-400"
                title="Reset simulation and fleet (R)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Utilities: Sound, Shortcuts, Export */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSoundEnabled(s => !s)}
                className={`btn-tactical p-1.5 text-xs ${soundEnabled ? 'text-sky-400' : 'text-slate-500'}`}
                title={soundEnabled ? 'Audio alerts ON (M to mute)' : 'Audio alerts MUTED (M to enable)'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setIsShortcutsOpen(true)}
                className="btn-tactical p-1.5 text-xs text-slate-400 hover:text-slate-200"
                title="Keyboard Shortcuts (?)"
              >
                <Keyboard className="w-4 h-4" />
              </button>

              <button
                onClick={handleExportReport}
                className="btn-tactical p-1.5 text-xs text-slate-400 hover:text-emerald-300"
                title="Download Mission Telemetry JSON Report"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>

            {/* Connection Status Pill */}
            <div 
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs font-mono"
              style={{
                background: isConnected ? 'rgba(6, 78, 59, 0.25)' : 'rgba(127, 29, 29, 0.25)',
                borderColor: isConnected ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
                color: isConnected ? '#34d399' : '#f87171'
              }}
            >
              <span 
                className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 status-dot-pulse' : 'bg-rose-500'}`}
              ></span>
              <span className="text-[11px] font-bold">
                {isConnected ? 'LIVE 8080' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Mission Operations Dashboard */}
      <main className="flex-1 max-w-7xl w-full p-4 flex flex-col gap-4">
        {/* Top KPI Metrics Row */}
        <MemoizedAnalyticsKPI analytics={analytics} clockMinutes={clockMinutes} fleet={fleet} />

        {/* Tactical Workspace: Map Canvas + Operations Deck */}
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(600px, 1.35fr) minmax(420px, 1fr)',
            gap: '16px',
            alignItems: 'start'
          }}
          className="tactical-workspace-grid"
        >
          {/* Left Column: Interactive Map Canvas */}
          <div className="flex flex-col gap-2">
            <MemoizedMapCanvas
              telemetry={telemetry}
              onMapClick={handleMapClick}
              onSelectSegment={handleSelectSegment}
              onToggleSegment={handleToggleSegment}
              selectedSegment={selectedSegment}
              focusedVehicleId={focusedVehicleId}
              onFocusVehicle={handleFocusVehicle}
            />

            {/* Canvas Sub-Bar */}
            <div className="flex items-center justify-between px-3 py-2 glass-panel text-xs text-slate-400 font-mono">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Crosshair className="w-3.5 h-3.5 text-sky-400" />
                  MAP MODE: 25KM METROPOLITAN
                </span>
                {focusedVehicleId && (
                  <span className="text-sky-400 font-bold bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800/60">
                    FOCUS: {focusedVehicleId}
                    <button 
                      onClick={() => setFocusedVehicleId(null)}
                      className="ml-1 text-slate-400 hover:text-white"
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400">
                WHEEL TO ZOOM / SHIFT+DRAG TO PAN / CLICK TO DISPATCH OR BLOCK
              </div>
            </div>
          </div>

          {/* Right Column: Operations Deck Tabs */}
          <div className="flex flex-col gap-2">
            {/* Floating Vehicle Detail Drawer if active */}
            {inspectedVehicle && (
              <VehicleDetailDrawer
                vehicle={inspectedVehicle}
                onClose={() => setInspectedVehicle(null)}
                onRecall={handleRecallVehicle}
                isFocused={focusedVehicleId === inspectedVehicle.id}
                onToggleFocus={handleFocusVehicle}
              />
            )}

            {/* Tab Selector Bar */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/90 border border-slate-800">
              <button
                onClick={() => setActiveTab('fleet')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'fleet'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                style={{ border: 'none', cursor: 'pointer' }}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>FLEET</span>
                <span className="text-[10px] font-mono px-1 rounded bg-black/30">
                  {fleet.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('incidents')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'incidents'
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                style={{ border: 'none', cursor: 'pointer' }}
              >
                <Siren className="w-3.5 h-3.5" />
                <span>CAD</span>
                <span className="text-[10px] font-mono px-1 rounded bg-black/30">
                  {activeIncidentsCount}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('hazards')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'hazards'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                style={{ border: 'none', cursor: 'pointer' }}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>V2X</span>
                <span className="text-[10px] font-mono px-1 rounded bg-black/30">
                  {hazards.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('weather')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'weather'
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                style={{ border: 'none', cursor: 'pointer' }}
              >
                <CloudSun className="w-3.5 h-3.5" />
                <span>METEO</span>
              </button>
            </div>

            {/* Active Deck Content */}
            <div className="w-full">
              {activeTab === 'fleet' && (
                <MemoizedFleetTable 
                  fleet={fleet} 
                  focusedVehicleId={focusedVehicleId}
                  onFocusVehicle={handleFocusVehicle}
                  onSelectVehicle={handleSelectVehicle}
                  onRecallVehicle={handleRecallVehicle}
                />
              )}

              {activeTab === 'incidents' && (
                <MemoizedIncidentQueue
                  incidents={incidents}
                  onCreateIncident={handleCreateIncident}
                  onResolveIncident={handleResolveIncident}
                  defaultCoords={clickedCoords}
                />
              )}

              {activeTab === 'hazards' && (
                <MemoizedHazardPanel
                  hazards={hazards}
                  segments={segments}
                  nodes={telemetry?.network?.nodes || []}
                  onInjectHazard={handleInjectHazard}
                  onResolveHazard={handleResolveHazard}
                  selectedSegment={selectedSegment}
                />
              )}

              {activeTab === 'weather' && (
                <EnvironmentalWidget onApplyWeather={handleApplyWeather} />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
