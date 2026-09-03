import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Layers, Eye, EyeOff } from 'lucide-react';

const PADDING = 60;
const WORLD_SIZE = 25.0; // 25km Metropolitan Grid scale

function MapCanvasComponent({ 
  telemetry, 
  onMapClick, 
  onSelectSegment, 
  onToggleSegment,
  selectedSegment,
  focusedVehicleId,
  onFocusVehicle 
}) {
  const canvasRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const lastTimeRef = useRef(performance.now());

  // Interactive Zoom & Pan State
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1.0);

  // Layer Toggles
  const [showZones, setShowZones] = useState(true);
  const [showNodeLabels, setShowNodeLabels] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [showCongestion, setShowCongestion] = useState(true);

  // Sync refs for animation frame
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Cached off-screen canvas for static layer
  const offscreenCanvasRef = useRef(null);
  const offscreenDirtyRef = useRef(true);

  // Cached node dictionary
  const nodeMapRef = useRef(new Map());

  // Position interpolation map for smooth vehicle gliding
  const vehiclePosMapRef = useRef(new Map());
  const animOffsetRef = useRef(0);

  // Update node map whenever telemetry.network.nodes updates
  useEffect(() => {
    if (telemetry?.network?.nodes) {
      const map = nodeMapRef.current;
      map.clear();
      telemetry.network.nodes.forEach((n) => {
        map.set(n.id, n);
      });
      offscreenDirtyRef.current = true;
    }
  }, [telemetry?.network?.nodes]);

  // Mark offscreen background dirty if segments, hazards, or layer toggles change
  useEffect(() => {
    offscreenDirtyRef.current = true;
  }, [telemetry?.network?.segments, telemetry?.hazards, showZones, showNodeLabels]);

  // 1. LAYER 1: Pre-render static background
  const renderStaticBackground = useCallback((offscreenCtx, width, height) => {
    offscreenCtx.fillStyle = '#080c14';
    offscreenCtx.fillRect(0, 0, width, height);

    // Tactical 25km Coordinate Grid
    offscreenCtx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
    offscreenCtx.lineWidth = 1;
    const gridStep = 40;

    for (let x = 0; x <= width; x += gridStep) {
      offscreenCtx.beginPath();
      offscreenCtx.moveTo((x | 0) + 0.5, 0);
      offscreenCtx.lineTo((x | 0) + 0.5, height);
      offscreenCtx.stroke();
    }
    for (let y = 0; y <= height; y += gridStep) {
      offscreenCtx.beginPath();
      offscreenCtx.moveTo(0, (y | 0) + 0.5);
      offscreenCtx.lineTo(width, (y | 0) + 0.5);
      offscreenCtx.stroke();
    }

    // Coordinate tick labels on edges
    offscreenCtx.fillStyle = '#475569';
    offscreenCtx.font = '9px JetBrains Mono';
    const tickKms = [2, 5, 10, 15, 20, 25];
    for (let i = 0; i < tickKms.length; ++i) {
      const km = tickKms[i];
      const sx = (PADDING + ((km - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING)) | 0;
      const sy = (height - (PADDING + ((km - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING))) | 0;
      offscreenCtx.fillText(`${km}km`, sx - 10, height - 12);
      offscreenCtx.fillText(`${km}km`, 12, sy + 3);
    }

    const nodeMap = nodeMapRef.current;

    // Tactical Sector Zone Callouts
    if (showZones) {
      nodeMap.forEach((n) => {
        const sx = (PADDING + ((n.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING)) | 0;
        const sy = (height - (PADDING + ((n.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING))) | 0;

        if (n.id === 'N11_HOSPITAL') {
          offscreenCtx.beginPath();
          offscreenCtx.arc(sx, sy, 48, 0, Math.PI * 2);
          offscreenCtx.fillStyle = 'rgba(13, 148, 136, 0.08)';
          offscreenCtx.fill();
          offscreenCtx.strokeStyle = 'rgba(20, 184, 166, 0.4)';
          offscreenCtx.lineWidth = 1.5;
          offscreenCtx.setLineDash([4, 4]);
          offscreenCtx.stroke();
          offscreenCtx.setLineDash([]);

          offscreenCtx.fillStyle = 'rgba(45, 212, 191, 0.8)';
          offscreenCtx.font = 'bold 8px JetBrains Mono';
          offscreenCtx.fillText('METRO TRAUMA CENTER', sx - 50, sy - 54);
        } else if (n.id === 'N21_CLINIC') {
          offscreenCtx.beginPath();
          offscreenCtx.arc(sx, sy, 42, 0, Math.PI * 2);
          offscreenCtx.fillStyle = 'rgba(13, 148, 136, 0.08)';
          offscreenCtx.fill();
          offscreenCtx.strokeStyle = 'rgba(20, 184, 166, 0.4)';
          offscreenCtx.lineWidth = 1.5;
          offscreenCtx.setLineDash([4, 4]);
          offscreenCtx.stroke();
          offscreenCtx.setLineDash([]);

          offscreenCtx.fillStyle = 'rgba(45, 212, 191, 0.8)';
          offscreenCtx.font = 'bold 8px JetBrains Mono';
          offscreenCtx.fillText('EAST COMMUNITY CLINIC', sx - 54, sy - 48);
        } else if (n.id === 'N1_HQ') {
          offscreenCtx.beginPath();
          offscreenCtx.arc(sx, sy, 45, 0, Math.PI * 2);
          offscreenCtx.fillStyle = 'rgba(37, 99, 235, 0.08)';
          offscreenCtx.fill();
          offscreenCtx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
          offscreenCtx.lineWidth = 1.5;
          offscreenCtx.setLineDash([4, 4]);
          offscreenCtx.stroke();
          offscreenCtx.setLineDash([]);

          offscreenCtx.fillStyle = 'rgba(96, 165, 250, 0.8)';
          offscreenCtx.font = 'bold 8px JetBrains Mono';
          offscreenCtx.fillText('HQ DISPATCH DEPOT', sx - 45, sy - 50);
        } else if (n.id === 'N17_LOGISTICS') {
          offscreenCtx.beginPath();
          offscreenCtx.arc(sx, sy, 42, 0, Math.PI * 2);
          offscreenCtx.fillStyle = 'rgba(245, 158, 11, 0.08)';
          offscreenCtx.fill();
          offscreenCtx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
          offscreenCtx.lineWidth = 1.5;
          offscreenCtx.setLineDash([4, 4]);
          offscreenCtx.stroke();
          offscreenCtx.setLineDash([]);

          offscreenCtx.fillStyle = 'rgba(251, 191, 36, 0.8)';
          offscreenCtx.font = 'bold 8px JetBrains Mono';
          offscreenCtx.fillText('LOGISTICS HUB & TANKERS', sx - 56, sy - 48);
        } else if (n.id === 'N26_AIRPORT_DEPOT') {
          offscreenCtx.beginPath();
          offscreenCtx.arc(sx, sy, 40, 0, Math.PI * 2);
          offscreenCtx.fillStyle = 'rgba(168, 85, 247, 0.08)';
          offscreenCtx.fill();
          offscreenCtx.strokeStyle = 'rgba(168, 85, 247, 0.35)';
          offscreenCtx.lineWidth = 1.5;
          offscreenCtx.setLineDash([4, 4]);
          offscreenCtx.stroke();
          offscreenCtx.setLineDash([]);

          offscreenCtx.fillStyle = 'rgba(192, 132, 252, 0.8)';
          offscreenCtx.font = 'bold 8px JetBrains Mono';
          offscreenCtx.fillText('AIRPORT CRASH-RESCUE BASE', sx - 64, sy - 45);
        }
      });
    }

    // Static Base Road Segments
    if (telemetry?.network?.segments) {
      telemetry.network.segments.forEach((seg) => {
        const from = nodeMap.get(seg.from);
        const to = nodeMap.get(seg.to);
        if (!from || !to) return;

        const x1 = (PADDING + ((from.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING)) | 0;
        const y1 = (height - (PADDING + ((from.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING))) | 0;
        const x2 = (PADDING + ((to.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING)) | 0;
        const y2 = (height - (PADDING + ((to.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING))) | 0;

        offscreenCtx.beginPath();
        offscreenCtx.moveTo(x1, y1);
        offscreenCtx.lineTo(x2, y2);
        offscreenCtx.strokeStyle = 'rgba(51, 65, 85, 0.65)';
        offscreenCtx.lineWidth = 2.0;
        offscreenCtx.stroke();
      });
    }

    // Intersections (32 Nodes) with Anti-Collision Layout
    nodeMap.forEach((n) => {
      const sx = (PADDING + ((n.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING)) | 0;
      const sy = (height - (PADDING + ((n.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING))) | 0;

      offscreenCtx.beginPath();
      if (n.type === 'HOSPITAL') {
        offscreenCtx.arc(sx, sy, 8, 0, Math.PI * 2);
        offscreenCtx.fillStyle = '#0f766e';
        offscreenCtx.fill();
        offscreenCtx.strokeStyle = '#14b8a6';
        offscreenCtx.lineWidth = 2;
        offscreenCtx.stroke();

        // Medical Cross
        offscreenCtx.fillStyle = '#ffffff';
        offscreenCtx.fillRect(sx - 1.5, sy - 5, 3, 10);
        offscreenCtx.fillRect(sx - 5, sy - 1.5, 10, 3);
      } else if (n.type === 'STATION') {
        offscreenCtx.arc(sx, sy, 8, 0, Math.PI * 2);
        offscreenCtx.fillStyle = '#1e3a8a';
        offscreenCtx.fill();
        offscreenCtx.strokeStyle = '#3b82f6';
        offscreenCtx.lineWidth = 2;
        offscreenCtx.stroke();

        offscreenCtx.fillStyle = '#ffffff';
        offscreenCtx.font = 'bold 7px JetBrains Mono';
        offscreenCtx.textAlign = 'center';
        offscreenCtx.fillText('BASE', sx, sy + 2.5);
      } else {
        offscreenCtx.arc(sx, sy, 4.5, 0, Math.PI * 2);
        offscreenCtx.fillStyle = '#1e293b';
        offscreenCtx.fill();
        offscreenCtx.strokeStyle = '#64748b';
        offscreenCtx.lineWidth = 1.2;
        offscreenCtx.stroke();
      }

      if (showNodeLabels) {
        offscreenCtx.fillStyle = '#64748b';
        offscreenCtx.font = '8px JetBrains Mono';
        offscreenCtx.textAlign = 'right';
        offscreenCtx.fillText(n.id, sx - 10, sy + 14);
        offscreenCtx.textAlign = 'left';
      }
    });
  }, [telemetry?.network, showZones, showNodeLabels]);

  // 2. LAYER 2: 60 FPS Dynamic Foreground Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
      offscreenCanvasRef.current.width = canvas.width;
      offscreenCanvasRef.current.height = canvas.height;
      offscreenDirtyRef.current = true;
    }

    let isRunning = true;

    const render = (now) => {
      if (!isRunning) return;

      const dt = Math.min(0.1, (now - lastTimeRef.current) * 0.001);
      lastTimeRef.current = now;

      animOffsetRef.current = (animOffsetRef.current + dt * 25) % 1000;
      const tPulse = (now % 2000) / 2000;

      const width = canvas.width;
      const height = canvas.height;

      // Re-render offscreen cache if dirty
      if (offscreenDirtyRef.current) {
        const offscreenCanvas = offscreenCanvasRef.current;
        if (offscreenCanvas.width !== width || offscreenCanvas.height !== height) {
          offscreenCanvas.width = width;
          offscreenCanvas.height = height;
        }
        const offscreenCtx = offscreenCanvas.getContext('2d', { alpha: false });
        renderStaticBackground(offscreenCtx, width, height);
        offscreenDirtyRef.current = false;
      }

      // Smooth Camera tracking if vehicle focused
      const curZoom = zoomRef.current;
      const curPan = panRef.current;

      ctx.save();
      ctx.clearRect(0, 0, width, height);

      // Apply Pan & Zoom Transform
      ctx.translate(width / 2 + curPan.x, height / 2 + curPan.y);
      ctx.scale(curZoom, curZoom);
      ctx.translate(-width / 2, -height / 2);

      // Fast Blit Static Layer
      ctx.drawImage(offscreenCanvasRef.current, 0, 0);

      const nodeMap = nodeMapRef.current;

      // Dynamic Road Hazards & Congestion
      if (telemetry?.network?.segments && showCongestion) {
        const segments = telemetry.network.segments;
        for (let i = 0; i < segments.length; ++i) {
          const seg = segments[i];
          const isSelected = selectedSegment && 
            ((selectedSegment.from === seg.from && selectedSegment.to === seg.to) ||
             (selectedSegment.from === seg.to && selectedSegment.to === seg.from));

          if (!seg.isBlocked && seg.congestionMultiplier <= 1.5 && !isSelected) {
            continue;
          }

          const from = nodeMap.get(seg.from);
          const to = nodeMap.get(seg.to);
          if (!from || !to) continue;

          const x1 = (PADDING + ((from.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING)) | 0;
          const y1 = (height - (PADDING + ((from.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING))) | 0;
          const x2 = (PADDING + ((to.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING)) | 0;
          const y2 = (height - (PADDING + ((to.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING))) | 0;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);

          if (seg.isBlocked) {
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = isSelected ? 5 : 3.5;
            ctx.setLineDash([8, 5]);
            ctx.stroke();
            ctx.setLineDash([]);

            const mx = ((x1 + x2) * 0.5) | 0;
            const my = ((y1 + y2) * 0.5) | 0;

            ctx.beginPath();
            ctx.arc(mx, my, 8, 0, Math.PI * 2);
            ctx.fillStyle = '#dc2626';
            ctx.fill();
            ctx.strokeStyle = '#fca5a5';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('✕', mx, my + 3);
            ctx.textAlign = 'left';

            ctx.beginPath();
            ctx.arc(mx, my, 8 + tPulse * 7, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(239, 68, 68, ${1 - tPulse})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          } else if (seg.congestionMultiplier > 1.5) {
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = isSelected ? 5 : 3;
            ctx.stroke();

            const mx = ((x1 + x2) * 0.5) | 0;
            const my = ((y1 + y2) * 0.5) | 0;
            ctx.beginPath();
            ctx.arc(mx, my, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#f59e0b';
            ctx.fill();
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 7px JetBrains Mono';
            ctx.textAlign = 'center';
            ctx.fillText(`x${seg.congestionMultiplier.toFixed(1)}`, mx, my + 2);
            ctx.textAlign = 'left';
          } else if (isSelected) {
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 4;
            ctx.stroke();
          }
        }
      }

      // Dynamic Active Dijkstra Route Trails
      if (telemetry?.fleet && showTrails) {
        const fleet = telemetry.fleet;
        for (let i = 0; i < fleet.length; ++i) {
          const v = fleet[i];
          if (v.activeRoutePath && v.activeRoutePath.length > 1 && v.state !== 'IDLE_STATION') {
            const isAmbulance = v.type === 'AMBULANCE';
            const isFocused = focusedVehicleId === v.id;

            ctx.beginPath();
            let started = false;
            for (let p = 0; p < v.activeRoutePath.length; ++p) {
              const node = nodeMap.get(v.activeRoutePath[p]);
              if (node) {
                const sx = (PADDING + ((node.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING)) | 0;
                const sy = (height - (PADDING + ((node.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING))) | 0;
                if (!started) {
                  ctx.moveTo(sx, sy);
                  started = true;
                } else {
                  ctx.lineTo(sx, sy);
                }
              }
            }

            ctx.strokeStyle = isAmbulance 
              ? (isFocused ? 'rgba(6, 182, 212, 0.95)' : 'rgba(6, 182, 212, 0.5)')
              : (isFocused ? 'rgba(249, 115, 22, 0.95)' : 'rgba(249, 115, 22, 0.5)');
            ctx.lineWidth = isFocused ? 4.5 : 3.0;
            ctx.setLineDash([8, 8]);
            ctx.lineDashOffset = -animOffsetRef.current * 0.8;
            ctx.stroke();

            ctx.setLineDash([]);
            ctx.lineDashOffset = 0;
          }
        }
      }

      // Dynamic Active Emergency Incidents
      if (telemetry?.incidents) {
        const incidents = telemetry.incidents;
        for (let i = 0; i < incidents.length; ++i) {
          const inc = incidents[i];
          if (inc.status === 'RESOLVED') continue;

          const ix = (PADDING + ((inc.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING)) | 0;
          const iy = (height - (PADDING + ((inc.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING))) | 0;
          const isHighSeverity = inc.severity >= 4;

          // Off-Grid Approach Line
          if (inc.nearestNodeId) {
            const nearest = nodeMap.get(inc.nearestNodeId);
            if (nearest) {
              const nx = (PADDING + ((nearest.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING)) | 0;
              const ny = (height - (PADDING + ((nearest.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING))) | 0;
              const offRoadDist = Math.hypot(ix - nx, iy - ny);

              if (offRoadDist > 8) {
                ctx.beginPath();
                ctx.moveTo(nx, ny);
                ctx.lineTo(ix, iy);
                ctx.strokeStyle = 'rgba(251, 146, 60, 0.6)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.stroke();
                ctx.setLineDash([]);

                const mx = ((nx + ix) * 0.5) | 0;
                const my = ((ny + iy) * 0.5) | 0;
                ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
                ctx.fillRect(mx - 24, my - 7, 48, 14);
                ctx.strokeStyle = 'rgba(251, 146, 60, 0.5)';
                ctx.lineWidth = 0.8;
                ctx.strokeRect(mx - 24, my - 7, 48, 14);
                ctx.fillStyle = '#fdba74';
                ctx.font = '7px JetBrains Mono';
                ctx.textAlign = 'center';
                ctx.fillText(`OFF-GRID`, mx, my + 3);
                ctx.textAlign = 'left';
              }
            }
          }

          // Radar rings
          const pulseRadius = 14 + tPulse * 26;
          ctx.beginPath();
          ctx.arc(ix, iy, pulseRadius, 0, Math.PI * 2);
          ctx.strokeStyle = isHighSeverity 
            ? `rgba(239, 68, 68, ${1.0 - tPulse})` 
            : `rgba(245, 158, 11, ${1.0 - tPulse})`;
          ctx.lineWidth = 1.8;
          ctx.stroke();

          if (inc.severity === 5) {
            const pulseRadius2 = 8 + ((tPulse + 0.5) % 1.0) * 26;
            ctx.beginPath();
            ctx.arc(ix, iy, pulseRadius2, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(239, 68, 68, ${1.0 - ((tPulse + 0.5) % 1.0)})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }

          // Diamond
          ctx.save();
          ctx.translate(ix, iy);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = isHighSeverity ? '#ef4444' : '#f59e0b';
          ctx.fillRect(-7, -7, 14, 14);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(-7, -7, 14, 14);
          ctx.restore();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 8px JetBrains Mono';
          ctx.textAlign = 'center';
          ctx.fillText(`L${inc.severity}`, ix, iy + 3);

          ctx.textAlign = 'left';
          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 9px Plus Jakarta Sans';
          ctx.fillText(inc.id, ix + 14, iy - 3);
          ctx.fillStyle = isHighSeverity ? '#fca5a5' : '#fde68a';
          ctx.font = '8px JetBrains Mono';
          ctx.fillText(`${inc.type} [${inc.status}]`, ix + 14, iy + 8);
        }
      }

      // Dynamic Moving Vehicles
      if (telemetry?.fleet) {
        const fleet = telemetry.fleet;
        const posMap = vehiclePosMapRef.current;
        const factor = 1 - Math.exp(-9 * dt);

        const clusterMap = new Map();
        for (let i = 0; i < fleet.length; ++i) {
          const v = fleet[i];
          const clusterKey = `${Math.round(v.x * 2)}_${Math.round(v.y * 2)}`;
          if (!clusterMap.has(clusterKey)) {
            clusterMap.set(clusterKey, []);
          }
          clusterMap.get(clusterKey).push(v.id);
        }

        for (let i = 0; i < fleet.length; ++i) {
          const v = fleet[i];
          let currentPos = posMap.get(v.id);

          const targetX = v.x;
          const targetY = v.y;

          if (!currentPos) {
            currentPos = { x: targetX, y: targetY, heading: 0 };
            posMap.set(v.id, currentPos);
          } else {
            const dx = targetX - currentPos.x;
            const dy = targetY - currentPos.y;
            currentPos.x += dx * factor;
            currentPos.y += dy * factor;

            if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
              currentPos.heading = Math.atan2(dy, dx);
            }
          }

          const clusterKey = `${Math.round(v.x * 2)}_${Math.round(v.y * 2)}`;
          const clusterMembers = clusterMap.get(clusterKey) || [v.id];
          const clusterIdx = clusterMembers.indexOf(v.id);
          const clusterTotal = clusterMembers.length;
          const clusterOffsetX = clusterTotal > 1 ? (clusterIdx - (clusterTotal - 1) * 0.5) * 20 : 0;
          const clusterOffsetY = v.state === 'IDLE_STATION' ? -18 : 0;

          const baseScreenX = PADDING + ((currentPos.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING);
          const baseScreenY = height - (PADDING + ((currentPos.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING));

          const vx = (baseScreenX + clusterOffsetX) | 0;
          const vy = (baseScreenY + clusterOffsetY) | 0;

          const isAmbulance = v.type === 'AMBULANCE';
          const isOnScene = v.state === 'ON_SCENE';
          const isFocused = focusedVehicleId === v.id;

          // Focus indicator ring & crosshair
          if (isFocused) {
            ctx.beginPath();
            ctx.arc(vx, vy, 20 + tPulse * 7, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(56, 189, 248, ${1 - tPulse})`;
            ctx.lineWidth = 2.0;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(vx, vy, 17, 0, Math.PI * 2);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(vx - 24, vy); ctx.lineTo(vx - 17, vy);
            ctx.moveTo(vx + 17, vy); ctx.lineTo(vx + 24, vy);
            ctx.moveTo(vx, vy - 24); ctx.lineTo(vx, vy - 17);
            ctx.moveTo(vx, vy + 17); ctx.lineTo(vx, vy + 24);
            ctx.stroke();
          }

          // Ambient Glow
          ctx.beginPath();
          ctx.arc(vx, vy, isOnScene ? 15 : 12, 0, Math.PI * 2);
          ctx.fillStyle = isOnScene 
            ? 'rgba(239, 68, 68, 0.45)' 
            : isAmbulance 
              ? 'rgba(6, 182, 212, 0.35)' 
              : 'rgba(249, 115, 22, 0.35)';
          ctx.fill();

          // Distinct Sprites
          if (isAmbulance) {
            ctx.beginPath();
            ctx.arc(vx, vy, 8.5, 0, Math.PI * 2);
            ctx.fillStyle = '#06b6d4';
            ctx.fill();
            ctx.strokeStyle = '#e0f2fe';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(vx - 1.5, vy - 4.5, 3, 9);
            ctx.fillRect(vx - 4.5, vy - 1.5, 9, 3);
          } else {
            ctx.fillStyle = '#ea580c';
            ctx.beginPath();
            const r = 3;
            const x = vx - 8.5;
            const y = vy - 8.5;
            const w = 17;
            const h = 17;
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#fed7aa';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px JetBrains Mono';
            ctx.textAlign = 'center';
            ctx.fillText('F', vx, vy + 3);
          }

          // Directional Heading Indicator
          if (v.state === 'EN_ROUTE_INCIDENT' || v.state === 'TRANSPORTING_HOSPITAL' || v.state === 'RETURNING_TO_BASE') {
            const headingScreen = -currentPos.heading;
            const arrowDist = 14;
            const ax = (vx + Math.cos(headingScreen) * arrowDist) | 0;
            const ay = (vy + Math.sin(headingScreen) * arrowDist) | 0;

            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(
              (ax - Math.cos(headingScreen - 0.45) * 6.5) | 0,
              (ay - Math.sin(headingScreen - 0.45) * 6.5) | 0
            );
            ctx.lineTo(
              (ax - Math.cos(headingScreen + 0.45) * 6.5) | 0,
              (ay - Math.sin(headingScreen + 0.45) * 6.5) | 0
            );
            ctx.closePath();
            ctx.fillStyle = isAmbulance ? '#22d3ee' : '#fb923c';
            ctx.fill();
          }

          // State Pill Badge
          const stateText = v.state === 'IDLE_STATION' ? 'IDLE' :
                            v.state === 'EN_ROUTE_INCIDENT' ? 'EN ROUTE' :
                            v.state === 'ON_SCENE' ? `SCENE ${(v.stateTimerMinutes ?? 0).toFixed(0)}m` :
                            v.state === 'TRANSPORTING_HOSPITAL' ? 'TRANS' :
                            v.state === 'AT_HOSPITAL_TURNOVER' ? `TURNOVER ${(v.stateTimerMinutes ?? 0).toFixed(0)}m` :
                            v.state === 'RETURNING_TO_BASE' ? 'RTB' : v.state;

          let badgeBorderColor = 'rgba(16, 185, 129, 0.4)';
          let badgeTextColor = '#34d399';
          if (v.state === 'ON_SCENE') {
            badgeBorderColor = 'rgba(239, 68, 68, 0.5)';
            badgeTextColor = '#f87171';
          } else if (v.state === 'EN_ROUTE_INCIDENT') {
            badgeBorderColor = 'rgba(56, 189, 248, 0.5)';
            badgeTextColor = '#38bdf8';
          } else if (v.state === 'TRANSPORTING_HOSPITAL') {
            badgeBorderColor = 'rgba(192, 132, 252, 0.5)';
            badgeTextColor = '#c084fc';
          } else if (v.state === 'RETURNING_TO_BASE') {
            badgeBorderColor = 'rgba(45, 212, 191, 0.5)';
            badgeTextColor = '#2dd4bf';
          }

          ctx.font = '8px JetBrains Mono';
          const textWidth = ctx.measureText(stateText).width;
          const pillW = (textWidth + 6) | 0;
          const pillH = 12;
          const pillX = (vx - pillW * 0.5) | 0;
          const pillY = (vy - 21) | 0;

          ctx.fillStyle = 'rgba(11, 17, 32, 0.9)';
          ctx.fillRect(pillX, pillY, pillW, pillH);
          ctx.strokeStyle = badgeBorderColor;
          ctx.lineWidth = 1;
          ctx.strokeRect(pillX, pillY, pillW, pillH);

          ctx.fillStyle = badgeTextColor;
          ctx.textAlign = 'center';
          ctx.fillText(stateText, vx, pillY + 9);

          // Vehicle ID Tag
          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 8.5px JetBrains Mono';
          ctx.fillText(v.id, vx, vy + 16);
          ctx.textAlign = 'left';
        }
      }

      ctx.restore();

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [telemetry, selectedSegment, focusedVehicleId, renderStaticBackground, showZones, showNodeLabels, showTrails, showCongestion]);

  // Mouse wheel zoom handler
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom((prev) => {
      const next = Math.max(0.7, Math.min(3.5, prev * zoomFactor));
      return parseFloat(next.toFixed(2));
    });
  };

  // Mouse drag pan handlers
  const handleMouseDown = (e) => {
    // Only drag with left mouse button if holding Shift or middle click, or right click
    if (e.button === 1 || e.shiftKey) {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e) => {
    if (isDraggingRef.current) {
      setPan({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Click handler to select road segments, vehicles, or trigger incidents
  const handleCanvasClick = (e) => {
    if (isDraggingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas || !telemetry?.network) return;

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const width = canvas.width;
    const height = canvas.height;

    // Apply inverse pan & zoom transform to click coordinate
    const curZoom = zoomRef.current;
    const curPan = panRef.current;

    const canvasCenterX = width / 2;
    const canvasCenterY = height / 2;

    const transformedX = (px - (canvasCenterX + curPan.x)) / curZoom + canvasCenterX;
    const transformedY = (py - (canvasCenterY + curPan.y)) / curZoom + canvasCenterY;

    // Convert pixel to 25km coordinates
    const worldX = 1.0 + ((transformedX - PADDING) / (width - 2 * PADDING)) * (WORLD_SIZE - 1.0);
    const worldY = 1.0 + ((height - transformedY - PADDING) / (height - 2 * PADDING)) * (WORLD_SIZE - 1.0);

    // 1. Check if clicked a vehicle
    if (telemetry.fleet && onFocusVehicle) {
      for (const v of telemetry.fleet) {
        const vx = (PADDING + ((v.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING)) | 0;
        const vy = (height - (PADDING + ((v.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING))) | 0;
        const dist = Math.hypot(transformedX - vx, transformedY - vy);
        if (dist <= 18) {
          onFocusVehicle(v.id);
          return;
        }
      }
    }

    // 2. Check if clicked near a road segment
    const nodeMap = nodeMapRef.current;
    const segments = telemetry.network.segments || [];

    let clickedSegment = null;
    let minSegDist = 16;

    for (let i = 0; i < segments.length; ++i) {
      const seg = segments[i];
      const from = nodeMap.get(seg.from);
      const to = nodeMap.get(seg.to);
      if (!from || !to) continue;

      const x1 = (PADDING + ((from.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING)) | 0;
      const y1 = (height - (PADDING + ((from.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING))) | 0;
      const x2 = (PADDING + ((to.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING)) | 0;
      const y2 = (height - (PADDING + ((to.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING))) | 0;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const lenSq = dx * dx + dy * dy;
      let t = ((transformedX - x1) * dx + (transformedY - y1) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const projX = x1 + t * dx;
      const projY = y1 + t * dy;
      const dist = Math.hypot(transformedX - projX, transformedY - projY);

      if (dist < minSegDist) {
        minSegDist = dist;
        clickedSegment = seg;
      }
    }

    if (clickedSegment) {
      if (onToggleSegment) {
        onToggleSegment(clickedSegment);
      } else if (onSelectSegment) {
        onSelectSegment(clickedSegment);
      }
      return;
    }

    // 3. Otherwise dispatch coords
    if (onMapClick) {
      onMapClick(parseFloat(worldX.toFixed(2)), parseFloat(worldY.toFixed(2)));
    }
  };

  const handleResetView = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div 
      className="relative w-full rounded-xl overflow-hidden glass-panel"
      style={{
        border: '1px solid rgba(59, 130, 246, 0.25)',
        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.8)'
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <canvas
        ref={canvasRef}
        width={960}
        height={620}
        onClick={handleCanvasClick}
        className="w-full h-full block cursor-crosshair"
        style={{ display: 'block', background: '#080c14' }}
      />

      {/* Floating Tactical Legend Overlay */}
      <div 
        className="absolute top-3 left-3 px-3 py-2 rounded-lg text-xs font-mono flex flex-wrap gap-3.5 items-center pointer-events-none"
        style={{
          background: 'rgba(9, 13, 22, 0.92)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(51, 65, 85, 0.7)'
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
          <span className="text-slate-300">Ambulance</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-orange-500"></span>
          <span className="text-slate-300">Fire Engine</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-400"></span>
          <span className="text-slate-300">Hospital/Clinic</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
          <span className="text-slate-300">V2X Blockage</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-amber-400 font-bold border border-amber-500/40 px-1 rounded">
            25KM METRO
          </span>
        </div>
      </div>

      {/* Interactive Map Controls: Zoom & View Reset */}
      <div 
        className="absolute bottom-3 right-3 flex flex-col gap-1.5 p-1 rounded-lg"
        style={{
          background: 'rgba(9, 13, 22, 0.92)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(51, 65, 85, 0.7)'
        }}
      >
        <button
          onClick={() => setZoom(z => Math.min(3.5, parseFloat((z + 0.2).toFixed(2))))}
          className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          onClick={() => setZoom(z => Math.max(0.7, parseFloat((z - 0.2).toFixed(2))))}
          className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <button
          onClick={handleResetView}
          className="p-1.5 rounded text-slate-300 hover:text-sky-400 hover:bg-slate-800 transition-all"
          title="Reset Zoom & Pan (Z)"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <div className="text-[9px] font-mono text-center text-slate-400 pt-0.5 border-t border-slate-800">
          {(zoom * 100).toFixed(0)}%
        </div>
      </div>

      {/* Floating Layer Toggles Bar */}
      <div 
        className="absolute bottom-3 left-3 flex items-center gap-1.5 p-1.5 rounded-lg text-xs font-mono"
        style={{
          background: 'rgba(9, 13, 22, 0.92)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(51, 65, 85, 0.7)'
        }}
      >
        <button
          onClick={() => setShowZones(v => !v)}
          className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${
            showZones ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Toggle Sector Zones"
        >
          <span>ZONES</span>
        </button>

        <button
          onClick={() => setShowNodeLabels(v => !v)}
          className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${
            showNodeLabels ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Toggle Node IDs"
        >
          <span>NODES</span>
        </button>

        <button
          onClick={() => setShowTrails(v => !v)}
          className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${
            showTrails ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Toggle Route Polylines"
        >
          <span>TRAILS</span>
        </button>

        <button
          onClick={() => setShowCongestion(v => !v)}
          className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${
            showCongestion ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Toggle Traffic Congestion"
        >
          <span>TRAFFIC</span>
        </button>
      </div>
    </div>
  );
}

export default React.memo(MapCanvasComponent);
