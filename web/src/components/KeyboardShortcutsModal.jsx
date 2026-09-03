import React from 'react';
import { X, Keyboard, Command } from 'lucide-react';

export default function KeyboardShortcutsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Space', desc: 'Toggle Simulation Play / Pause' },
    { key: '1', desc: 'Advance discrete simulation clock by +1.0 minute' },
    { key: '5', desc: 'Advance discrete simulation clock by +5.0 minutes' },
    { key: 'R', desc: 'Reset simulation, fleet positions, and clear hazards' },
    { key: 'Esc', desc: 'Deselect vehicle focus / close active drawer' },
    { key: 'Z', desc: 'Reset tactical map zoom & pan to 25km overview' },
    { key: 'M', desc: 'Toggle tactical audio sound effects (Mute / Unmute)' },
    { key: '?', desc: 'Toggle this keyboard shortcuts command sheet' },
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div 
        className="glass-panel p-5 max-w-md w-full flex flex-col gap-4 rounded-xl border border-sky-500/40"
        style={{ background: 'rgba(11, 17, 32, 0.98)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-sky-400" />
            <h3 className="font-extrabold text-sm text-slate-100 uppercase tracking-wider">
              Tactical Keyboard Shortcuts
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {shortcuts.map((s, idx) => (
            <div 
              key={idx}
              className="flex items-center justify-between p-2 rounded-lg bg-slate-900/70 border border-slate-800 text-xs"
            >
              <span className="text-slate-300">{s.desc}</span>
              <kbd 
                className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-sky-300 font-mono font-bold text-[11px] shadow-sm"
              >
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="text-[11px] text-slate-400 font-mono text-center pt-1 border-t border-slate-800">
          Press <kbd className="px-1 rounded bg-slate-800 text-slate-300">Esc</kbd> anytime to close this modal.
        </div>
      </div>
    </div>
  );
}
