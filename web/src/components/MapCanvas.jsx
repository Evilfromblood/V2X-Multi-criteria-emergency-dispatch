import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

const PADDING = 60;
const WORLD_SIZE = 25.0; // 25km Metropolitan Grid scale

const MAJOR_LANDMARK_NODES = new Set([
  'N1_HQ', 
  'N11_HOSPITAL', 
  'N21_CLINIC', 
  'N17_LOGISTICS', 
  'N26_AIRPORT_DEPOT', 
  'N25_AIRPORT', 
  'N28_CARGO_DEPOT',
  'N29_FREIGHT_HUB',
  'N30_NORTH_METRO',
  'N23_MARINA'
]);

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
  const [hoveredVehicleId, setHoveredVehicleId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);

  const isDraggingRef = useRef(false);
  const didDragRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1.0);
  const hoveredVehicleIdRef = useRef(null);

  // Layer Toggles
  const [showZones, setShowZones] = useState(true);
  const [showNodeLabels, setShowNodeLabels] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [showCongestion, setShowCongestion] = useState(true);

  // Sync refs
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    hoveredVehicleIdRef.current = hoveredVehicleId;
  }, [hoveredVehicleId]);

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
  }, [telemetry?.network?.segments, telemetry?.hazards, showZones, showNodeLabels, zoom]);

  // 1. LAYER 1: Pre-render static background & node baseline
  const renderStaticBackground = useCallback((offscreenCtx, width, height, curZoom) => {
    offscreenCtx.fillStyle = '#080c14';
    offscreenCtx.fillRect(0, 0, width, height);

    // Tactical 25km Coordinate Grid
    offscreenCtx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
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

    // Tactical Sector Zone Callouts (subtle deep background)
    if (showZones) {
      nodeMap.forEach((n) => {
        const sx = (PADDING + ((n.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING)) | 0;
        const sy = (height - (PADDING + ((n.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING))) | 0;

        if (n.id === 'N11_HOSPITAL') {
          offscreenCtx.beginPath();
          offscreenCtx.arc(sx, sy, 48, 0, Math.PI * 2);
          offscreenCtx.fillStyle = 'rgba(13, 148, 136, 0.05)';
          offscreenCtx.fill();
          offscreenCtx.strokeStyle = 'rgba(20, 184, 166, 0.25)';
          offscreenCtx.lineWidth = 1.2;
          offscreenCtx.setLineDash([4, 4]);
          offscreenCtx.stroke();
          offscreenCtx.setLineDash([]);

          offscreenCtx.fillStyle = 'rgba(45, 212, 191, 0.7)';
          offscreenCtx.font = 'bold 8px JetBrains Mono';
          offscreenCtx.textAlign = 'center';
          offscreenCtx.fillText('METRO TRAUMA CENTER', sx, sy - 52);
          offscreenCtx.textAlign = 'left';
        } else if (n.id === 'N21_CLINIC') {
          offscreenCtx.beginPath();
          offscreenCtx.arc(sx, sy, 42, 0, Math.PI * 2);
          offscreenCtx.fillStyle = 'rgba(13, 148, 136, 0.05)';
          offscreenCtx.fill();
          offscreenCtx.strokeStyle = 'rgba(20, 184, 166, 0.25)';
          offscreenCtx.lineWidth = 1.2;
          offscreenCtx.setLineDash([4, 4]);
          offscreenCtx.stroke();
          offscreenCtx.setLineDash([]);

          offscreenCtx.fillStyle = 'rgba(45, 212, 191, 0.7)';
          offscreenCtx.font = 'bold 8px JetBrains Mono';
          offscreenCtx.textAlign = 'center';
          offscreenCtx.fillText('EAST COMMUNITY CLINIC', sx, sy - 46);
          offscreenCtx.textAlign = 'left';
        } else if (n.id === 'N1_HQ') {
          offscreenCtx.beginPath();
          offscreenCtx.arc(sx, sy, 45, 0, Math.PI * 2);
          offscreenCtx.fillStyle = 'rgba(37, 99, 235, 0.05)';
          offscreenCtx.fill();
          offscreenCtx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
          offscreenCtx.lineWidth = 1.2;
          offscreenCtx.setLineDash([4, 4]);
          offscreenCtx.stroke();
          offscreenCtx.setLineDash([]);

          offscreenCtx.fillStyle = 'rgba(96, 165, 250, 0.7)';
          offscreenCtx.font = 'bold 8px JetBrains Mono';
          offscreenCtx.textAlign = 'center';
          offscreenCtx.fillText('HQ DISPATCH DEPOT', sx, sy - 48);
          offscreenCtx.textAlign = 'left';
        } else if (n.id === 'N17_LOGISTICS') {
          offscreenCtx.beginPath();
          offscreenCtx.arc(sx, sy, 42, 0, Math.PI * 2);
          offscreenCtx.fillStyle = 'rgba(245, 158, 11, 0.05)';
          offscreenCtx.fill();
          offscreenCtx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
          offscreenCtx.lineWidth = 1.2;
          offscreenCtx.setLineDash([4, 4]);
          offscreenCtx.stroke();
          offscreenCtx.setLineDash([]);

          offscreenCtx.fillStyle = 'rgba(251, 191, 36, 0.7)';
          offscreenCtx.font = 'bold 8px JetBrains Mono';
          offscreenCtx.textAlign = 'center';
          offscreenCtx.fillText('LOGISTICS HUB & DEPOT', sx, sy - 46);
          offscreenCtx.textAlign = 'left';
        } else if (n.id === 'N26_AIRPORT_DEPOT') {
          offscreenCtx.beginPath();
          offscreenCtx.arc(sx, sy, 40, 0, Math.PI * 2);
          offscreenCtx.fillStyle = 'rgba(168, 85, 247, 0.05)';
          offscreenCtx.fill();
          offscreenCtx.strokeStyle = 'rgba(168, 85, 247, 0.25)';
          offscreenCtx.lineWidth = 1.2;
          offscreenCtx.setLineDash([4, 4]);
          offscreenCtx.stroke();
          offscreenCtx.setLineDash([]);

          offscreenCtx.fillStyle = 'rgba(192, 132, 252, 0.7)';
          offscreenCtx.font = 'bold 8px JetBrains Mono';
          offscreenCtx.textAlign = 'center';
          offscreenCtx.fillText('AIRPORT RESCUE BASE', sx, sy - 44);
          offscreenCtx.textAlign = 'left';
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
        offscreenCtx.strokeStyle = 'rgba(51, 65, 85, 0.45)';
        offscreenCtx.lineWidth = 2.0;
        offscreenCtx.stroke();
      });
    }

    // Intersections (32 Nodes) - Decluttered hierarchy
    nodeMap.forEach((n) => {
      const sx = (PADDING + ((n.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING)) | 0;
      const sy = (height - (PADDING + ((n.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING))) | 0;

      offscreenCtx.beginPath();
      if (n.type === 'HOSPITAL') {
        offscreenCtx.arc(sx, sy, 7.5, 0, Math.PI * 2);
        offscreenCtx.fillStyle = '#0f766e';
        offscreenCtx.fill();
        offscreenCtx.strokeStyle = '#14b8a6';
        offscreenCtx.lineWidth = 1.8;
        offscreenCtx.stroke();

        // Medical Cross
        offscreenCtx.fillStyle = '#ffffff';
        offscreenCtx.fillRect(sx - 1.2, sy - 4, 2.4, 8);
        offscreenCtx.fillRect(sx - 4, sy - 1.2, 8, 2.4);
      } else if (n.type === 'STATION') {
        offscreenCtx.arc(sx, sy, 7.5, 0, Math.PI * 2);
        offscreenCtx.fillStyle = '#1e3a8a';
        offscreenCtx.fill();
        offscreenCtx.strokeStyle = '#3b82f6';
        offscreenCtx.lineWidth = 1.8;
        offscreenCtx.stroke();

        // Base anchor dot
        offscreenCtx.fillStyle = '#93c5fd';
        offscreenCtx.beginPath();
        offscreenCtx.arc(sx, sy, 2.2, 0, Math.PI * 2);
        offscreenCtx.fill();
      } else {
        offscreenCtx.arc(sx, sy, 4.0, 0, Math.PI * 2);
        offscreenCtx.fillStyle = '#1e293b';
        offscreenCtx.fill();
        offscreenCtx.strokeStyle = '#64748b';
        offscreenCtx.lineWidth = 1.0;
        offscreenCtx.stroke();
      }

      // Semantic LOD Node Labeling
      if (showNodeLabels) {
        const isMajorLandmark = MAJOR_LANDMARK_NODES.has(n.id);
        const shouldShowLabel = curZoom >= 0.75 || isMajorLandmark;

        if (shouldShowLabel) {
          offscreenCtx.fillStyle = isMajorLandmark ? '#94a3b8' : '#64748b';
          offscreenCtx.font = isMajorLandmark ? 'bold 8.5px JetBrains Mono' : '8px JetBrains Mono';
          offscreenCtx.textAlign = 'center';
          offscreenCtx.textBaseline = 'top';
          // Anchor node names 14px cleanly below node circles
          offscreenCtx.fillText(n.id, sx, sy + 14);
        }
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
      const curZoom = zoomRef.current;
      const curPan = panRef.current;
      const hoveredVid = hoveredVehicleIdRef.current;

      // Re-render offscreen cache if dirty
      if (offscreenDirtyRef.current) {
        const offscreenCanvas = offscreenCanvasRef.current;
        if (offscreenCanvas.width !== width || offscreenCanvas.height !== height) {
          offscreenCanvas.width = width;
          offscreenCanvas.height = height;
        }
        const offscreenCtx = offscreenCanvas.getContext('2d', { alpha: false });
        renderStaticBackground(offscreenCtx, width, height, curZoom);
        offscreenDirtyRef.current = false;
      }

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
            ctx.lineWidth = isSelected ? 4.5 : 3.2;
            ctx.setLineDash([8, 5]);
            ctx.stroke();
            ctx.setLineDash([]);

            const mx = ((x1 + x2) * 0.5) | 0;
            const my = ((y1 + y2) * 0.5) | 0;

            ctx.beginPath();
            ctx.arc(mx, my, 8, 0, Math.PI * 2);
            ctx.fillStyle = '#ef4444';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('✕', mx, my);
            ctx.textBaseline = 'alphabetic';
          } else if (seg.congestionMultiplier > 1.5) {
            ctx.strokeStyle = seg.congestionMultiplier >= 3.0 ? '#f97316' : '#eab308';
            ctx.lineWidth = isSelected ? 4 : 2.8;
            ctx.stroke();
          }
        }
      }

      // Dynamic Vehicle Route Trails (Active in-transit vehicles only)
      if (telemetry?.fleet && Array.isArray(telemetry.fleet) && showTrails) {
        const fleet = telemetry.fleet;
        for (let i = 0; i < fleet.length; ++i) {
          const v = fleet[i];
          if (!v || !Array.isArray(v.activeRoutePath) || v.activeRoutePath.length <= 1) continue;
          if (v.state === 'IDLE_STATION') continue;

          const isAmbulance = v.type === 'AMBULANCE';
          const isFocused = focusedVehicleId === v.id;

          ctx.beginPath();
          let started = false;
          for (let j = 0; j < v.activeRoutePath.length; ++j) {
            const nodeId = v.activeRoutePath[j];
            const node = nodeMap.get(nodeId);
            if (!node) continue;

            const sx = (PADDING + ((node.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING)) | 0;
            const sy = (height - (PADDING + ((node.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING))) | 0;

            if (!started) {
              ctx.moveTo(sx, sy);
              started = true;
            } else {
              ctx.lineTo(sx, sy);
            }
          }

          if (started) {
            ctx.strokeStyle = isFocused
              ? 'rgba(56, 189, 248, 0.95)'
              : isAmbulance
                ? 'rgba(6, 182, 212, 0.65)'
                : 'rgba(249, 115, 22, 0.65)';
            ctx.lineWidth = isFocused ? 3.5 : 2.0;
            ctx.setLineDash([6, 6]);
            ctx.lineDashOffset = -animOffsetRef.current;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.lineDashOffset = 0;
          }
        }
      }

      // Dynamic Active Emergency Incidents
      if (telemetry?.incidents && Array.isArray(telemetry.incidents)) {
        const incidents = telemetry.incidents;
        for (let i = 0; i < incidents.length; ++i) {
          const inc = incidents[i];
          if (!inc || typeof inc !== 'object') continue;
          if (inc.status === 'RESOLVED') continue;

          const rawX = inc.x;
          const rawY = inc.y;
          const numX = typeof rawX === 'number' ? rawX : parseFloat(rawX);
          const numY = typeof rawY === 'number' ? rawY : parseFloat(rawY);
          if (isNaN(numX) || isNaN(numY)) continue;

          const ix = (PADDING + ((numX - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING)) | 0;
          const iy = (height - (PADDING + ((numY - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING))) | 0;
          const sev = typeof inc.severity === 'number' ? inc.severity : (parseInt(inc.severity, 10) || 1);
          const isHighSeverity = sev >= 4;

          // Off-Grid Approach Line
          const nearestNodeKey = inc.nearestNodeId || inc.nearestNode;
          if (nearestNodeKey) {
            const nearest = nodeMap.get(nearestNodeKey);
            if (nearest && typeof nearest.x === 'number' && typeof nearest.y === 'number') {
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
                ctx.textBaseline = 'middle';
                ctx.fillText(`OFF-GRID`, mx, my);
                ctx.textBaseline = 'alphabetic';
              }
            }
          }

          // Perimeter Staging Line & Checkpoint for Isolated/Blocked Calls
          if (inc.isStaged && inc.perimeterStagingNodeId) {
            const stageNode = nodeMap.get(inc.perimeterStagingNodeId);
            if (stageNode && typeof stageNode.x === 'number' && typeof stageNode.y === 'number') {
              const sx = (PADDING + ((stageNode.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING)) | 0;
              const sy = (height - (PADDING + ((stageNode.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING))) | 0;

              // Amber dashed staging tether line
              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.lineTo(ix, iy);
              ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
              ctx.lineWidth = 2.0;
              ctx.setLineDash([6, 4]);
              ctx.stroke();
              ctx.setLineDash([]);

              // Pulsing staging checkpoint halo around staging node
              const stagePulse = 12 + tPulse * 16;
              ctx.beginPath();
              ctx.arc(sx, sy, stagePulse, 0, Math.PI * 2);
              ctx.strokeStyle = `rgba(245, 158, 11, ${1.0 - tPulse})`;
              ctx.lineWidth = 1.5;
              ctx.stroke();

              // Checkpoint Badge at midpoint
              const smx = ((sx + ix) * 0.5) | 0;
              const smy = ((sy + iy) * 0.5) | 0;
              const distGap = inc.stagingDistanceKm ? inc.stagingDistanceKm.toFixed(1) : '3.0';
              const label = `🚧 STAGING PERIMETER (${distGap}km)`;

              ctx.font = 'bold 7.5px JetBrains Mono';
              const textW = ctx.measureText(label).width;
              const boxW = textW + 10;
              const boxH = 14;

              ctx.fillStyle = 'rgba(30, 20, 10, 0.92)';
              ctx.fillRect(smx - boxW * 0.5, smy - 7, boxW, boxH);
              ctx.strokeStyle = '#f59e0b';
              ctx.lineWidth = 1.0;
              ctx.strokeRect(smx - boxW * 0.5, smy - 7, boxW, boxH);

              ctx.fillStyle = '#fbbf24';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(label, smx, smy);
              ctx.textBaseline = 'alphabetic';
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

          if (sev === 5) {
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
          ctx.textBaseline = 'middle';
          ctx.fillText(`L${sev}`, ix, iy);
          ctx.textBaseline = 'alphabetic';

          ctx.textAlign = 'left';
          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 9px Plus Jakarta Sans';
          ctx.fillText(inc.id || 'INC', ix + 14, iy - 3);
          ctx.fillStyle = isHighSeverity ? '#fca5a5' : '#fde68a';
          ctx.font = '8px JetBrains Mono';
          ctx.fillText(`${inc.type || 'EMERGENCY'} [${inc.status || 'PENDING'}]`, ix + 14, iy + 8);
        }
      }

      // Dynamic Moving Vehicles & Radial Depot Docking
      if (telemetry?.fleet && Array.isArray(telemetry.fleet)) {
        const fleet = telemetry.fleet;
        const posMap = vehiclePosMapRef.current;
        const factor = 1 - Math.exp(-9 * dt);

        // Group vehicles by location key (node / coord)
        const locationGroups = new Map();
        for (let i = 0; i < fleet.length; ++i) {
          const v = fleet[i];
          if (!v) continue;
          const vxVal = typeof v.x === 'number' ? v.x : (parseFloat(v.x) || 0);
          const vyVal = typeof v.y === 'number' ? v.y : (parseFloat(v.y) || 0);
          const groupKey = v.state === 'IDLE_STATION' && v.homeBaseNode 
            ? `NODE_${v.homeBaseNode}` 
            : `${Math.round(vxVal * 10)}_${Math.round(vyVal * 10)}`;

          if (!locationGroups.has(groupKey)) {
            locationGroups.set(groupKey, []);
          }
          locationGroups.get(groupKey).push(v);
        }

        // Semantic LOD: Low Zoom (< 0.75) Collapsed Station Badges
        if (curZoom < 0.75) {
          locationGroups.forEach((group) => {
            const idleUnits = group.filter(v => v.state === 'IDLE_STATION');
            if (idleUnits.length > 1) {
              const sample = idleUnits[0];
              const targetX = typeof sample.x === 'number' ? sample.x : (parseFloat(sample.x) || 0);
              const targetY = typeof sample.y === 'number' ? sample.y : (parseFloat(sample.y) || 0);

              const sx = PADDING + ((targetX - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING);
              const sy = height - (PADDING + ((targetY - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING));

              const ambCount = idleUnits.filter(v => v.type === 'AMBULANCE').length;
              const engCount = idleUnits.filter(v => v.type === 'FIRE_ENGINE').length;
              const badgeText = `${ambCount > 0 ? `🚑${ambCount}` : ''} ${engCount > 0 ? `🚒${engCount}` : ''}`.trim() || `${idleUnits.length} Units`;

              ctx.font = 'bold 8px JetBrains Mono';
              const textW = ctx.measureText(badgeText).width;
              const pillW = textW + 10;

              ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
              ctx.fillRect(sx - pillW / 2, sy - 22, pillW, 14);
              ctx.strokeStyle = '#38bdf8';
              ctx.lineWidth = 1;
              ctx.strokeRect(sx - pillW / 2, sy - 22, pillW, 14);

              ctx.fillStyle = '#38bdf8';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(badgeText, sx, sy - 15);
              ctx.textBaseline = 'alphabetic';
            }
          });
        }

        // Render individual vehicles
        for (let i = 0; i < fleet.length; ++i) {
          const v = fleet[i];
          if (!v) continue;

          const targetX = typeof v.x === 'number' ? v.x : (parseFloat(v.x) || 0);
          const targetY = typeof v.y === 'number' ? v.y : (parseFloat(v.y) || 0);

          let currentPos = posMap.get(v.id);
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

          const baseScreenX = PADDING + ((currentPos.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING);
          const baseScreenY = height - (PADDING + ((currentPos.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING));

          // Clean Radial Fan offset for vehicles docked at base / station
          let vx = baseScreenX;
          let vy = baseScreenY;

          const groupKey = v.state === 'IDLE_STATION' && v.homeBaseNode 
            ? `NODE_${v.homeBaseNode}` 
            : `${Math.round(targetX * 10)}_${Math.round(targetY * 10)}`;
          const group = locationGroups.get(groupKey) || [v];

          if (group.length > 1 && v.state === 'IDLE_STATION') {
            const idx = group.indexOf(v);
            const total = group.length;
            // Radial arc fan around depot at radius 22px
            const startAngle = -Math.PI * 0.75;
            const endAngle = Math.PI * 0.75;
            const angle = total === 1 ? -Math.PI / 2 : startAngle + (idx / (total - 1)) * (endAngle - startAngle);
            const radius = 22;
            vx = baseScreenX + Math.cos(angle) * radius;
            vy = baseScreenY + Math.sin(angle) * radius;
          } else if (group.length > 1 && v.state !== 'IDLE_STATION') {
            const idx = group.indexOf(v);
            const total = group.length;
            vx = baseScreenX + (idx - (total - 1) * 0.5) * 16;
          }

          vx = Math.round(vx);
          vy = Math.round(vy);

          const isAmbulance = v.type === 'AMBULANCE';
          const isOnScene = v.state === 'ON_SCENE';
          const isFocused = focusedVehicleId === v.id;
          const isHovered = hoveredVid === v.id;
          const isIdleAtBase = v.state === 'IDLE_STATION';

          // Focus indicator ring & crosshair
          if (isFocused) {
            ctx.beginPath();
            ctx.arc(vx, vy, 18 + tPulse * 6, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(56, 189, 248, ${1 - tPulse})`;
            ctx.lineWidth = 2.0;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(vx, vy, 15, 0, Math.PI * 2);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(vx - 20, vy); ctx.lineTo(vx - 15, vy);
            ctx.moveTo(vx + 15, vy); ctx.lineTo(vx + 20, vy);
            ctx.moveTo(vx, vy - 20); ctx.lineTo(vx, vy - 15);
            ctx.moveTo(vx, vy + 15); ctx.lineTo(vx, vy + 20);
            ctx.stroke();
          }

          // Ambient Glow
          ctx.beginPath();
          ctx.arc(vx, vy, isOnScene ? 14 : 10, 0, Math.PI * 2);
          ctx.fillStyle = isOnScene 
            ? 'rgba(239, 68, 68, 0.4)' 
            : isAmbulance 
              ? 'rgba(6, 182, 212, 0.3)' 
              : 'rgba(249, 115, 22, 0.3)';
          ctx.fill();

          // Distinct Sprites
          if (isAmbulance) {
            ctx.beginPath();
            ctx.arc(vx, vy, 8.0, 0, Math.PI * 2);
            ctx.fillStyle = '#06b6d4';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // White medical cross
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(vx - 1.2, vy - 4, 2.4, 8);
            ctx.fillRect(vx - 4, vy - 1.2, 8, 2.4);
          } else {
            // Fire Engine Chevron Shield
            ctx.save();
            ctx.translate(vx, vy);
            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.moveTo(0, -8);
            ctx.lineTo(7, -2);
            ctx.lineTo(5, 7);
            ctx.lineTo(0, 9);
            ctx.lineTo(-5, 7);
            ctx.lineTo(-7, -2);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // Inner flame accent
            ctx.fillStyle = '#fde047';
            ctx.beginPath();
            ctx.arc(0, 1, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          // Heading Arrow for in-motion units
          if (v.state === 'EN_ROUTE_INCIDENT' || v.state === 'TRANSPORTING_HOSPITAL' || v.state === 'RETURNING_TO_BASE') {
            const headingScreen = -currentPos.heading;
            const ax = vx + Math.cos(headingScreen) * 13;
            const ay = vy + Math.sin(headingScreen) * 13;

            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(
              (ax - Math.cos(headingScreen - 0.45) * 6) | 0,
              (ay - Math.sin(headingScreen - 0.45) * 6) | 0
            );
            ctx.lineTo(
              (ax - Math.cos(headingScreen + 0.45) * 6) | 0,
              (ay - Math.sin(headingScreen + 0.45) * 6) | 0
            );
            ctx.closePath();
            ctx.fillStyle = isAmbulance ? '#22d3ee' : '#fb923c';
            ctx.fill();
          }

          // Semantic LOD for Vehicle ID and Status Pill
          // Only show labels if:
          // 1. Vehicle is in motion/active (state != IDLE_STATION)
          // 2. Or vehicle is focused/hovered
          // 3. Or zoom >= 1.4
          const shouldShowVehicleLabel = !isIdleAtBase || isFocused || isHovered || curZoom >= 1.4;

          if (shouldShowVehicleLabel && curZoom >= 0.75) {
            // Vehicle ID Tag
            ctx.font = 'bold 8px JetBrains Mono';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = isFocused ? '#38bdf8' : '#e2e8f0';
            ctx.fillText(v.id, vx, vy + 10);
            ctx.textBaseline = 'alphabetic';

            // State Pill Badge
            const stateText = v.state === 'IDLE_STATION' ? 'IDLE' :
                              v.state === 'EN_ROUTE_INCIDENT' ? (v.isStagedAtPerimeter ? 'EN ROUTE STAGING' : 'EN ROUTE') :
                              v.state === 'ON_SCENE' ? `SCENE ${(v.stateTimerMinutes ?? 0).toFixed(0)}m` :
                              v.state === 'TRANSPORTING_HOSPITAL' ? 'TRANS' :
                              v.state === 'AT_HOSPITAL_TURNOVER' ? `TURNOVER ${(v.stateTimerMinutes ?? 0).toFixed(0)}m` :
                              v.state === 'RETURNING_TO_BASE' ? 'RTB' :
                              v.state === 'REFUELING_DEPOT' ? `FUEL ${(v.stateTimerMinutes ?? 0).toFixed(0)}m` :
                              v.state === 'REPLENISHING_WATER' ? `WATER ${(v.stateTimerMinutes ?? 0).toFixed(0)}m` :
                              v.state === 'SEEKING_RESUPPLY' ? 'RESUPPLY' :
                              v.state === 'STAGED_AT_PERIMETER' ? 'STAGING AT BLOCKAGE' :
                              v.state === 'DIVERTED_CLINIC' ? 'DIVERT' : v.state;

            let badgeBorderColor = 'rgba(16, 185, 129, 0.4)';
            let badgeTextColor = '#34d399';
            if (v.state === 'ON_SCENE') {
              badgeBorderColor = 'rgba(239, 68, 68, 0.5)';
              badgeTextColor = '#f87171';
            } else if (v.state === 'EN_ROUTE_INCIDENT') {
              badgeBorderColor = v.isStagedAtPerimeter ? 'rgba(245, 158, 11, 0.6)' : 'rgba(56, 189, 248, 0.5)';
              badgeTextColor = v.isStagedAtPerimeter ? '#fbbf24' : '#38bdf8';
            } else if (v.state === 'STAGED_AT_PERIMETER') {
              badgeBorderColor = 'rgba(245, 158, 11, 0.85)';
              badgeTextColor = '#fbbf24';
            } else if (v.state === 'TRANSPORTING_HOSPITAL') {
              badgeBorderColor = 'rgba(192, 132, 252, 0.5)';
              badgeTextColor = '#c084fc';
            } else if (v.state === 'RETURNING_TO_BASE') {
              badgeBorderColor = 'rgba(45, 212, 191, 0.5)';
              badgeTextColor = '#2dd4bf';
            } else if (v.state === 'REFUELING_DEPOT' || v.state === 'REPLENISHING_WATER') {
              badgeBorderColor = 'rgba(59, 130, 246, 0.5)';
              badgeTextColor = '#60a5fa';
            } else if (v.state === 'SEEKING_RESUPPLY') {
              badgeBorderColor = 'rgba(245, 158, 11, 0.6)';
              badgeTextColor = '#fbbf24';
            }

            ctx.font = '7.5px JetBrains Mono';
            const textWidth = ctx.measureText(stateText).width;
            const pillW = Math.round(textWidth + 6);
            const pillH = 11;
            const pillX = Math.round(vx - pillW * 0.5);
            const pillY = Math.round(vy - 11 - pillH);

            ctx.fillStyle = 'rgba(11, 17, 32, 0.92)';
            ctx.fillRect(pillX, pillY, pillW, pillH);
            ctx.strokeStyle = badgeBorderColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(pillX, pillY, pillW, pillH);

            ctx.fillStyle = badgeTextColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(stateText, vx, pillY + pillH * 0.5);
            ctx.textBaseline = 'alphabetic';
          }

          // Resource gauges (render when zoomed in >= 1.0 or active/hovered)
          if (curZoom >= 1.0 || isFocused || isHovered) {
            const fuelPct = typeof v.fuelPercentage === 'number' ? v.fuelPercentage : (parseFloat(v.fuelPercentage) || 100);
            const fuelAngle = (fuelPct / 100) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(vx, vy, 12.5, -Math.PI / 2, -Math.PI / 2 + fuelAngle, false);
            ctx.strokeStyle = fuelPct > 20 ? 'rgba(74, 222, 128, 0.6)' : '#ef4444';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            const waterPct = v.waterPercentage != null ? (typeof v.waterPercentage === 'number' ? v.waterPercentage : parseFloat(v.waterPercentage)) : null;
            if (!isAmbulance && waterPct != null && !isNaN(waterPct)) {
              const waterAngle = (waterPct / 100) * Math.PI * 2;
              ctx.beginPath();
              ctx.arc(vx, vy, 15.0, -Math.PI / 2, -Math.PI / 2 + waterAngle, false);
              ctx.strokeStyle = waterPct > 20 ? 'rgba(34, 211, 238, 0.6)' : '#f97316';
              ctx.lineWidth = 1.5;
              ctx.stroke();
            }
          }

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

  // Smooth, Exponential Damped Mouse Wheel Zoom Handler with Cursor Anchor
  const handleWheel = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = Math.exp(-e.deltaY * 0.0015);

    setZoom((prevZoom) => {
      const newScale = Math.min(Math.max(prevZoom * zoomFactor, 0.35), 4.5);
      const canvasCenterX = canvas.width / 2;
      const canvasCenterY = canvas.height / 2;
      const scaleRatio = newScale / prevZoom;

      setPan((prevPan) => ({
        x: (mouseX - canvasCenterX) * (1 - scaleRatio) + prevPan.x * scaleRatio,
        y: (mouseY - canvasCenterY) * (1 - scaleRatio) + prevPan.y * scaleRatio
      }));
      return parseFloat(newScale.toFixed(3));
    });
  };

  // Mouse Drag Pan Handlers
  const handleMouseDown = (e) => {
    isDraggingRef.current = true;
    didDragRef.current = false;
    dragStartRef.current = { x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y };
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDraggingRef.current) {
      const curX = e.clientX - dragStartRef.current.x;
      const curY = e.clientY - dragStartRef.current.y;
      const dx = Math.abs(curX - panRef.current.x);
      const dy = Math.abs(curY - panRef.current.y);
      if (dx > 2 || dy > 2) {
        didDragRef.current = true;
      }
      setPan({ x: curX, y: curY });
    }

    // Hover detection for vehicles
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const width = canvas.width;
    const height = canvas.height;
    const curZoom = zoomRef.current;
    const curPan = panRef.current;

    const canvasCenterX = width / 2;
    const canvasCenterY = height / 2;
    const transformedX = (px - (canvasCenterX + curPan.x)) / curZoom + canvasCenterX;
    const transformedY = (py - (canvasCenterY + curPan.y)) / curZoom + canvasCenterY;

    if (telemetry?.fleet && Array.isArray(telemetry.fleet)) {
      let foundVid = null;
      for (const v of telemetry.fleet) {
        if (!v) continue;
        const vxVal = typeof v.x === 'number' ? v.x : parseFloat(v.x);
        const vyVal = typeof v.y === 'number' ? v.y : parseFloat(v.y);
        if (isNaN(vxVal) || isNaN(vyVal)) continue;

        const vx = PADDING + ((vxVal - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING);
        const vy = height - (PADDING + ((vyVal - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING));
        if (Math.hypot(transformedX - vx, transformedY - vy) <= 18) {
          foundVid = v.id;
          break;
        }
      }
      setHoveredVehicleId(foundVid);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Click handler to select road segments, vehicles, or trigger incidents
  const handleCanvasClick = (e) => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas || !telemetry?.network) return;

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const width = canvas.width;
    const height = canvas.height;

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
    if (telemetry.fleet && Array.isArray(telemetry.fleet) && onFocusVehicle) {
      for (const v of telemetry.fleet) {
        if (!v) continue;
        const vxNum = typeof v.x === 'number' ? v.x : parseFloat(v.x);
        const vyNum = typeof v.y === 'number' ? v.y : parseFloat(v.y);
        if (isNaN(vxNum) || isNaN(vyNum)) continue;

        const vx = (PADDING + ((vxNum - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING)) | 0;
        const vy = (height - (PADDING + ((vyNum - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING))) | 0;
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
      className="relative w-full rounded-xl overflow-hidden glass-panel select-none"
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
        className="w-full h-full block cursor-grab active:cursor-grabbing"
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
          onClick={() => setZoom(z => Math.min(4.5, parseFloat((z * 1.2).toFixed(2))))}
          className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          onClick={() => setZoom(z => Math.max(0.35, parseFloat((z / 1.2).toFixed(2))))}
          className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <button
          onClick={handleResetView}
          className="p-1.5 rounded text-slate-300 hover:text-sky-400 hover:bg-slate-800 transition-all"
          title="Reset Zoom & Pan (100%)"
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
