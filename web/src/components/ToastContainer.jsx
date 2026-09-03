import React from 'react';
import { AlertTriangle, Zap, Siren, CheckCircle, Info, Fuel, Droplets, TreePine } from 'lucide-react';

const TOAST_CONFIG = {
  PREEMPTION: { icon: Zap, color: '#c084fc', cls: 'toast-preemption' },
  REROUTE: { icon: AlertTriangle, color: '#fbbf24', cls: 'toast-reroute' },
  DISPATCH: { icon: Siren, color: '#f87171', cls: 'toast-dispatch' },
  RESOLVED: { icon: CheckCircle, color: '#34d399', cls: 'toast-resolved' },
  INFO: { icon: Info, color: '#60a5fa', cls: 'toast-info' },
  RESUPPLY: { icon: Fuel, color: '#22d3ee', cls: 'toast-resupply' },
  DIVERSION: { icon: Siren, color: '#fca5a5', cls: 'toast-diversion' },
  GREEN_WAVE: { icon: TreePine, color: '#34d399', cls: 'toast-greenwave' },
};

function ToastContainer({ toasts = [], onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => {
        const config = TOAST_CONFIG[toast.type] || TOAST_CONFIG.INFO;
        const IconComp = config.icon;

        return (
          <div
            key={toast.id}
            className={`toast-item toast-animate ${config.cls}`}
            onClick={() => onDismiss && onDismiss(toast.id)}
          >
            <IconComp style={{ width: 16, height: 16, color: config.color, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: config.color, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                {toast.title}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1, lineHeight: 1.3 }} className="truncate">
                {toast.message}
              </div>
            </div>
            <span style={{ fontSize: 9, color: '#64748b', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
              {toast.timestamp}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default React.memo(ToastContainer);
