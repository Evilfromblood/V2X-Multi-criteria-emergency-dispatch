import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';

const PADDING = 55;
const WORLD_SIZE = 13.0; // km

function MapCanvasComponent({ 
  telemetry, 
  onMapClick, 
  onSelectSegment, 
  selectedSegment,
  focusedVehicleId,
  onFocusVehicle 
}) {
  const canvasRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const lastTimeRef = useRef(performance.now());

  // Cached off-screen canvas for static grid, roads, and zone boundaries
  const offscreenCanvasRef = useRef(null);
  const offscreenDirtyRef = useRef(true);

  // Cached node dictionary to avoid reallocating every frame
  const nodeMapRef = useRef(new Map());

  // Position interpolation state for smooth movement
  const vehiclePosMapRef = useRef(new Map());
  const animOffsetRef = useRef(0);

  // Coordinate transformation helpers
  const getScreenCoords = useCallback((kmX, kmY, width, height) => {
    const sx = PADDING + ((kmX - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING);
    const sy = height - (PADDING + ((kmY - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING));
    return { sx, sy };
  }, []);

  // Update node map whenever telemetry.network.nodes updates
  useEffect(() => {
    if (telemetry && telemetry.network && telemetry.network.nodes) {
      const map = nodeMapRef.current;
      map.clear();
      telemetry.network.nodes.forEach((n) => {
        map.set(n.id, n);
      });
      offscreenDirtyRef.current = true;
    }
  }, [telemetry?.network?.nodes]);

  // Mark offscreen background dirty if segments or layout change
  useEffect(() => {
    offscreenDirtyRef.current = true;
  }, [telemetry?.network?.segments]);

  // 1. Off-screen Background Renderer: Render static grid, zones, and standard roads ONCE
  const renderStaticBackground = useCallback((offscreenCtx, width, height) => {
    // Fill canvas background
    offscreenCtx.fillStyle = '#080c14';
    offscreenCtx.fillRect(0, 0, width, height);

    // Tactical Coordinate Grid
    offscreenCtx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
    offscreenCtx.lineWidth = 1;
    const gridStep = 45;

    for (let x = 0; x <= width; x += gridStep) {
      offscreenCtx.beginPath();
      offscreenCtx.moveTo(x, 0);
      offscreenCtx.lineTo(x, height);
      offscreenCtx.stroke();
    }
    for (let y = 0; y <= height; y += gridStep) {
      offscreenCtx.beginPath();
      offscreenCtx.moveTo(0, y);
      offscreenCtx.lineTo(width, y);
      offscreenCtx.stroke();
    }

    // Coordinate tick labels on edges
    offscreenCtx.fillStyle = '#475569';
    offscreenCtx.font = '9px JetBrains Mono';
    for (let km = 1; km <= 13; km += 2) {
      const sx = PADDING + ((km - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING);
      const sy = height - (PADDING + ((km - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING));
      offscreenCtx.fillText(`${km}km`, sx - 10, height - 12);
      offscreenCtx.fillText(`${km}km`, 12, sy + 3);
    }

    const nodeMap = nodeMapRef.current;

    // Tactical Zones (Hospital Trauma Perimeter & Base HQ Perimeter)
    nodeMap.forEach((n) => {
      const sx = PADDING + ((n.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING);
      const sy = height - (PADDING + ((n.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING));

      if (n.type === 'HOSPITAL') {
        offscreenCtx.beginPath();
        offscreenCtx.arc(sx, sy, 62, 0, Math.PI * 2);
        offscreenCtx.fillStyle = 'rgba(13, 148, 136, 0.08)';
        offscreenCtx.fill();
        offscreenCtx.strokeStyle = 'rgba(20, 184, 166, 0.35)';
        offscreenCtx.lineWidth = 1.5;
        offscreenCtx.setLineDash([4, 4]);
        offscreenCtx.stroke();
        offscreenCtx.setLineDash([]);

        offscreenCtx.fillStyle = 'rgba(45, 212, 191, 0.6)';
        offscreenCtx.font = 'bold 9px JetBrains Mono';
        offscreenCtx.fillText('CENTRAL HOSPITAL TRAUMA ZONE', sx - 80, sy - 68);
      } else if (n.type === 'STATION') {
        offscreenCtx.beginPath();
        offscreenCtx.arc(sx, sy, 50, 0, Math.PI * 2);
        offscreenCtx.fillStyle = 'rgba(37, 99, 235, 0.08)';
        offscreenCtx.fill();
        offscreenCtx.strokeStyle = 'rgba(59, 130, 246, 0.35)';
        offscreenCtx.lineWidth = 1.5;
        offscreenCtx.setLineDash([4, 4]);
        offscreenCtx.stroke();
        offscreenCtx.setLineDash([]);

        offscreenCtx.fillStyle = 'rgba(96, 165, 250, 0.6)';
        offscreenCtx.font = 'bold 9px JetBrains Mono';
        offscreenCtx.fillText('HQ DISPATCH DEPOT', sx - 50, sy - 56);
      }
    });

    // Static Base Road Segments
    if (telemetry?.network?.segments) {
      telemetry.network.segments.forEach((seg) => {
        const from = nodeMap.get(seg.from);
        const to = nodeMap.get(seg.to);
        if (!from || !to) return;

        const x1 = PADDING + ((from.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING);
        const y1 = height - (PADDING + ((from.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING));
        const x2 = PADDING + ((to.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING);
        const y2 = height - (PADDING + ((to.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING));

        offscreenCtx.beginPath();
        offscreenCtx.moveTo(x1, y1);
        offscreenCtx.lineTo(x2, y2);
        offscreenCtx.strokeStyle = 'rgba(51, 65, 85, 0.65)';
        offscreenCtx.lineWidth = 2.5;
        offscreenCtx.stroke();
      });
    }

    // Intersections (Nodes)
    nodeMap.forEach((n) => {
      const sx = PADDING + ((n.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING);
      const sy = height - (PADDING + ((n.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING));

      offscreenCtx.beginPath();
      if (n.type === 'HOSPITAL') {
        offscreenCtx.arc(sx, sy, 11, 0, Math.PI * 2);
        offscreenCtx.fillStyle = '#0f766e';
        offscreenCtx.fill();
        offscreenCtx.strokeStyle = '#14b8a6';
        offscreenCtx.lineWidth = 2.5;
        offscreenCtx.stroke();

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
        offscreenCtx.fillText('HQ', sx - 6, sy + 3);
      } else {
        offscreenCtx.arc(sx, sy, 5.5, 0, Math.PI * 2);
        offscreenCtx.fillStyle = '#1e293b';
        offscreenCtx.fill();
        offscreenCtx.strokeStyle = '#64748b';
        offscreenCtx.lineWidth = 1.5;
        offscreenCtx.stroke();
      }

      offscreenCtx.fillStyle = '#94a3b8';
      offscreenCtx.font = '10px JetBrains Mono';
      offscreenCtx.fillText(n.id, sx + 9, sy + 12);
    });
  }, [telemetry?.network]);

  // 2. High-Performance Render Loop: only redraw dynamic layers at 60 FPS
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

      const dt = Math.min(0.1, (now - lastTimeRef.current) / 1000);
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

      // 1. FAST BLIT: draw pre-rendered static layer
      ctx.drawImage(offscreenCanvasRef.current, 0, 0);

      const nodeMap = nodeMapRef.current;

      // 2. Dynamic Road Hazards & Congestion Overlays
      if (telemetry?.network?.segments) {
        const segments = telemetry.network.segments;
        for (let i = 0; i < segments.length; ++i) {
          const seg = segments[i];
          if (!seg.isBlocked && seg.congestionMultiplier <= 1.5 && (!selectedSegment || 
              (selectedSegment.from !== seg.from && selectedSegment.to !== seg.to &&
               selectedSegment.from !== seg.to && selectedSegment.to !== seg.from))) {
            continue; // Standard road already drawn in static layer!
          }

          const from = nodeMap.get(seg.from);
          const to = nodeMap.get(seg.to);
          if (!from || !to) continue;

          const x1 = PADDING + ((from.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING);
          const y1 = height - (PADDING + ((from.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING));
          const x2 = PADDING + ((to.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING);
          const y2 = height - (PADDING + ((to.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING));

          const isSelected = selectedSegment && 
            ((selectedSegment.from === seg.from && selectedSegment.to === seg.to) ||
             (selectedSegment.from === seg.to && selectedSegment.to === seg.from));

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);

          if (seg.isBlocked) {
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = isSelected ? 6 : 4;
            ctx.setLineDash([10, 6]);
            ctx.stroke();
            ctx.setLineDash([]);

            const mx = (x1 + x2) * 0.5;
            const my = (y1 + y2) * 0.5;

            ctx.beginPath();
            ctx.arc(mx, my, 9, 0, Math.PI * 2);
            ctx.fillStyle = '#dc2626';
            ctx.fill();
            ctx.strokeStyle = '#fca5a5';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px monospace';
            ctx.fillText('✕', mx - 3, my + 3.5);

            ctx.beginPath();
            ctx.arc(mx, my, 9 + tPulse * 8, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(239, 68, 68, ${1 - tPulse})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          } else if (seg.congestionMultiplier > 1.5) {
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = isSelected ? 6 : 3.5;
            ctx.stroke();

            const mx = (x1 + x2) * 0.5;
            const my = (y1 + y2) * 0.5;
            ctx.beginPath();
            ctx.arc(mx, my, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#f59e0b';
            ctx.fill();
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 8px JetBrains Mono';
            ctx.fillText(`x${seg.congestionMultiplier.toFixed(1)}`, mx - 9, my - 8);
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
                const sx = PADDING + ((node.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING);
                const sy = height - (PADDING + ((node.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING));
                if (!started) {
                  ctx.moveTo(sx, sy);
                  started = true;
                } else {
                  ctx.lineTo(sx, sy);
                }
              }
            }

            ctx.strokeStyle = isAmbulance 
              ? (isFocused ? 'rgba(6, 182, 212, 0.9)' : 'rgba(6, 182, 212, 0.45)')
              : (isFocused ? 'rgba(249, 115, 22, 0.9)' : 'rgba(249, 115, 22, 0.45)');
            ctx.lineWidth = isFocused ? 5 : 3.5;
            ctx.setLineDash([8, 8]);
            ctx.lineDashOffset = -animOffsetRef.current * 0.8;
            ctx.stroke();

            ctx.setLineDash([]);
            ctx.lineDashOffset = 0;
          }
        }
      }

      // 4. Dynamic Active Emergency Incidents
      if (telemetry?.incidents) {
        const incidents = telemetry.incidents;
        for (let i = 0; i < incidents.length; ++i) {
          const inc = incidents[i];
          if (inc.status === 'RESOLVED') continue;

          const ix = PADDING + ((inc.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING);
          const iy = height - (PADDING + ((inc.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING));
          const isHighSeverity = inc.severity >= 4;

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
          ctx.fillText(`L${inc.severity}`, ix - 6, iy + 3.5);

          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 11px Plus Jakarta Sans';
          ctx.fillText(inc.id, ix + 16, iy - 4);
          ctx.fillStyle = isHighSeverity ? '#fca5a5' : '#fde68a';
          ctx.font = '9px JetBrains Mono';
          ctx.fillText(`${inc.type} [${inc.status}]`, ix + 16, iy + 9);
        }
      }

      // 5. Dynamic Fleet Movement with Frame-Rate Independent Exponential Smoothing
      if (telemetry?.fleet) {
        const fleet = telemetry.fleet;
        const posMap = vehiclePosMapRef.current;
        // Exponential smoothing factor: 1 - exp(-k * dt)
        const factor = 1 - Math.exp(-9 * dt);

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

          const vx = PADDING + ((currentPos.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING);
          const vy = height - (PADDING + ((currentPos.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING));

          const isAmbulance = v.type === 'AMBULANCE';
          const isOnScene = v.state === 'ON_SCENE';
          const isFocused = focusedVehicleId === v.id;

          // Focus indicator ring & reticle
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

            // Crosshair ticks
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
          ctx.arc(vx, vy, isOnScene ? 15 : 12, 0, Math.PI * 2);
          ctx.fillStyle = isOnScene 
            ? 'rgba(239, 68, 68, 0.45)' 
            : isAmbulance 
              ? 'rgba(6, 182, 212, 0.35)' 
              : 'rgba(249, 115, 22, 0.35)';
          ctx.fill();

          // Core Badge
          ctx.beginPath();
          ctx.arc(vx, vy, 8, 0, Math.PI * 2);
          ctx.fillStyle = isAmbulance ? '#06b6d4' : '#ea580c';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Directional Heading Indicator
          if (v.state === 'EN_ROUTE_INCIDENT' || v.state === 'TRANSPORTING_HOSPITAL' || v.state === 'RETURNING_TO_BASE') {
            const headingScreen = -currentPos.heading;
            const arrowDist = 13;
            const ax = vx + Math.cos(headingScreen) * arrowDist;
            const ay = vy + Math.sin(headingScreen) * arrowDist;

            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(
              ax - Math.cos(headingScreen - 0.4) * 6,
              ay - Math.sin(headingScreen - 0.4) * 6
            );
            ctx.lineTo(
              ax - Math.cos(headingScreen + 0.4) * 6,
              ay - Math.sin(headingScreen + 0.4) * 6
            );
            ctx.closePath();
            ctx.fillStyle = isAmbulance ? '#22d3ee' : '#fb923c';
            ctx.fill();
          }

          // ID Tag
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px JetBrains Mono';
          ctx.fillText(v.id, vx + 12, vy - 2);

          // State Pill
          let stateColor = '#94a3b8';
          if (v.state === 'ON_SCENE') stateColor = '#f87171';
          else if (v.state === 'EN_ROUTE_INCIDENT') stateColor = '#38bdf8';
          else if (v.state === 'TRANSPORTING_HOSPITAL') stateColor = '#c084fc';
          else if (v.state === 'RETURNING_TO_BASE') stateColor = '#2dd4bf';
          else if (v.state === 'IDLE_STATION') stateColor = '#34d399';

          ctx.fillStyle = stateColor;
          ctx.font = '8px Plus Jakarta Sans';
          ctx.fillText(v.state, vx + 12, vy + 9);
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
        const vx = PADDING + ((v.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING);
        const vy = height - (PADDING + ((v.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING));
        const dist = Math.hypot(px - vx, py - vy);
        if (dist <= 18) {
          onFocusVehicle(v.id);
          return;
        }
      }
    }

    // 2. Check if clicked near an edge (road segment)
    const nodeMap = nodeMapRef.current;
    const segments = telemetry.network.segments || [];

    let clickedSegment = null;
    let minSegDist = 16;

    for (let i = 0; i < segments.length; ++i) {
      const seg = segments[i];
      const from = nodeMap.get(seg.from);
      const to = nodeMap.get(seg.to);
      if (!from || !to) continue;

      const x1 = PADDING + ((from.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING);
      const y1 = height - (PADDING + ((from.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING));
      const x2 = PADDING + ((to.x - 1.0) / (WORLD_SIZE - 1.0)) * (width - 2 * PADDING);
      const y2 = height - (PADDING + ((to.y - 1.0) / (WORLD_SIZE - 1.0)) * (height - 2 * PADDING));

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

    if (clickedSegment && onSelectSegment) {
      onSelectSegment(clickedSegment);
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
          background: 'rgba(9, 13, 22, 0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(51, 65, 85, 0.7)'
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
          <span className="text-slate-300">Ambulance (ALS/BLS)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
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
