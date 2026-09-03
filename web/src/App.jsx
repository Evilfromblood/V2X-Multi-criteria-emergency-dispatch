import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Play, Pause, FastForward, RotateCcw, Activity, AlertTriangle, 
  Siren, Cpu, Crosshair, BarChart3, Volume2, VolumeX, 
  Keyboard, Download, PanelRightClose, PanelRight,
  SkipBack, SkipForward, Clock, Fuel, Droplets, Radio
} from 'lucide-react';

import MapCanvas from './components/MapCanvas.jsx';
import FleetTable from './components/FleetTable.jsx';
import HazardPanel from './components/HazardPanel.jsx';
import IncidentQueue from './components/IncidentQueue.jsx';
import AnalyticsKPI from './components/AnalyticsKPI.jsx';
import ToastContainer from './components/ToastContainer.jsx';
import VehicleDetailDrawer from './components/VehicleDetailDrawer.jsx';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { soundEffects } from './utils/audio.js';

const MemoizedMapCanvas = React.memo(MapCanvas);
const MemoizedFleetTable = React.memo(FleetTable);
const MemoizedHazardPanel = React.memo(HazardPanel);
const MemoizedIncidentQueue = React.memo(IncidentQueue);
const MemoizedAnalyticsKPI = React.memo(AnalyticsKPI);

