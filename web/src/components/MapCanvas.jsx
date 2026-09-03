import React, { useRef, useEffect, useState, useCallback } from 'react';

const PADDING = 60;
const WORLD_SIZE = 13.0; // km

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

  // Cached off-screen canvas for static layer (grid, static roads, zone boundaries, node markers)
  const offscreenCanvasRef = useRef(null);
  const offscreenDirtyRef = useRef(true);

  // Cached node dictionary to avoid per-frame allocations
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

  // Mark offscreen background dirty if segments or hazards change
  useEffect(() => {
    offscreenDirtyRef.current = true;
  }, [telemetry?.network?.segments, telemetry?.hazards]);

  // 1. LAYER 1: Pre-render static background (tactical grid, node markers, zones, static roads)
  const renderStaticBackground = useCallback((offscreenCtx, width, height) => {
    // Fill deep tactical canvas
    offscreenCtx.fillStyle = '#080c14';
    offscreenCtx.fillRect(0, 0, width, height);

    // Tactical Coordinate Grid
    offscreenCtx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
    offscreenCtx.lineWidth = 1;
    const gridStep = 45;

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

    // Coordinate tick labels on edges (integer-aligned)
    offscreenCtx.fillStyle = '#475569';
    offscreenCtx.font = '9px JetBrains Mono';
    for (let km = 1; km <= 13; km += 2) {
      const sx = (PADDING + ((km - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING)) | 0;
      const sy = (height - (PADDING + ((km - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING))) | 0;
      offscreenCtx.fillText(`${km}km`, sx - 10, height - 12);
      offscreenCtx.fillText(`${km}km`, 12, sy + 3);
    }

    const nodeMap = nodeMapRef.current;

    // Tactical Zone Callouts (Hospital Trauma Perimeter & Base HQ Perimeter)
    nodeMap.forEach((n) => {
      const sx = (PADDING + ((n.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING)) | 0;
      const sy = (height - (PADDING + ((n.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING))) | 0;

      if (n.type === 'HOSPITAL') {
        offscreenCtx.beginPath();
        offscreenCtx.arc(sx, sy, 65, 0, Math.PI * 2);
        offscreenCtx.fillStyle = 'rgba(13, 148, 136, 0.08)';
        offscreenCtx.fill();
        offscreenCtx.strokeStyle = 'rgba(20, 184, 166, 0.35)';
        offscreenCtx.lineWidth = 1.5;
        offscreenCtx.setLineDash([4, 4]);
        offscreenCtx.stroke();
        offscreenCtx.setLineDash([]);

        offscreenCtx.fillStyle = 'rgba(45, 212, 191, 0.7)';
        offscreenCtx.font = 'bold 9px JetBrains Mono';
        offscreenCtx.fillText('CENTRAL HOSPITAL TRAUMA ZONE', sx - 85, sy - 72);
      } else if (n.type === 'STATION') {
        offscreenCtx.beginPath();
        offscreenCtx.arc(sx, sy, 52, 0, Math.PI * 2);
        offscreenCtx.fillStyle = 'rgba(37, 99, 235, 0.08)';
        offscreenCtx.fill();
        offscreenCtx.strokeStyle = 'rgba(59, 130, 246, 0.35)';
        offscreenCtx.lineWidth = 1.5;
        offscreenCtx.setLineDash([4, 4]);
        offscreenCtx.stroke();
        offscreenCtx.setLineDash([]);

        offscreenCtx.fillStyle = 'rgba(96, 165, 250, 0.7)';
        offscreenCtx.font = 'bold 9px JetBrains Mono';
        offscreenCtx.fillText('HQ DISPATCH DEPOT', sx - 54, sy - 58);
      }
    });

    // Static Base Road Segments (Free-Flow Corridor paths)
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
        offscreenCtx.lineWidth = 2.5;
        offscreenCtx.stroke();
      });
    }

    // Intersections (Nodes) with Anti-Collision Layout
    nodeMap.forEach((n) => {
      const sx = (PADDING + ((n.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING)) | 0;
      const sy = (height - (PADDING + ((n.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING))) | 0;

      offscreenCtx.beginPath();
      if (n.type === 'HOSPITAL') {
        offscreenCtx.arc(sx, sy, 11, 0, Math.PI * 2);
        offscreenCtx.fillStyle = '#0f766e';
        offscreenCtx.fill();
        offscreenCtx.strokeStyle = '#14b8a6';
        offscreenCtx.lineWidth = 2.5;
        offscreenCtx.stroke();

        // Medical Cross
        offscreenCtx.fillStyle = '#ffffff';
        offscreenCtx.fillRect(sx - 1.5, sy - 6, 3, 12);
        offscreenCtx.fillRect(sx - 6, sy - 1.5, 12, 3);
      } else if (n.type === 'STATION') {
        offscreenCtx.arc(sx, sy, 10, 0, Math.PI * 2);
        offscreenCtx.fillStyle = '#1e3a8a';
        offscreenCtx.fill();
        offscreenCtx.strokeStyle = '#3b82f6';
        offscreenCtx.lineWidth = 2.5;
        offscreenCtx.stroke();

        offscreenCtx.fillStyle = '#ffffff';
        offscreenCtx.font = 'bold 8px JetBrains Mono';
        offscreenCtx.textAlign = 'center';
        offscreenCtx.fillText('HQ', sx, sy + 3);
      } else {
        offscreenCtx.arc(sx, sy, 5.5, 0, Math.PI * 2);
        offscreenCtx.fillStyle = '#1e293b';
        offscreenCtx.fill();
        offscreenCtx.strokeStyle = '#64748b';
        offscreenCtx.lineWidth = 1.5;
        offscreenCtx.stroke();
      }

      // Explicit Layout Offset: Node label is anchored 14px below-left of node circle
      // to eliminate collisions with vehicle sprites and state pills!
      offscreenCtx.fillStyle = '#64748b';
      offscreenCtx.font = '9px JetBrains Mono';
      offscreenCtx.textAlign = 'right';
      offscreenCtx.fillText(n.id, sx - 12, sy + 16);
      offscreenCtx.textAlign = 'left';
    });
  }, [telemetry?.network]);

  // 2. LAYER 2: 60 FPS Dynamic Foreground Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });

    // Initialize off-screen canvas if needed
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

      // 1. FAST BLIT: Draw pre-rendered static layer in < 0.1ms
      ctx.drawImage(offscreenCanvasRef.current, 0, 0);

      const nodeMap = nodeMapRef.current;

      // 2. Dynamic Road Hazards & Congestion Overlays
      if (telemetry?.network?.segments) {
        const segments = telemetry.network.segments;
        for (let i = 0; i < segments.length; ++i) {
          const seg = segments[i];
          const isSelected = selectedSegment && 
            ((selectedSegment.from === seg.from && selectedSegment.to === seg.to) ||
             (selectedSegment.from === seg.to && selectedSegment.to === seg.from));

          if (!seg.isBlocked && seg.congestionMultiplier <= 1.5 && !isSelected) {
            continue; // Normal road already in background!
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
            ctx.lineWidth = isSelected ? 6 : 4;
            ctx.setLineDash([10, 6]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Exact Segment Midpoint for Blockage Octagon (Never occludes nodes)
            const mx = ((x1 + x2) * 0.5) | 0;
            const my = ((y1 + y2) * 0.5) | 0;

            ctx.beginPath();
            ctx.arc(mx, my, 10, 0, Math.PI * 2);
            ctx.fillStyle = '#dc2626';
            ctx.fill();
            ctx.strokeStyle = '#fca5a5';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('✕', mx, my + 3.5);
            ctx.textAlign = 'left';

            // Pulsing warning ring
            ctx.beginPath();
            ctx.arc(mx, my, 10 + tPulse * 8, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(239, 68, 68, ${1 - tPulse})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          } else if (seg.congestionMultiplier > 1.5) {
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = isSelected ? 6 : 3.5;
            ctx.stroke();

            const mx = ((x1 + x2) * 0.5) | 0;
            const my = ((y1 + y2) * 0.5) | 0;
            ctx.beginPath();
            ctx.arc(mx, my, 7, 0, Math.PI * 2);
            ctx.fillStyle = '#f59e0b';
            ctx.fill();
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 8px JetBrains Mono';
            ctx.textAlign = 'center';
            ctx.fillText(`x${seg.congestionMultiplier.toFixed(1)}`, mx, my + 2.5);
            ctx.textAlign = 'left';
          } else if (isSelected) {
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 5;
            ctx.stroke();
          }
        }
      }

      // 3. Dynamic Active Dijkstra Route Trails
      if (telemetry?.fleet) {
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
            ctx.lineWidth = isFocused ? 5 : 3.5;
            ctx.setLineDash([8, 8]);
            ctx.lineDashOffset = -animOffsetRef.current * 0.8;
            ctx.stroke();

            ctx.setLineDash([]);
            ctx.lineDashOffset = 0;
          }
        }
      }

      // 4. Dynamic Active Emergency Incidents (Radar Rings)
      if (telemetry?.incidents) {
        const incidents = telemetry.incidents;
        for (let i = 0; i < incidents.length; ++i) {
          const inc = incidents[i];
          if (inc.status === 'RESOLVED') continue;

          const ix = (PADDING + ((inc.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING)) | 0;
          const iy = (height - (PADDING + ((inc.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING))) | 0;
          const isHighSeverity = inc.severity >= 4;

          // Expanding Outer Radar Wave
          const pulseRadius = 15 + tPulse * 30;
          ctx.beginPath();
          ctx.arc(ix, iy, pulseRadius, 0, Math.PI * 2);
          ctx.strokeStyle = isHighSeverity 
            ? `rgba(239, 68, 68, ${1.0 - tPulse})` 
            : `rgba(245, 158, 11, ${1.0 - tPulse})`;
          ctx.lineWidth = 2;
          ctx.stroke();

          if (inc.severity === 5) {
            const pulseRadius2 = 10 + ((tPulse + 0.5) % 1.0) * 30;
            ctx.beginPath();
            ctx.arc(ix, iy, pulseRadius2, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(239, 68, 68, ${1.0 - ((tPulse + 0.5) % 1.0)})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }

          // Diamond Beacon
          ctx.save();
          ctx.translate(ix, iy);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = isHighSeverity ? '#ef4444' : '#f59e0b';
          ctx.fillRect(-8, -8, 16, 16);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(-8, -8, 16, 16);
          ctx.restore();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px JetBrains Mono';
          ctx.textAlign = 'center';
          ctx.fillText(`L${inc.severity}`, ix, iy + 3.5);

          // Tactical callout badge
          ctx.textAlign = 'left';
          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 10px Plus Jakarta Sans';
          ctx.fillText(inc.id, ix + 16, iy - 4);
          ctx.fillStyle = isHighSeverity ? '#fca5a5' : '#fde68a';
          ctx.font = '9px JetBrains Mono';
          ctx.fillText(`${inc.type} [${inc.status}]`, ix + 16, iy + 9);
        }
      }

      // 5. Multi-Vehicle Collision Avoidance & Distinct Sprites (Ambulance vs Fire Engine)
      if (telemetry?.fleet) {
        const fleet = telemetry.fleet;
        const posMap = vehiclePosMapRef.current;
        const factor = 1 - Math.exp(-9 * dt);

        // Group vehicles by approximate location to calculate horizontal layout offsets
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

          // Calculate cluster offset so vehicles at same node never overlap!
          const clusterKey = `${Math.round(v.x * 2)}_${Math.round(v.y * 2)}`;
          const clusterMembers = clusterMap.get(clusterKey) || [v.id];
          const clusterIdx = clusterMembers.indexOf(v.id);
          const clusterTotal = clusterMembers.length;
          const clusterOffsetX = clusterTotal > 1 ? (clusterIdx - (clusterTotal - 1) * 0.5) * 22 : 0;
          const clusterOffsetY = v.state === 'IDLE_STATION' ? -20 : 0;

          const baseScreenX = PADDING + ((currentPos.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING);
          const baseScreenY = height - (PADDING + ((currentPos.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING));

          const vx = (baseScreenX + clusterOffsetX) | 0;
          const vy = (baseScreenY + clusterOffsetY) | 0;

          const isAmbulance = v.type === 'AMBULANCE';
          const isOnScene = v.state === 'ON_SCENE';
          const isFocused = focusedVehicleId === v.id;

          // Focus indicator ring & crosshair reticle
          if (isFocused) {
            ctx.beginPath();
            ctx.arc(vx, vy, 22 + tPulse * 8, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(56, 189, 248, ${1 - tPulse})`;
            ctx.lineWidth = 2.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(vx, vy, 19, 0, Math.PI * 2);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Crosshair reticle ticks
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(vx - 26, vy); ctx.lineTo(vx - 19, vy);
            ctx.moveTo(vx + 19, vy); ctx.lineTo(vx + 26, vy);
            ctx.moveTo(vx, vy - 26); ctx.lineTo(vx, vy - 19);
            ctx.moveTo(vx, vy + 19); ctx.lineTo(vx, vy + 26);
            ctx.stroke();
          }

          // Ambient Glow
          ctx.beginPath();
          ctx.arc(vx, vy, isOnScene ? 16 : 13, 0, Math.PI * 2);
          ctx.fillStyle = isOnScene 
            ? 'rgba(239, 68, 68, 0.45)' 
            : isAmbulance 
              ? 'rgba(6, 182, 212, 0.35)' 
              : 'rgba(249, 115, 22, 0.35)';
          ctx.fill();

          // DISTINCT SPRITE RENDERING
          if (isAmbulance) {
            // Ambulance: Cyan/Emerald Shield Circle with Medical Cross [+]
            ctx.beginPath();
            ctx.arc(vx, vy, 9, 0, Math.PI * 2);
            ctx.fillStyle = '#06b6d4';
            ctx.fill();
            ctx.strokeStyle = '#e0f2fe';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Medical Cross [+]
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(vx - 1.5, vy - 5, 3, 10);
            ctx.fillRect(vx - 5, vy - 1.5, 10, 3);
          } else {
            // Fire Engine: Amber/Red Rounded Box with Heavy Border & [F] Glyph
            ctx.fillStyle = '#ea580c';
            ctx.beginPath();
            const r = 3;
            const x = vx - 9;
            const y = vy - 9;
            const w = 18;
            const h = 18;
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

            // Fire Engine Flame [F] Glyph
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px JetBrains Mono';
            ctx.textAlign = 'center';
            ctx.fillText('F', vx, vy + 3.5);
          }

          // Directional Heading Indicator (Pointing along vector to waypoint)
          if (v.state === 'EN_ROUTE_INCIDENT' || v.state === 'TRANSPORTING_HOSPITAL' || v.state === 'RETURNING_TO_BASE') {
            const headingScreen = -currentPos.heading;
            const arrowDist = 15;
            const ax = (vx + Math.cos(headingScreen) * arrowDist) | 0;
            const ay = (vy + Math.sin(headingScreen) * arrowDist) | 0;

            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(
              (ax - Math.cos(headingScreen - 0.45) * 7) | 0,
              (ay - Math.sin(headingScreen - 0.45) * 7) | 0
            );
            ctx.lineTo(
              (ax - Math.cos(headingScreen + 0.45) * 7) | 0,
              (ay - Math.sin(headingScreen + 0.45) * 7) | 0
            );
            ctx.closePath();
            ctx.fillStyle = isAmbulance ? '#22d3ee' : '#fb923c';
            ctx.fill();
          }

          // STATE PILL BADGE: Rendered 14px ABOVE the vehicle sprite with background box
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
          const pillY = (vy - 23) | 0;

          ctx.fillStyle = 'rgba(11, 17, 32, 0.88)';
          ctx.fillRect(pillX, pillY, pillW, pillH);
          ctx.strokeStyle = badgeBorderColor;
          ctx.lineWidth = 1;
          ctx.strokeRect(pillX, pillY, pillW, pillH);

          ctx.fillStyle = badgeTextColor;
          ctx.textAlign = 'center';
          ctx.fillText(stateText, vx, pillY + 9);

          // VEHICLE ID TAG: Rendered cleanly 15px BELOW the vehicle icon
          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 9px JetBrains Mono';
          ctx.fillText(v.id, vx, vy + 18);
          ctx.textAlign = 'left';
        }
      }

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [telemetry, selectedSegment, focusedVehicleId, renderStaticBackground]);

  // Click handler to select road segments, vehicles, or trigger incidents
  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !telemetry?.network) return;

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const width = canvas.width;
    const height = canvas.height;

    // Convert pixel to km
    const worldX = 1.0 + ((px - PADDING) / (width - 2 * PADDING)) * (WORLD_SIZE - 1.0);
    const worldY = 1.0 + ((height - py - PADDING) / (height - 2 * PADDING)) * (WORLD_SIZE - 1.0);

    // 1. Check if clicked a vehicle
    if (telemetry.fleet && onFocusVehicle) {
      for (const v of telemetry.fleet) {
        const vx = (PADDING + ((v.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING)) | 0;
        const vy = (height - (PADDING + ((v.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING))) | 0;
        const dist = Math.hypot(px - vx, py - vy);
        if (dist <= 20) {
          onFocusVehicle(v.id);
          return;
        }
      }
    }

    // 2. Check if clicked near an edge (road segment)
    const nodeMap = nodeMapRef.current;
    const segments = telemetry.network.segments || [];

    let clickedSegment = null;
    let minSegDist = 18;

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
      let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const projX = x1 + t * dx;
      const projY = y1 + t * dy;
      const dist = Math.hypot(px - projX, py - projY);

      if (dist < minSegDist) {
        minSegDist = dist;
        clickedSegment = seg;
      }
    }

    if (clickedSegment) {
      // Toggle hazard immediately if onToggleSegment is provided, or select it
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

  return (
    <div 
      className="relative w-full rounded-xl overflow-hidden glass-panel"
      style={{
        border: '1px solid rgba(59, 130, 246, 0.25)',
        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.8)'
      }}
    >
      <canvas
        ref={canvasRef}
        width={920}
        height={560}
        onClick={handleCanvasClick}
        className="w-full h-full block cursor-crosshair"
        style={{ display: 'block', background: '#080c14' }}
      />

      {/* Floating Tactical Legend Overlay */}
      <div 
        className="absolute top-3 left-3 px-3 py-2 rounded-lg text-xs font-mono flex flex-wrap gap-4 items-center pointer-events-none"
        style={{
          background: 'rgba(9, 13, 22, 0.88)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(51, 65, 85, 0.7)'
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
          <span className="text-slate-300">Ambulance (ALS/BLS)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-orange-500"></span>
          <span className="text-slate-300">Fire Engine (Pumper/Aerial)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-400"></span>
          <span className="text-slate-300">Hospital Med-Zone</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
          <span className="text-slate-300">V2X Road Closure</span>
        </div>
      </div>
    </div>
  );
}

export default React.memo(MapCanvasComponent);
