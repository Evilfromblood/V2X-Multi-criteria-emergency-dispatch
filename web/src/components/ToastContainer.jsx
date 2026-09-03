import React from 'react';
import { AlertOctagon, Siren, ShieldAlert, CheckCircle, Info, X } from 'lucide-react';

export default function ToastContainer({ toasts = [], onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  const getIcon = (type) => {
    switch (type) {
      case 'PREEMPTION':
        return <AlertOctagon className="w-5 h-5 text-purple-400 flex-shrink-0" />;
      case 'DISPATCH':
        return <Siren className="w-5 h-5 text-rose-400 flex-shrink-0" />;
      case 'REROUTE':
        return <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0" />;
      case 'RESOLVED':
        return <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />;
      default:
        return <Info className="w-5 h-5 text-sky-400 flex-shrink-0" />;
    }
  };

  const getPanelClass = (type) => {
    switch (type) {
      case 'PREEMPTION':
        return 'glass-panel-glow border-purple-500/60 shadow-purple-950/50';
      case 'DISPATCH':
        return 'glass-panel-danger border-rose-500/60 shadow-rose-950/50';
      case 'REROUTE':
        return 'glass-panel border-amber-500/60 shadow-amber-950/50';
      case 'RESOLVED':
        return 'glass-panel border-emerald-500/60 shadow-emerald-950/50';
      default:
        return 'glass-panel border-sky-500/60 shadow-sky-950/50';
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: '70px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '380px',
        pointerEvents: 'none'
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast-animate p-3 rounded-xl flex items-start gap-3 shadow-2xl ${getPanelClass(toast.type)}`}
          style={{
            pointerEvents: 'auto',
            background: 'rgba(13, 19, 34, 0.95)',
            backdropFilter: 'blur(16px)'
          }}
        >
          {getIcon(toast.type)}
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100">
                {toast.title}
              </h4>
              <span className="text-[10px] font-mono text-slate-400">
                {toast.timestamp}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5 leading-snug">
              {toast.message}
            </p>
          </div>
          <button
            onClick={() => onDismiss && onDismiss(toast.id)}
            className="text-slate-400 hover:text-slate-100 p-0.5 transition-colors"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