export default function App() {
  const [telemetry, setTelemetry] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sseActive, setSseActive] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1.0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('fleet');
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [clickedCoords, setClickedCoords] = useState(null);
  const [focusedVehicleId, setFocusedVehicleId] = useState(null);
  const [inspectedVehicle, setInspectedVehicle] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [replayMode, setReplayMode] = useState(false);
  const [replayPosition, setReplayPosition] = useState(0);
  const [replaySpeed, setReplaySpeed] = useState(1);

  const lastClockRef = useRef(-1);
  const lastEventCountRef = useRef(0);
  const isMountedRef = useRef(true);
  const replayBufferRef = useRef([]);
  const replayPlayingRef = useRef(false);
  const replayTimerRef = useRef(null);

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
    }, 5000);
  }, []);

  const handleDismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Process new telemetry events for toasts and audio
  const processEvents = useCallback((data) => {
    if (data.analytics && data.analytics.events) {
      const events = data.analytics.events;
      if (lastEventCountRef.current > 0 && events.length > lastEventCountRef.current) {
        const newEvents = events.slice(lastEventCountRef.current);
        newEvents.forEach(evt => {
          const msg = evt.message || evt.details || '';
          if (evt.type === 'PREEMPTION') {
            soundEffects.playPreemptionAlert();
            addToast('PREEMPTION', 'PRIORITY PREEMPTION', msg);
          } else if (evt.type === 'V2X_REROUTE') {
            soundEffects.playHazardTone();
            addToast('REROUTE', 'V2X DETOUR', msg);
          } else if (evt.type === 'INCIDENT_CREATED') {
            soundEffects.playDispatchChirp();
            if (msg.includes('Severity 5') || msg.includes('Severity 4')) {
              addToast('DISPATCH', 'CRITICAL INCIDENT', msg);
            }
          } else if (evt.type === 'HAZARD_INJECTED') {
            soundEffects.playHazardTone();
          } else if (evt.type === 'RESUPPLY_ROUTING' || evt.type === 'RESUPPLY_BACKUP') {
            addToast('RESUPPLY', 'RESOURCE RESUPPLY', msg);
          } else if (evt.type === 'REFUELING' || evt.type === 'WATER_REFILL') {
            addToast('RESUPPLY', 'DEPOT RESUPPLY', msg);
          } else if (evt.type === 'HOSPITAL_DIVERSION') {
            soundEffects.playPreemptionAlert();
            addToast('DIVERSION', 'HOSPITAL DIVERSION', msg);
          } else if (evt.type === 'GREEN_WAVE') {
            addToast('GREEN_WAVE', 'V2X GREEN WAVE', msg);
          } else if (evt.type === 'STARVATION_PREVENTED' || evt.type === 'STARVATION_ESCALATION') {
            addToast('REROUTE', 'STARVATION PREVENTED', msg);
          } else if (evt.type === 'PERIMETER_STAGING') {
            soundEffects.playHazardTone();
            addToast('REROUTE', 'PERIMETER STAGING', msg || 'Incident corridor isolated: Staging at perimeter checkpoint.');
          } else if (evt.type === 'STAGING_RESUMED') {
            soundEffects.playDispatchChirp();
            addToast('DISPATCH', 'CORRIDOR REOPENED', msg || 'Corridor reopened: Staged rescue units advancing to wilderness scene!');
          }
        });
      }
      lastEventCountRef.current = events.length;
    }
  }, [addToast]);

  // Apply incoming telemetry data
  const applyTelemetry = useCallback((data) => {
    if (!isMountedRef.current) return;
    setIsConnected(true);

    if (lastClockRef.current >= 0 && data.clockMinutes > lastClockRef.current) {
      setIsPlaying(true);
    }
    lastClockRef.current = data.clockMinutes;
    setTelemetry(data);

    // Record to replay buffer (max 500 frames)
    replayBufferRef.current.push({ ...data, _recordedAt: Date.now() });
    if (replayBufferRef.current.length > 500) {
      replayBufferRef.current.shift();
    }

    if (inspectedVehicle) {
      const updated = (data.fleet || []).find(v => v.id === inspectedVehicle.id);
      if (updated) setInspectedVehicle(updated);
    }

    processEvents(data);
  }, [inspectedVehicle, processEvents]);

  // SSE with REST fallback
  useEffect(() => {
    isMountedRef.current = true;
    let eventSource = null;
    let pollInterval = null;
    let sseAttempted = false;

    const startPolling = () => {
      if (pollInterval) return;
      let isFetching = false;
      const fetchTelemetry = async () => {
        if (isFetching) return;
        isFetching = true;
        try {
          const res = await fetch('/api/state');
          if (res.ok) {
            const data = await res.json();
            applyTelemetry(data);
          } else {
            if (isMountedRef.current) setIsConnected(false);
          }
        } catch {
          if (isMountedRef.current) setIsConnected(false);
        } finally {
          isFetching = false;
        }
      };
      fetchTelemetry();
      pollInterval = setInterval(fetchTelemetry, 800);
    };

    // Try SSE first, fallback to polling
    try {
      eventSource = new EventSource('/api/stream');
      const sseTimeout = setTimeout(() => {
        if (!sseAttempted) {
          eventSource.close();
          setSseActive(false);
          startPolling();
        }
      }, 3000);

      eventSource.onmessage = (event) => {
        sseAttempted = true;
        clearTimeout(sseTimeout);
        setSseActive(true);
        try {
          const data = JSON.parse(event.data);
          applyTelemetry(data);
        } catch (e) { /* ignore parse errors */ }
      };

      eventSource.onerror = () => {
        if (!sseAttempted) {
          clearTimeout(sseTimeout);
          eventSource.close();
          setSseActive(false);
          startPolling();
        }
      };
    } catch {
      startPolling();
    }

    return () => {
      isMountedRef.current = false;
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [applyTelemetry]);

  // Replay playback
  useEffect(() => {
    if (!replayMode || !replayPlayingRef.current) return;
    const buffer = replayBufferRef.current;
    if (buffer.length === 0) return;

    replayTimerRef.current = setInterval(() => {
      setReplayPosition(prev => {
        const next = prev + 1;
        if (next >= buffer.length) {
          replayPlayingRef.current = false;
          return prev;
        }
        setTelemetry(buffer[next]);
        return next;
      });
    }, 1000 / replaySpeed);

    return () => clearInterval(replayTimerRef.current);
  }, [replayMode, replaySpeed]);

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
        applyTelemetry(data);
      }
    } catch (err) {
      console.error('Step error', err);
    }
  }, [applyTelemetry]);

  const handleReset = useCallback(async () => {
    soundEffects.playClickTick();
    try {
      await fetch('/api/reset', { method: 'POST' });
      setFocusedVehicleId(null);
      setInspectedVehicle(null);
      setSelectedSegment(null);
      lastEventCountRef.current = 0;
      setIsPlaying(false);
      replayBufferRef.current = [];
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        applyTelemetry(data);
        addToast('INFO', 'SIMULATION RESET', 'Fleet, incidents, and hazards restored to initial state.');
      }
    } catch (err) {
      console.error('Reset error', err);
    }
  }, [addToast, applyTelemetry]);

  const handleInjectHazard = useCallback(async (hazardData) => {
    soundEffects.playHazardTone();
    try {
      await fetch('/api/hazard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hazardData)
      });
      const res = await fetch('/api/state');
      if (res.ok) applyTelemetry(await res.json());
      addToast(
        hazardData.isBlocked ? 'REROUTE' : 'INFO',
        hazardData.isBlocked ? 'ROADWAY BLOCKED' : 'CONGESTION INJECTED',
        `${hazardData.hazardType} corridor alert: ${hazardData.from} ↔ ${hazardData.to}`
      );
    } catch (err) { console.error('Hazard inject error', err); }
  }, [addToast, applyTelemetry]);

  const handleResolveHazard = useCallback(async (from, to) => {
    soundEffects.playClickTick();
    try {
      await fetch('/api/resolve_hazard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to })
      });
      const res = await fetch('/api/state');
      if (res.ok) applyTelemetry(await res.json());
      addToast('RESOLVED', 'ROADWAY RESTORED', `Corridor ${from} ↔ ${to} returned to free-flow.`);
    } catch (err) { console.error('Hazard resolve error', err); }
  }, [addToast, applyTelemetry]);

  const handleCreateIncident = useCallback(async (incidentData) => {
    soundEffects.playDispatchChirp();
    try {
      if (!incidentData) return;
      const rawX = incidentData.x;
      const rawY = incidentData.y;
      const numX = typeof rawX === 'number' ? rawX : (parseFloat(rawX) || 5.0);
      const numY = typeof rawY === 'number' ? rawY : (parseFloat(rawY) || 5.0);
      const clampedX = Math.max(0.5, Math.min(24.5, isNaN(numX) ? 5.0 : numX));
      const clampedY = Math.max(0.5, Math.min(24.5, isNaN(numY) ? 5.0 : numY));

      const rawSev = incidentData.severity;
      const numSev = typeof rawSev === 'number' ? rawSev : (parseInt(rawSev, 10) || 3);
      const clampedSev = Math.max(1, Math.min(5, isNaN(numSev) ? 3 : numSev));

      if (clampedX !== numX || clampedY !== numY) {
        addToast('INFO', 'COORDINATES SNAPPED', 'Out-of-bounds coords snapped to operational perimeter');
      }

      const payload = {
        type: incidentData.type || 'FIRE',
        severity: clampedSev,
        x: Number(clampedX.toFixed(2)),
        y: Number(clampedY.toFixed(2)),
        description: (incidentData.description || '').trim() || `${incidentData.type || 'FIRE'} Incident Level ${clampedSev}`
      };

      await fetch('/api/incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const res = await fetch('/api/state');
      if (res.ok) applyTelemetry(await res.json());
      addToast('DISPATCH', 'CAD DISPATCHED', `${payload.description} (Severity ${payload.severity})`);
    } catch (err) { console.error('Incident create error', err); }
  }, [addToast, applyTelemetry]);

  const handleMapClick = useCallback((x, y) => {
    soundEffects.playClickTick();
    const cx = Math.max(0.5, Math.min(24.5, x));
    const cy = Math.max(0.5, Math.min(24.5, y));
    if (cx !== x || cy !== y) {
      addToast('INFO', 'COORDINATES SNAPPED', 'Out-of-bounds coords snapped to operational perimeter');
    }
    setClickedCoords({ x: parseFloat(cx.toFixed(1)), y: parseFloat(cy.toFixed(1)) });
    setActiveTab('cad');
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
            from: segment.from, to: segment.to,
            hazardType: 'ROAD_CLOSURE', multiplier: 1.0, isBlocked: true,
            description: `Corridor Closure on ${segment.from} ↔ ${segment.to}`
          })
        });
        addToast('REROUTE', 'ROADWAY BLOCKED', `Corridor ${segment.from} ↔ ${segment.to} closed.`);
      }
      const res = await fetch('/api/state');
      if (res.ok) applyTelemetry(await res.json());
    } catch (err) { console.error('Toggle segment error', err); }
  }, [addToast, applyTelemetry]);

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
      if (res.ok) applyTelemetry(await res.json());
      addToast('INFO', 'VEHICLE RECALLED', `Unit ${vehicleId} ordered to RTB station.`);
    } catch (err) { console.error('Recall error', err); }
  }, [addToast, applyTelemetry]);

  const handleResolveIncident = useCallback(async (incidentId) => {
    soundEffects.playClickTick();
    try {
      await fetch('/api/resolve_incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidentId })
      });
      const res = await fetch('/api/state');
      if (res.ok) applyTelemetry(await res.json());
      addToast('RESOLVED', 'INCIDENT CLEARED', `Call ${incidentId} marked resolved.`);
    } catch (err) { console.error('Resolve incident error', err); }
  }, [addToast, applyTelemetry]);

  const handleApplyWeather = useCallback(async (condition, multiplier) => {
    soundEffects.playHazardTone();
    try {
      await fetch('/api/weather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ condition, multiplier })
      });
      const res = await fetch('/api/state');
      if (res.ok) applyTelemetry(await res.json());
      addToast('INFO', 'WEATHER ADVISORY', `City environmental conditions: ${condition} (x${multiplier} delay)`);
    } catch (err) { console.error('Weather error', err); }
  }, [addToast, applyTelemetry]);

  const handleExportReport = useCallback(() => {
    soundEffects.playClickTick();
    if (!telemetry) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(telemetry, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `v2x_telemetry_T${(telemetry.clockMinutes || 0).toFixed(0)}m.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    addToast('INFO', 'REPORT EXPORTED', 'Mission telemetry snapshot downloaded.');
  }, [telemetry, addToast]);

  const handleToggleReplay = useCallback(() => {
    soundEffects.playClickTick();
    setReplayMode(prev => {
      if (!prev) {
        setReplayPosition(replayBufferRef.current.length - 1);
        replayPlayingRef.current = false;
      }
      return !prev;
    });
  }, []);

  const handleReplayScrub = useCallback((position) => {
    const buffer = replayBufferRef.current;
    if (position >= 0 && position < buffer.length) {
      setReplayPosition(position);
      setTelemetry(buffer[position]);
    }
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); handleTogglePlay(); }
      else if (e.key === '1') handleStep(1.0);
      else if (e.key === '5') handleStep(5.0);
      else if (e.key === 'r' || e.key === 'R') handleReset();
      else if (e.key === 'Escape') { setFocusedVehicleId(null); setInspectedVehicle(null); setIsShortcutsOpen(false); }
      else if (e.key === 'm' || e.key === 'M') setSoundEnabled(prev => !prev);
      else if (e.key === '?') setIsShortcutsOpen(prev => !prev);
      else if (e.key === 'b' || e.key === 'B') setSidebarCollapsed(prev => !prev);
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
  const activeFleetCount = useMemo(() => fleet.filter(v => v.state !== 'IDLE_STATION').length, [fleet]);
  const blockedHazardsCount = useMemo(() => hazards.filter(h => h.isBlocked).length, [hazards]);

  // Hospital bay status (derived from fleet transporting/turnover states)
  const hospitalBays = useMemo(() => {
    const atTrauma = fleet.filter(v => v.state === 'AT_HOSPITAL_TURNOVER' && v.destinationNodeId === 'N11_HOSPITAL').length;
    const atClinic = fleet.filter(v => v.state === 'AT_HOSPITAL_TURNOVER' && v.destinationNodeId === 'N21_CLINIC').length;
    return {
      trauma: { occupied: Math.min(atTrauma, 2), total: 2 },
      clinic: { occupied: Math.min(atClinic, 1), total: 1 },
    };
  }, [fleet]);

  // Format clock display
  const formatClock = (mins) => {
    const m = Math.floor(mins);
    const s = Math.floor((mins - m) * 60);
    return `T+${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${Math.floor((mins % 1) * 10)}`;
  };

  return (
    <div className={`app-grid ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
      <KeyboardShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />

      {/* ═══════════════════ COMMAND BAR ═══════════════════ */}
      <div className="command-bar">
        {/* Left: Identity + Connection */}
        <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.3), rgba(14, 165, 233, 0.15))',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px -3px rgba(37, 99, 235, 0.4)'
          }}>
            <Cpu style={{ width: 16, height: 16, color: '#38bdf8' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 12, fontWeight: 800, color: '#f1f5f9', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                V2X OPS
              </span>
              <span className="badge" style={{ background: replayMode ? 'rgba(168, 85, 247, 0.2)' : 'rgba(16, 185, 129, 0.15)', 
                color: replayMode ? '#c084fc' : '#34d399', 
                border: `1px solid ${replayMode ? 'rgba(168, 85, 247, 0.4)' : 'rgba(16, 185, 129, 0.35)'}`,
                fontSize: 9, padding: '1px 6px' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', 
                  background: replayMode ? '#a855f7' : '#10b981', display: 'inline-block' }}
                  className={replayMode ? '' : 'status-dot-pulse'} />
                {replayMode ? 'REPLAY' : (sseActive ? 'SSE LIVE' : 'POLLING')}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Clock + Playback */}
        <div className="flex items-center gap-2">
          <div style={{
            background: 'rgba(9, 13, 22, 0.95)', border: '1px solid rgba(51, 65, 85, 0.5)',
            borderRadius: 6, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 6
          }}>
            <Clock style={{ width: 12, height: 12, color: '#64748b' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: '#38bdf8', letterSpacing: '0.02em' }}>
              {formatClock(clockMinutes)}
            </span>
          </div>

          <div className="flex items-center gap-1" style={{ background: 'rgba(15, 23, 42, 0.8)', padding: 3, borderRadius: 6, border: '1px solid rgba(51, 65, 85, 0.4)' }}>
            <button onClick={() => handleStep(-0.5)} className="btn-tactical" style={{ padding: '3px 6px', fontSize: 10 }} title="Back 30s">
              <SkipBack style={{ width: 12, height: 12 }} />
            </button>
            <button onClick={handleTogglePlay}
              className={`btn-tactical ${isPlaying ? 'btn-tactical-danger' : 'btn-tactical-primary'}`}
              style={{ padding: '3px 8px', fontSize: 10 }} title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}>
              {isPlaying ? <Pause style={{ width: 12, height: 12 }} /> : <Play style={{ width: 12, height: 12 }} />}
            </button>
            <button onClick={() => handleStep(0.5)} className="btn-tactical" style={{ padding: '3px 6px', fontSize: 10 }} title="+30s">
              <SkipForward style={{ width: 12, height: 12 }} />
            </button>
            <button onClick={() => handleStep(1.0)} className="btn-tactical" style={{ padding: '3px 6px', fontSize: 10 }} title="+1m (1)">
              +1m
            </button>
            <button onClick={() => handleStep(5.0)} className="btn-tactical" style={{ padding: '3px 6px', fontSize: 10 }} title="+5m (5)">
              <FastForward style={{ width: 11, height: 11 }} /> +5m
            </button>
            <button onClick={handleReset} className="btn-tactical" style={{ padding: '3px 6px', fontSize: 10 }} title="Reset (R)">
              <RotateCcw style={{ width: 12, height: 12 }} />
            </button>
          </div>

          {/* Speed selector */}
          <div className="flex items-center gap-1" style={{ background: 'rgba(15, 23, 42, 0.6)', padding: 2, borderRadius: 5 }}>
            {[1, 2, 5].map(s => (
              <button key={s} onClick={() => setSimSpeed(s)}
                className="btn-tactical" style={{
                  padding: '2px 6px', fontSize: 9,
                  background: simSpeed === s ? 'rgba(37, 99, 235, 0.3)' : 'transparent',
                  color: simSpeed === s ? '#60a5fa' : '#64748b',
                  border: simSpeed === s ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent'
                }}>
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Right: Facility Badges + Utilities */}
        <div className="flex items-center gap-2">
          {/* Hospital Bays */}
          <div className="flex items-center gap-3" style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(51, 65, 85, 0.4)' }}>
            <div className="flex items-center gap-1.5" title="Metro Trauma Center Bay Status">
              <span style={{ fontSize: 8, color: '#94a3b8', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>TRAUMA</span>
              <div className="flex items-center gap-1">
                {Array.from({ length: hospitalBays.trauma.total }).map((_, i) => (
                  <div key={i} className={`bay-led ${i < hospitalBays.trauma.occupied ? 'occupied' : 'free'}`} />
                ))}
              </div>
              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: hospitalBays.trauma.occupied >= hospitalBays.trauma.total ? '#fbbf24' : '#34d399' }}>
                {hospitalBays.trauma.occupied}/{hospitalBays.trauma.total}
              </span>
            </div>
            <div style={{ width: 1, height: 14, background: 'rgba(51, 65, 85, 0.5)' }} />
            <div className="flex items-center gap-1.5" title="Community Clinic Bay Status">
              <span style={{ fontSize: 8, color: '#94a3b8', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>CLINIC</span>
              <div className="flex items-center gap-1">
                {Array.from({ length: hospitalBays.clinic.total }).map((_, i) => (
                  <div key={i} className={`bay-led ${i < hospitalBays.clinic.occupied ? 'occupied' : 'free'}`} />
                ))}
              </div>
            </div>
          </div>

          {/* Fleet Readiness */}
          <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(51, 65, 85, 0.4)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
            <span style={{ color: '#94a3b8' }}>FLEET </span>
            <span style={{ color: '#34d399', fontWeight: 700 }}>{activeFleetCount}/{fleet.length}</span>
            <span style={{ color: '#64748b' }}> ACTIVE</span>
          </div>

          {/* Utility icons */}
          <div className="flex items-center gap-1">
            <button onClick={handleToggleReplay} className="btn-tactical" 
              style={{ padding: '3px 6px', color: replayMode ? '#a855f7' : '#64748b' }} title="Toggle Replay Mode">
              <Radio style={{ width: 14, height: 14 }} />
            </button>
            <button onClick={() => setSoundEnabled(s => !s)} className="btn-tactical"
              style={{ padding: '3px 6px', color: soundEnabled ? '#38bdf8' : '#64748b' }} title="Toggle Audio (M)">
              {soundEnabled ? <Volume2 style={{ width: 14, height: 14 }} /> : <VolumeX style={{ width: 14, height: 14 }} />}
            </button>
            <button onClick={() => setIsShortcutsOpen(true)} className="btn-tactical" style={{ padding: '3px 6px' }} title="Shortcuts (?)">
              <Keyboard style={{ width: 14, height: 14, color: '#64748b' }} />
            </button>
            <button onClick={handleExportReport} className="btn-tactical" style={{ padding: '3px 6px' }} title="Export Report">
              <Download style={{ width: 14, height: 14, color: '#64748b' }} />
            </button>
            <button onClick={() => setSidebarCollapsed(prev => !prev)} className="btn-tactical" style={{ padding: '3px 6px' }} title="Toggle Sidebar (B)">
              {sidebarCollapsed
                ? <PanelRight style={{ width: 14, height: 14, color: '#64748b' }} />
                : <PanelRightClose style={{ width: 14, height: 14, color: '#64748b' }} />
              }
            </button>

            {/* Connection Status */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', borderRadius: 5,
              border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
              background: isConnected ? 'rgba(6, 78, 59, 0.2)' : 'rgba(127, 29, 29, 0.2)',
              fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
              color: isConnected ? '#34d399' : '#f87171'
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%',
                background: isConnected ? '#34d399' : '#ef4444' }}
                className={isConnected ? 'status-dot-pulse' : ''} />
              {isConnected ? '8080' : 'OFF'}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════ CANVAS STAGE ═══════════════════ */}
      <div className="canvas-stage">
        <ErrorBoundary>
          <MemoizedMapCanvas
            telemetry={telemetry}
            onMapClick={handleMapClick}
            onSelectSegment={handleSelectSegment}
            onToggleSegment={handleToggleSegment}
            selectedSegment={selectedSegment}
            focusedVehicleId={focusedVehicleId}
            onFocusVehicle={handleFocusVehicle}
          />
        </ErrorBoundary>

        {/* Focused vehicle bar */}
        {focusedVehicleId && (
          <div style={{
            position: 'absolute', bottom: replayMode ? 60 : 8, left: 8,
            background: 'rgba(9, 13, 22, 0.9)', border: '1px solid rgba(59, 130, 246, 0.4)',
            borderRadius: 6, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: 'var(--font-mono)', fontSize: 10, color: '#38bdf8', zIndex: 20
          }}>
            <Crosshair style={{ width: 12, height: 12 }} />
            <span style={{ fontWeight: 700 }}>LOCKED: {focusedVehicleId}</span>
            <button onClick={() => setFocusedVehicleId(null)}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12, padding: '0 2px' }}>✕</button>
          </div>
        )}

        {/* Replay Scrubber */}
        <div className={`replay-scrubber ${replayMode ? 'visible' : ''}`}>
          <button onClick={() => handleReplayScrub(Math.max(0, replayPosition - 30))}
            className="btn-tactical" style={{ padding: '3px 8px', fontSize: 10 }}>
            <SkipBack style={{ width: 12, height: 12 }} /> -30s
          </button>
          <button onClick={() => { replayPlayingRef.current = !replayPlayingRef.current; }}
            className={`btn-tactical ${replayPlayingRef.current ? 'btn-tactical-danger' : 'btn-tactical-primary'}`}
            style={{ padding: '3px 8px', fontSize: 10 }}>
            {replayPlayingRef.current ? <Pause style={{ width: 12, height: 12 }} /> : <Play style={{ width: 12, height: 12 }} />}
          </button>
          <button onClick={() => handleReplayScrub(Math.min(replayBufferRef.current.length - 1, replayPosition + 30))}
            className="btn-tactical" style={{ padding: '3px 8px', fontSize: 10 }}>
            +30s <SkipForward style={{ width: 12, height: 12 }} />
          </button>

          <div className="replay-track" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            handleReplayScrub(Math.round(ratio * (replayBufferRef.current.length - 1)));
          }}>
            <div className="replay-track-fill"
              style={{ width: replayBufferRef.current.length > 0 ? `${(replayPosition / (replayBufferRef.current.length - 1)) * 100}%` : '0%' }} />
            <div className="replay-thumb"
              style={{ left: replayBufferRef.current.length > 0 ? `${(replayPosition / (replayBufferRef.current.length - 1)) * 100}%` : '0%' }} />
          </div>

          <div className="flex items-center gap-1">
            {[1, 2, 4].map(s => (
              <button key={s} onClick={() => setReplaySpeed(s)} className="btn-tactical"
                style={{ padding: '2px 5px', fontSize: 9, 
                  color: replaySpeed === s ? '#a855f7' : '#64748b',
                  background: replaySpeed === s ? 'rgba(168, 85, 247, 0.2)' : 'transparent' }}>
                {s}x
              </button>
            ))}
          </div>

          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>
            {replayPosition + 1}/{replayBufferRef.current.length} frames
          </span>
        </div>
      </div>

      {/* ═══════════════════ TELEMETRY DOCK ═══════════════════ */}
      <div className="telemetry-dock">
        {/* Vehicle Detail Drawer */}
        {inspectedVehicle && (
          <ErrorBoundary>
            <VehicleDetailDrawer
              vehicle={inspectedVehicle}
              onClose={() => setInspectedVehicle(null)}
              onRecall={handleRecallVehicle}
              isFocused={focusedVehicleId === inspectedVehicle.id}
              onToggleFocus={handleFocusVehicle}
            />
          </ErrorBoundary>
        )}

        {/* Tab Bar */}
        <div className="dock-tabs">
          <button onClick={() => setActiveTab('fleet')}
            className={`dock-tab ${activeTab === 'fleet' ? 'active' : ''}`}>
            <Activity style={{ width: 12, height: 12 }} />
            FLEET
            <span className="dock-tab-badge">{fleet.length}</span>
          </button>
          <button onClick={() => setActiveTab('cad')}
            className={`dock-tab ${activeTab === 'cad' ? 'active-cad' : ''}`}>
            <Siren style={{ width: 12, height: 12 }} />
            CAD
            {activeIncidentsCount > 0 && <span className="dock-tab-badge">{activeIncidentsCount}</span>}
          </button>
          <button onClick={() => setActiveTab('hazards')}
            className={`dock-tab ${activeTab === 'hazards' ? 'active-v2x' : ''}`}>
            <AlertTriangle style={{ width: 12, height: 12 }} />
            V2X
            {blockedHazardsCount > 0 && <span className="dock-tab-badge">{blockedHazardsCount}</span>}
          </button>
          <button onClick={() => setActiveTab('analytics')}
            className={`dock-tab ${activeTab === 'analytics' ? 'active-kpi' : ''}`}>
            <BarChart3 style={{ width: 12, height: 12 }} />
            KPI
          </button>
        </div>

        {/* Dock Content */}
        <div className="dock-content">
          <ErrorBoundary>
            {activeTab === 'fleet' && (
              <MemoizedFleetTable
                fleet={fleet}
                focusedVehicleId={focusedVehicleId}
                onFocusVehicle={handleFocusVehicle}
                onSelectVehicle={handleSelectVehicle}
                onRecallVehicle={handleRecallVehicle}
              />
            )}
            {activeTab === 'cad' && (
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
                onApplyWeather={handleApplyWeather}
                selectedSegment={selectedSegment}
              />
            )}
            {activeTab === 'analytics' && (
              <MemoizedAnalyticsKPI analytics={analytics} clockMinutes={clockMinutes} fleet={fleet} />
            )}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
