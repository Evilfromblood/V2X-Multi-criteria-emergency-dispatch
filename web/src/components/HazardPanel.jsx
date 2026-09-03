import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldCheck, Zap, Sliders, CheckCircle2, Ban, Radio, Trash2 } from 'lucide-react';

export default function HazardPanel({ 
  hazards = [], 
  segments = [], 
  nodes = [],
  onInjectHazard, 
  onResolveHazard, 
  selectedSegment 
}) {
  const [fromNode, setFromNode] = useState('N1_HQ');
  const [toNode, setToNode] = useState('N6');
  const [hazardType, setHazardType] = useState('ACCIDENT');
  const [multiplier, setMultiplier] = useState(3.5);
  const [isBlocked, setIsBlocked] = useState(true);
  const [description, setDescription] = useState('Central HQ Expressway Hazard Closure');

  // Update selection if user clicked segment on canvas
  useEffect(() => {
    if (selectedSegment) {
      setFromNode(selectedSegment.from);
      setToNode(selectedSegment.to);
      setIsBlocked(selectedSegment.isBlocked);
      if (selectedSegment.congestionMultiplier > 1) {
        setMultiplier(selectedSegment.congestionMultiplier);
      }
    }
  }, [selectedSegment]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!fromNode || !toNode) return;
    onInjectHazard({
      from: fromNode,
      to: toNode,
      hazardType,
      multiplier: parseFloat(multiplier),
      isBlocked,
      description: description || `${hazardType} on ${fromNode} ↔ ${toNode}`
    });
  };

  // Key tactical corridor toggles
  const keyCorridors = [
    {
      name: 'Central HQ Expressway',
      from: 'N1_HQ',
      to: 'N6',
      type: 'ACCIDENT',
      multiplier: 3.5,
      blocked: true,
      desc: 'Central HQ Diagonal Expressway Closure'
    },
    {
      name: 'Hospital Expressway',
      from: 'N6',
      to: 'N11_HOSPITAL',
      type: 'ACCIDENT',
      multiplier: 3.5,
      blocked: true,
      desc: 'Central Hospital Expressway Crash'
    },
    {
      name: 'Downtown Main Corridor',
      from: 'N5',
      to: 'N6',
      type: 'GRIDLOCK',
      multiplier: 4.5,
      blocked: false,
      desc: 'Downtown Rush Hour Gridlock'
    },
    {
      name: 'East River Bridge',
      from: 'N12',
      to: 'N16',
      type: 'FLOOD',
      multiplier: 1.0,
      blocked: true,
      desc: 'East River Bridge Storm Surge'
    },
    {
      name: 'Midtown Crossway',
      from: 'N9',
      to: 'N10',
      type: 'ROADWORK',
      multiplier: 2.5,
      blocked: false,
      desc: 'Midtown Infrastructure Work'
    }
  ];

  const isCorridorActive = (from, to) => {
    return hazards.some(
      h => (h.from === from && h.to === to) || (h.from === to && h.to === from)
    );
  };

  const toggleCorridor = (corridor) => {
    const active = isCorridorActive(corridor.from, corridor.to);
    if (active) {
      onResolveHazard(corridor.from, corridor.to);
    } else {
      onInjectHazard({
        from: corridor.from,
        to: corridor.to,
        hazardType: corridor.type,
        multiplier: corridor.multiplier,
        isBlocked: corridor.blocked,
        description: corridor.desc
      });
    }
  };

  const defaultNodeList = [
    'N1_HQ', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8',
    'N9', 'N10', 'N11_HOSPITAL', 'N12', 'N13', 'N14', 'N15', 'N16'
  ];

  const availableNodes = nodes.length > 0 ? nodes.map(n => n.id) : defaultNodeList;

  return (
    <div className="glass-panel p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          V2X Dynamic Road Hazard Hub
        </h3>
        <span className="text-[11px] font-mono text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
          {hazards.length} Active Hazards
        </span>
      </div>

      {/* 1-Click Key Corridor Toggle Switchboard */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1">
          <Radio className="w-3 h-3 text-sky-400" />
          Key Corridor Stress Switchboard (Live Dynamic Rerouting)
        </label>

        <div className="flex flex-col gap-2">
          {keyCorridors.map((c) => {
            const active = isCorridorActive(c.from, c.to);
            return (
              <div
                key={`${c.from}-${c.to}`}
                className={`p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                  active 
                    ? 'bg-rose-950/40 border-rose-600/50' 
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col">
                  <div className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                    <span>{c.name}</span>
                    <span className="text-[10px] font-mono text-sky-400">
                      [{c.from} ↔ {c.to}]
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {c.blocked ? 'Full Closure (Road Blocked)' : `Heavy Congestion (x${c.multiplier} Delay)`}
                  </span>
                </div>

                <label className="switch">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleCorridor(c)}
                  />
                  <span className="slider"></span>
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Hazard Form */}
      <form onSubmit={handleSubmit} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-2.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
          Custom Segment Injection
        </span>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-400 font-mono">FROM NODE</label>
            <select
              value={fromNode}
              onChange={(e) => setFromNode(e.target.value)}
              className="w-full mt-1 p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono"
            >
              {availableNodes.map(nodeId => (
                <option key={nodeId} value={nodeId}>{nodeId}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-mono">TO NODE</label>
            <select
              value={toNode}
              onChange={(e) => setToNode(e.target.value)}
              className="w-full mt-1 p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono"
            >
              {availableNodes.map(nodeId => (
                <option key={nodeId} value={nodeId}>{nodeId}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-400 font-mono">HAZARD TYPE</label>
            <select
              value={hazardType}
              onChange={(e) => setHazardType(e.target.value)}
              className="w-full mt-1 p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono"
            >
              <option value="ACCIDENT">ACCIDENT</option>
              <option value="GRIDLOCK">GRIDLOCK</option>
              <option value="FLOOD">FLOOD</option>
              <option value="ROADWORK">ROADWORK</option>
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
              <input
                type="checkbox"
                checked={isBlocked}
                onChange={(e) => setIsBlocked(e.target.checked)}
                className="w-4 h-4 rounded text-red-600 bg-slate-950 border-slate-800"
              />
              <span className="font-bold text-rose-400">ROAD BLOCKED (INF)</span>
            </label>
          </div>
        </div>

        {!isBlocked && (
          <div>
            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span>CONGESTION MULTIPLIER</span>
              <span className="text-amber-400 font-bold">{multiplier}x Delay</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="6.0"
              step="0.5"
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
              className="w-full mt-1 accent-amber-500"
            />
          </div>
        )}

        <button
          type="submit"
          className="btn-tactical btn-tactical-primary w-full py-2 mt-1"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>BROADCAST V2X HAZARD</span>
        </button>
      </form>

      {/* Active Hazards List */}
      {hazards.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
            Active Hazard Broadcasts
          </span>

          <div className="overflow-y-auto max-h-40 flex flex-col gap-1.5 pr-1">
            {hazards.map((h, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    <span className={h.isBlocked ? 'text-rose-400' : 'text-amber-400'}>
                      {h.hazardType}
                    </span>
                    <span className="text-slate-400 font-mono">
                      ({h.from} ↔ {h.to})
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {h.isBlocked ? 'Traffic Excluded (Inf cost)' : `${h.multiplier}x Delay multiplier`}
                  </div>
                </div>

                <button
                  onClick={() => onResolveHazard(h.from, h.to)}
                  className="btn-tactical text-[10px] px-2 py-1 hover:text-emerald-300"
                >
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>RESTORE</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
