import React, { useState } from 'react';
import { CloudRain, Sun, CloudFog, CloudLightning, Snowflake, Wind, Droplets } from 'lucide-react';

export default function EnvironmentalWidget({ onApplyWeather }) {
  const [currentWeather, setCurrentWeather] = useState('CLEAR');
  const [customMult, setCustomMult] = useState(1.0);

  const weatherPresets = [
    { id: 'CLEAR', label: 'Clear Sky', icon: Sun, mult: 1.0, color: '#38bdf8', desc: 'Optimal dry road conditions' },
    { id: 'RAIN', label: 'Rainstorm', icon: CloudRain, mult: 1.6, color: '#60a5fa', desc: 'Wet pavement, 1.6x transit delay' },
    { id: 'FOG', label: 'Dense Fog', icon: CloudFog, mult: 2.2, color: '#94a3b8', desc: 'Low visibility <0.5km, 2.2x delay' },
    { id: 'STORM', label: 'Thunderstorm', icon: CloudLightning, mult: 2.8, color: '#f59e0b', desc: 'Localized flash flood risks, 2.8x delay' },
    { id: 'BLIZZARD', label: 'Ice Blizzard', icon: Snowflake, mult: 3.5, color: '#c084fc', desc: 'Severe black ice, 3.5x delay' },
  ];

  const handleSelectWeather = (preset) => {
    setCurrentWeather(preset.id);
    setCustomMult(preset.mult);
    if (onApplyWeather) {
      onApplyWeather(preset.id, preset.mult);
    }
  };

  return (
    <div className="glass-panel p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Wind className="w-3.5 h-3.5 text-sky-400" />
          Metropolitan Weather & Road Surface Advisory
        </span>
        <span className="text-[10px] font-mono text-sky-400">
          STATUS: {currentWeather} (x{customMult.toFixed(1)} DELAY)
        </span>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {weatherPresets.map((p) => {
          const IconComponent = p.icon;
          const isSelected = currentWeather === p.id;
          return (
            <button
              key={p.id}
              onClick={() => handleSelectWeather(p)}
              className={`p-2 rounded-lg border flex flex-col items-center gap-1 transition-all ${
                isSelected 
                  ? 'bg-sky-500/20 border-sky-400 text-sky-200 shadow-md shadow-sky-950/50' 
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
              style={{ cursor: 'pointer' }}
              title={p.desc}
            >
              <IconComponent className="w-4 h-4" style={{ color: isSelected ? p.color : 'inherit' }} />
              <span className="text-[10px] font-bold">{p.label}</span>
              <span className="text-[9px] font-mono text-slate-400">x{p.mult.toFixed(1)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
