import React from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Tactical Ops ErrorBoundary caught an exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="glass-panel p-6 m-4 flex flex-col items-center justify-center text-center gap-4"
          style={{
            background: 'rgba(26, 16, 26, 0.95)',
            border: '1px solid rgba(239, 68, 68, 0.6)',
            boxShadow: '0 0 30px rgba(239, 68, 68, 0.3)',
            borderRadius: 12,
            minHeight: '200px'
          }}
        >
          <div className="flex items-center gap-2 text-rose-400">
            <AlertOctagon style={{ width: 28, height: 28 }} />
            <h2 style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>
              TACTICAL DASHBOARD RECOVERY SHIELD
            </h2>
          </div>
          <p style={{ fontSize: 12, color: '#cbd5e1', maxWidth: '500px', lineHeight: 1.6 }}>
            A rendering anomaly occurred in the mission telemetry pipeline. The rest of the platform remains safe.
          </p>
          {this.state.error && (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: '#f87171',
                background: 'rgba(15, 23, 42, 0.8)',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid rgba(239, 68, 68, 0.3)',
                maxWidth: '600px',
                overflowX: 'auto',
                textAlign: 'left'
              }}
            >
              {this.state.error.toString()}
            </div>
          )}
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={this.handleReset}
              className="btn-tactical btn-tactical-primary"
              style={{ padding: '8px 16px', fontSize: 12 }}
            >
              <RotateCcw style={{ width: 14, height: 14 }} />
              <span>RELOAD OPS COMPONENT</span>
            </button>
            <button
              onClick={() => window.location.reload()}
              className="btn-tactical"
              style={{ padding: '8px 16px', fontSize: 12 }}
            >
              <span>HARD RESET DASHBOARD</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
