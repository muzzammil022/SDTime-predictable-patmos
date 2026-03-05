import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  CodeRunnerResponse,
  PatmosStats,
} from "@/lib/types";
import {
  computePatmosTiming,
  computeNormalTiming,
  AVOIDANCE_TASK,
  NOOP_TASK,
  PATMOS,
  NORMAL_CPU,
  type TimingResult,
  type TaskProfile,
} from "@/lib/timing-model";
import { SAMPLE_CODES } from "@/lib/sample-code";

// ── Types ─────────────────────────────────────────────────────────

type ObjType = "car" | "suv" | "truck" | "pedestrian" | "cyclist" | "cone" | "barrier";
type ThreatLevel = "HIGH" | "MED" | "LOW";

interface SceneObject {
  id: string;
  type: ObjType;
  lane: number;       // -2..2 (fractional for smooth drift)
  dist: number;       // 0..MAX_DIST
  speed: number;      // relative approach speed
  threatLevel: ThreatLevel;
  color: string;
  wobble: number;
  // Real timing data per object:
  detected: boolean;         // entered detection range
  patmosTiming: TimingResult | null;  // Patmos reaction timing
  cpuTiming: TimingResult | null;     // Normal CPU reaction timing
  patmosReacted: boolean;    // Patmos reacted in time
  cpuReacted: boolean;       // CPU reacted in time
  cpuMissed: boolean;        // CPU missed deadline
  detectedAtDist: number;    // distance when first detected
}

interface DetectionEvent {
  id: string;
  type: ObjType;
  dist: number;
  patmosCycles: number;
  cpuCycles: number;
  patmosDeadlineMet: boolean;
  cpuDeadlineMet: boolean;
  cpuBreakdown: { base: number; cache: number; branch: number; os: number };
  timestamp: number;
}

// ── Constants ─────────────────────────────────────────────────────

const OBJ_TYPES: ObjType[] = ["car", "suv", "truck", "pedestrian", "cyclist", "cone", "barrier"];
const TYPE_WEIGHTS = [0.28, 0.18, 0.12, 0.14, 0.1, 0.1, 0.08];
const CAR_COLORS = ["#3a7bd5", "#e74c3c", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c", "#ecf0f1", "#34495e", "#e67e22", "#95a5a6"];
const THREAT_COLORS: Record<ThreatLevel, string> = { HIGH: "#ff4757", MED: "#ffa502", LOW: "#2ed573" };
const MAX_DIST = 350;
const MAX_OBJECTS = 10;
const MAX_EVENTS = 60;
const MAX_SPARK = 220;
const DETECTION_DIST = 180; // distance at which we trigger timing computation
const LANES = [-1.6, -0.8, 0, 0.8, 1.6];

let _oid = 0;
const rid = () => { _oid++; return _oid.toString(16).toUpperCase().padStart(4, "0"); };
const fmt = (n: number) => n.toLocaleString();
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const pickWeighted = <T,>(items: T[], weights: number[]): T => {
  const r = Math.random();
  let sum = 0;
  for (let i = 0; i < items.length; i++) { sum += weights[i]; if (r < sum) return items[i]; }
  return items[items.length - 1];
};

function getAvoidanceCode(): string {
  const sample = SAMPLE_CODES.find((s) => s.name === "Obstacle Avoidance");
  return sample?.code ?? "";
}

// ══════════════════════════════════════════════════════════════════
// ── Component ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

export default function RadarDashboard() {
  const [running, setRunning] = useState(true);
  const [egoSpeed, setEgoSpeed] = useState(50);

  // Real benchmark state
  const [benchResult, setBenchResult] = useState<CodeRunnerResponse | null>(null);
  const [benchError, setBenchError] = useState<string | null>(null);
  const [benchmarking, setBenchmarking] = useState(false);

  // Simulation state synced to React (10fps)
  const [objects, setObjects] = useState<SceneObject[]>([]);
  const [events, setEvents] = useState<DetectionEvent[]>([]);
  const [frameCount, setFrameCount] = useState(0);
  const [patmosHist, setPatmosHist] = useState<number[]>([]);
  const [cpuHist, setCpuHist] = useState<number[]>([]);

  // Aggregated stats
  const [totalDetected, setTotalDetected] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparkRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  // Mutable simulation state (never stale in RAF)
  const simRef = useRef({
    objects: [] as SceneObject[],
    events: [] as DetectionEvent[],
    frameCount: 0,
    elapsed: 0,
    lastSync: 0,
    roadOffset: 0,
    spawnCd: 0,
    patmosHist: [] as number[],
    cpuHist: [] as number[],
    totalDetected: 0,
    patmosAvoided: 0,
    cpuAvoided: 0,
    cpuMissed: 0,
  });

  const runRef = useRef(running);
  const speedRef = useRef(egoSpeed);
  useEffect(() => { runRef.current = running; }, [running]);
  useEffect(() => { speedRef.current = egoSpeed; }, [egoSpeed]);

  // Real PASIM data reference
  const realPasimCycles = useRef(0);
  const realPasimStats = useRef<PatmosStats | null>(null);

  useEffect(() => {
    if (benchResult?.pasim?.stats) {
      realPasimCycles.current = benchResult.pasim.stats.cycles;
      realPasimStats.current = benchResult.pasim.stats;
    }
  }, [benchResult]);

  // ── Benchmark ──────────────────────────────────────────────

  const runBenchmark = useCallback(async () => {
    setBenchmarking(true);
    setBenchError(null);
    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: getAvoidanceCode(),
          mode: "both",
          timeout: 60,
          run_gcc: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        setBenchError(err.error || `HTTP ${res.status}`);
        return;
      }
      const data: CodeRunnerResponse = await res.json();
      setBenchResult(data);
      if (!data.success) setBenchError("Benchmark failed — check backend");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Network error";
      setBenchError(msg.includes("fetch") ? "Cannot reach backend. Run: docker compose up" : msg);
    } finally {
      setBenchmarking(false);
    }
  }, []);

  // Auto-run benchmark on mount
  useEffect(() => { runBenchmark(); }, [runBenchmark]);

  // ── Timing computation for each detected object ────────────

  const computeObjectTiming = useCallback((obj: SceneObject): { patmos: TimingResult; cpu: TimingResult } => {
    // Use the correct task profile based on threat level
    const task: TaskProfile = obj.threatLevel === "LOW" ? NOOP_TASK : AVOIDANCE_TASK;

    let patmos: TimingResult;
    if (realPasimCycles.current > 0 && task === AVOIDANCE_TASK) {
      // Use REAL pasim data
      const cycles = realPasimCycles.current;
      patmos = {
        cycles,
        wcet: cycles,
        bcet: cycles,
        jitter: 0,
        executionTimeUs: cycles / PATMOS.clockMHz,
        deadlineMet: cycles <= task.deadline_cycles,
        marginCycles: task.deadline_cycles - cycles,
        breakdown: { base: cycles, cachePenalty: 0, branchPenalty: 0, osPenalty: 0 },
      };
    } else {
      patmos = computePatmosTiming(task);
    }

    const cpu = computeNormalTiming(task);

    return { patmos, cpu };
  }, []);

  // ── WS (optional) ──────────────────────────────────────────

  const [wsUrl, setWsUrl] = useState("ws://localhost:8080/ws");
  const [wsOpen, setWsOpen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const connectWs = useCallback(() => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => setWsConnected(true);
    ws.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data);
        if (d.patmos_cycles != null) realPasimCycles.current = d.patmos_cycles;
      } catch { /* ignore */ }
    };
    ws.onclose = () => { setWsConnected(false); wsRef.current = null; };
    ws.onerror = () => ws.close();
  }, [wsUrl]);
  const disconnectWs = useCallback(() => { wsRef.current?.close(); wsRef.current = null; setWsConnected(false); }, []);

  // ── Main loop ──────────────────────────────────────────────

  useEffect(() => {
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      const s = simRef.current;

      if (runRef.current) {
        s.elapsed += dt;
        s.frameCount++;
        s.roadOffset = (s.roadOffset + speedRef.current * 0.6 * dt) % 40;

        // ── Spawn ──
        s.spawnCd -= dt;
        if (s.objects.length < MAX_OBJECTS && s.spawnCd <= 0) {
          s.spawnCd = 0.5 + Math.random() * 1.5;
          const type = pickWeighted(OBJ_TYPES, TYPE_WEIGHTS);
          const lane = LANES[Math.floor(Math.random() * LANES.length)];
          const spd = type === "pedestrian" ? 8 + Math.random() * 15
            : type === "cyclist" ? 15 + Math.random() * 25
            : type === "cone" || type === "barrier" ? 25 + Math.random() * 10
            : 20 + Math.random() * 50;
          s.objects.push({
            id: rid(), type, lane,
            dist: MAX_DIST + 20 + Math.random() * 30,
            speed: spd,
            threatLevel: "LOW",
            color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
            wobble: Math.random() * Math.PI * 2,
            detected: false,
            patmosTiming: null,
            cpuTiming: null,
            patmosReacted: false,
            cpuReacted: false,
            cpuMissed: false,
            detectedAtDist: 0,
          });
        }

        // ── Update objects ──
        const alive: SceneObject[] = [];
        for (const obj of s.objects) {
          obj.dist -= obj.speed * dt;
          obj.wobble += dt * 1.5;
          if (obj.type !== "cone" && obj.type !== "barrier") {
            obj.lane += Math.sin(obj.wobble) * 0.001;
          }
          obj.threatLevel = obj.dist < 70 ? "HIGH" : obj.dist < 150 ? "MED" : "LOW";

          // ── Detection: compute real timing when object enters range ──
          if (!obj.detected && obj.dist <= DETECTION_DIST && obj.dist > 0) {
            obj.detected = true;
            obj.detectedAtDist = obj.dist;
            s.totalDetected++;

            const { patmos, cpu } = computeObjectTiming(obj);
            obj.patmosTiming = patmos;
            obj.cpuTiming = cpu;

            // Patmos always meets deadline (deterministic)
            obj.patmosReacted = patmos.deadlineMet;
            if (patmos.deadlineMet) s.patmosAvoided++;

            // CPU may miss deadline due to jitter
            obj.cpuReacted = cpu.deadlineMet;
            if (cpu.deadlineMet) {
              s.cpuAvoided++;
            } else {
              s.cpuMissed++;
              obj.cpuMissed = true;
            }

            // Record event
            s.events = [{
              id: obj.id,
              type: obj.type,
              dist: Math.floor(obj.dist),
              patmosCycles: patmos.cycles,
              cpuCycles: cpu.cycles,
              patmosDeadlineMet: patmos.deadlineMet,
              cpuDeadlineMet: cpu.deadlineMet,
              cpuBreakdown: {
                base: cpu.breakdown.base,
                cache: cpu.breakdown.cachePenalty,
                branch: cpu.breakdown.branchPenalty,
                os: cpu.breakdown.osPenalty,
              },
              timestamp: s.elapsed,
            }, ...s.events].slice(0, MAX_EVENTS);

            // Record to sparkline history
            s.patmosHist = [...s.patmosHist, patmos.cycles].slice(-MAX_SPARK);
            s.cpuHist = [...s.cpuHist, cpu.cycles].slice(-MAX_SPARK);
          }

          // Remove objects that passed
          if (obj.dist < -10) continue;
          alive.push(obj);
        }
        s.objects = alive;
      }

      drawScene(s, dt);
      drawSpark(s);

      // Sync to React at ~10fps
      if (now - s.lastSync > 100) {
        s.lastSync = now;
        setObjects([...s.objects]);
        setEvents([...s.events]);
        setFrameCount(s.frameCount);
        setPatmosHist([...s.patmosHist]);
        setCpuHist([...s.cpuHist]);
        setTotalDetected(s.totalDetected);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafRef.current); wsRef.current?.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ══════════════════════════════════════════════════════════════
  // ── Draw Scene ─────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════

  const drawScene = useCallback((s: typeof simRef.current, _dt: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (!W || !H) return;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const horizon = H * 0.32;
    const roadBase = H;
    const vpX = W / 2;
    const roadHalfW = W * 0.44;

    const project = (dist: number, lane: number) => {
      const t = clamp(dist / MAX_DIST, 0, 1);
      const y = lerp(roadBase, horizon, t);
      const halfW = lerp(roadHalfW, 2, t);
      const x = vpX + lane * halfW * 0.35;
      const scale = lerp(1, 0.08, t);
      return { x, y, scale, halfW };
    };

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, "#020810");
    sky.addColorStop(0.5, "#061220");
    sky.addColorStop(1, "#0a1a2f");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizon);

    // Horizon glow
    const hGlow = ctx.createRadialGradient(vpX, horizon, 0, vpX, horizon, W * 0.5);
    hGlow.addColorStop(0, "#1a3a5c30");
    hGlow.addColorStop(1, "transparent");
    ctx.fillStyle = hGlow;
    ctx.fillRect(0, horizon * 0.5, W, horizon);

    // Road
    const road = ctx.createLinearGradient(0, horizon, 0, roadBase);
    road.addColorStop(0, "#111820");
    road.addColorStop(0.3, "#151c25");
    road.addColorStop(1, "#0e151d");
    ctx.fillStyle = road;
    ctx.beginPath();
    const farL = project(MAX_DIST, -2.5);
    const farR = project(MAX_DIST, 2.5);
    const nearL = project(0, -2.5);
    const nearR = project(0, 2.5);
    ctx.moveTo(nearL.x, nearL.y);
    ctx.lineTo(farL.x, farL.y);
    ctx.lineTo(farR.x, farR.y);
    ctx.lineTo(nearR.x, nearR.y);
    ctx.closePath();
    ctx.fill();

    // Road edges
    ctx.strokeStyle = "#ffffff18";
    ctx.lineWidth = 2;
    for (const edge of [-2.2, 2.2]) {
      ctx.beginPath();
      for (let d = 0; d <= MAX_DIST; d += 3) {
        const p = project(d, edge);
        d === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    // Lane dashes
    const dashLen = 12, gapLen = 28, cycle = dashLen + gapLen;
    for (const lane of [-1.1, 0, 1.1]) {
      ctx.strokeStyle = "#ffffff10";
      ctx.lineWidth = 1.5;
      for (let d = -s.roadOffset % cycle; d < MAX_DIST; d += cycle) {
        const d0 = Math.max(d, 0), d1 = Math.min(d + dashLen, MAX_DIST);
        if (d1 <= d0) continue;
        const p0 = project(d0, lane), p1 = project(d1, lane);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      }
    }

    // Detection zone highlight
    const dzNear = project(0, -2.5);
    const dzFar = project(DETECTION_DIST, -2.5);
    const dzFarR = project(DETECTION_DIST, 2.5);
    const dzNearR = project(0, 2.5);
    ctx.fillStyle = "#58a6ff06";
    ctx.beginPath();
    ctx.moveTo(dzNear.x, dzNear.y);
    ctx.lineTo(dzFar.x, dzFar.y);
    ctx.lineTo(dzFarR.x, dzFarR.y);
    ctx.lineTo(dzNearR.x, dzNearR.y);
    ctx.closePath();
    ctx.fill();

    // Detection boundary line
    const dbL = project(DETECTION_DIST, -2.5), dbR = project(DETECTION_DIST, 2.5);
    ctx.strokeStyle = "#58a6ff30";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(dbL.x, dbL.y); ctx.lineTo(dbR.x, dbR.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#58a6ff40";
    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`DETECTION ZONE ${DETECTION_DIST}m`, (dbL.x + dbR.x) / 2, dbL.y - 4);

    // Distance grid
    for (let d = 50; d <= 300; d += 50) {
      const pL = project(d, -2.8), pR = project(d, 2.8);
      ctx.strokeStyle = "#ffffff06"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pL.x, pL.y); ctx.lineTo(pR.x, pR.y); ctx.stroke();
      ctx.fillStyle = "#ffffff15"; ctx.font = "9px monospace"; ctx.textAlign = "right";
      ctx.fillText(`${d}m`, pL.x - 6, pL.y + 3);
    }

    // Scan sweep
    const scanDist = ((s.elapsed * 80) % MAX_DIST);
    const scanP = project(scanDist, 0);
    const scanGrad = ctx.createLinearGradient(0, scanP.y - 6, 0, scanP.y + 6);
    scanGrad.addColorStop(0, "transparent");
    scanGrad.addColorStop(0.5, "#2ed57318");
    scanGrad.addColorStop(1, "transparent");
    ctx.fillStyle = scanGrad;
    ctx.fillRect(0, scanP.y - 6, W, 12);

    // Sort back-to-front
    const sorted = [...s.objects].sort((a, b) => b.dist - a.dist);

    // Collect label rects for collision avoidance
    const usedLabelRects: { x: number; y: number; w: number; h: number }[] = [];
    const labelFits = (x: number, y: number, w: number, h: number) => {
      for (const r of usedLabelRects) {
        if (x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y) return false;
      }
      return true;
    };

    for (const obj of sorted) {
      const p = project(obj.dist, obj.lane);
      const sc = p.scale;
      if (sc < 0.03) continue;

      ctx.save();
      ctx.translate(p.x, p.y);

      const threat = obj.threatLevel === "HIGH";
      const med = obj.threatLevel === "MED";

      // Threat bounding box
      if (threat || med) {
        const boxW = (obj.type === "truck" ? 50 : obj.type === "barrier" ? 55 : 34) * sc;
        const boxH = (obj.type === "truck" ? 70 : obj.type === "barrier" ? 18 : 50) * sc;
        ctx.strokeStyle = threat ? "#ff475740" : "#ffa50220";
        ctx.lineWidth = threat ? 2 : 1;
        const cx2 = boxW / 2, cy2 = boxH / 2, corner = Math.min(6, boxW * 0.3);
        ctx.beginPath();
        ctx.moveTo(-cx2, -cy2 + corner); ctx.lineTo(-cx2, -cy2); ctx.lineTo(-cx2 + corner, -cy2);
        ctx.moveTo(cx2 - corner, -cy2); ctx.lineTo(cx2, -cy2); ctx.lineTo(cx2, -cy2 + corner);
        ctx.moveTo(cx2, cy2 - corner); ctx.lineTo(cx2, cy2); ctx.lineTo(cx2 - corner, cy2);
        ctx.moveTo(-cx2 + corner, cy2); ctx.lineTo(-cx2, cy2); ctx.lineTo(-cx2, cy2 - corner);
        ctx.stroke();
        if (threat) { ctx.shadowColor = "#ff4757"; ctx.shadowBlur = 12 * sc; }
      }

      // Draw object
      drawObject(ctx, obj, sc, s.elapsed);

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;

      // Labels — compact: distance + cycles only, with collision avoidance
      if (sc > 0.15) {
        const fontSize = Math.max(8, 9 * sc / 0.3);
        const labelY = obj.type === "barrier" ? -10 * sc : -24 * sc;
        const labelH = obj.detected && obj.patmosTiming && sc > 0.22 ? fontSize * 2.2 : fontSize * 1.2;
        const labelW = 60 * sc;

        // Check in world coords (p.x, p.y + labelY)
        const worldX = p.x - labelW / 2;
        const worldY = p.y + labelY - fontSize;

        if (labelFits(worldX, worldY, labelW, labelH)) {
          usedLabelRects.push({ x: worldX, y: worldY, w: labelW, h: labelH });

          ctx.textAlign = "center";
          ctx.fillStyle = "#ffffff40";
          ctx.font = `${fontSize}px monospace`;
          ctx.fillText(`${Math.floor(obj.dist)}m`, 0, labelY);

          // Cycle counts for detected objects — single compact line
          if (obj.detected && obj.patmosTiming && obj.cpuTiming && sc > 0.22) {
            const cy = labelY + Math.max(10, 12 * sc / 0.3);
            ctx.font = `${Math.max(7, 8 * sc / 0.3)}px monospace`;
            ctx.fillStyle = "#2ed57390";
            ctx.fillText(`P:${obj.patmosTiming.cycles}`, -16 * sc, cy);
            ctx.fillStyle = "#ff975790";
            ctx.fillText(`C:${obj.cpuTiming.cycles}`, 16 * sc, cy);
          }
        }
      }

      ctx.restore();
    }

    // Ego vehicle
    ctx.save();
    ctx.translate(vpX, H - 30);
    ctx.fillStyle = "#00000050";
    roundRect(ctx, -12, -23, 28, 50, 5); ctx.fill();
    ctx.fillStyle = "#2ed573";
    roundRect(ctx, -14, -25, 28, 50, 5); ctx.fill();
    ctx.fillStyle = "#00000060";
    roundRect(ctx, -10, -15, 20, 10, 3); ctx.fill();
    ctx.fillStyle = "#00000040";
    roundRect(ctx, -8, 10, 16, 7, 2); ctx.fill();
    const hlGlow = ctx.createRadialGradient(0, -45, 0, 0, -45, 60);
    hlGlow.addColorStop(0, "#2ed57315"); hlGlow.addColorStop(1, "transparent");
    ctx.fillStyle = hlGlow;
    ctx.fillRect(-80, -105, 160, 80);
    ctx.restore();

    // HUD
    const hasBench = realPasimCycles.current > 0;
    ctx.fillStyle = hasBench ? "#58a6ffcc" : "#ffa502cc";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "left";
    ctx.fillText(hasBench ? "T-CREST \u00B7 PASIM (REAL DATA)" : "T-CREST \u00B7 TIMING MODEL", 14, 22);
    ctx.fillStyle = "#ffffff30";
    ctx.font = "9px monospace";
    ctx.fillText(hasBench
      ? `WCET: ${fmt(realPasimCycles.current)} cycles \u00B7 ${realPasimStats.current?.instructions ?? "?"} instructions`
      : "Run benchmark to get real PASIM data...", 14, 36);

    // Fog
    const fog = ctx.createLinearGradient(0, horizon - 20, 0, horizon + 30);
    fog.addColorStop(0, "#0a1a2f00"); fog.addColorStop(0.5, "#0a1a2f88"); fog.addColorStop(1, "#0a1a2f00");
    ctx.fillStyle = fog;
    ctx.fillRect(0, horizon - 20, W, 50);
  }, []);

  // ── Sparkline ──────────────────────────────────────────────

  const drawSpark = useCallback((s: typeof simRef.current) => {
    const canvas = sparkRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#010409"; ctx.fillRect(0, 0, W, H);

    const all = [...s.patmosHist, ...s.cpuHist];
    if (!all.length) return;
    const maxVal = Math.max(...all, AVOIDANCE_TASK.deadline_cycles);
    const pad = { t: 6, b: 16, l: 6, r: 6 };
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;

    // Deadline line
    const dy = pad.t + ph - (AVOIDANCE_TASK.deadline_cycles / maxVal) * ph;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "#ff475730"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, dy); ctx.lineTo(W - pad.r, dy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#ff475740"; ctx.font = "7px monospace"; ctx.textAlign = "right";
    ctx.fillText(`DEADLINE ${AVOIDANCE_TASK.deadline_cycles}`, W - pad.r, dy - 2);

    const draw = (data: number[], color: string, lw: number) => {
      if (data.length < 2) return;
      ctx.strokeStyle = color; ctx.lineWidth = lw;
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = pad.l + (i / (MAX_SPARK - 1)) * pw;
        const y = pad.t + ph - (v / maxVal) * ph;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    };

    draw(s.cpuHist, "#ff4757", 1);
    draw(s.patmosHist, "#2ed573", 1.5);

    ctx.font = "8px monospace"; ctx.textAlign = "left";
    ctx.fillStyle = "#2ed573";
    ctx.fillText("\u2014 Patmos (bounded)", pad.l, H - 2);
    ctx.fillStyle = "#ff4757";
    ctx.fillText("\u2014 CPU (variable)", pad.l + 100, H - 2);
  }, []);

  // ── Derived values ──

  const hasBench = !!benchResult?.success;
  const pasimCyc = benchResult?.pasim?.stats?.cycles ?? 0;
  const patemuCyc = benchResult?.patemu?.stats?.cycles ?? 0;
  const gccMs = benchResult?.gcc?.wall_time_ms ?? 0;
  const stats = benchResult?.pasim?.stats;

  const sorted = useMemo(() => [...objects].sort((a, b) => a.dist - b.dist), [objects]);

  // ══════════════════════════════════════════════════════════════
  // ── Render ────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-full bg-[#010409] text-[#e6edf3] font-mono select-none overflow-hidden">
      {/* ═══ Top Bar ═══ */}
      <div className="flex items-center h-7 px-4 bg-[#0d1117] border-b border-[#30363d] shrink-0 gap-4">
        <span className="text-[10px] font-bold tracking-[0.15em] text-[#58a6ff]">
          PATMOS RT &middot; AUTONOMOUS MONITOR
        </span>
        <div className="flex-1" />
        <Pill label={hasBench ? "PASIM LIVE" : "MODEL ONLY"} on={hasBench} color={hasBench ? "#2ed573" : "#ffa502"} />
        <Pill label={`${totalDetected} DETECTED`} on={totalDetected > 0} color="#58a6ff" />
      </div>

      {/* ═══ 3 Columns ═══ */}
      <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>

        {/* ─── Left Panel ─── */}
        <div className="w-[230px] shrink-0 flex flex-col border-r border-[#21262d] overflow-y-auto">

          {/* Benchmark */}
          <PS title="REAL PASIM BENCHMARK">
            <button onClick={runBenchmark} disabled={benchmarking}
              className={`w-full py-1.5 text-[9px] font-bold uppercase tracking-wider rounded transition-colors ${
                benchmarking ? "bg-[#21262d] text-[#8b949e] cursor-wait"
                : hasBench ? "bg-[#238636]/20 border border-[#238636] text-[#3fb950] hover:bg-[#238636]/30"
                : "bg-[#238636] text-white hover:bg-[#2ea043]"
              }`}>
              {benchmarking ? "\u23F3 Running on backend\u2026" : hasBench ? "\u21BB Re-run Benchmark" : "\u26A1 Run Benchmark"}
            </button>
            {benchError && (
              <div className="text-[9px] text-[#f85149] bg-[#da3633]/10 border border-[#da3633]/30 rounded p-1.5 mt-1">
                {benchError}
              </div>
            )}
            {hasBench && stats && (
              <div className="mt-1.5 space-y-1">
                <StatRow label="PASIM Cycles" value={fmt(pasimCyc)} color="#58a6ff" bold />
                {patemuCyc > 0 && <StatRow label="PATEMU Cycles" value={fmt(patemuCyc)} color="#d2a8ff" />}
                {gccMs > 0 && <StatRow label="GCC Wall Time" value={`${gccMs < 1 ? "<1" : gccMs.toFixed(1)}ms`} color="#d29922" />}
                <div className="border-t border-[#21262d] pt-1 mt-1">
                  <StatRow label="Instructions" value={fmt(stats.instructions)} />
                  <StatRow label="Bundles (VLIW)" value={fmt(stats.bundles)} />
                  <StatRow label="Cache Hits" value={fmt(stats.cache_hits)} color="#2ed573" />
                  <StatRow label="Cache Misses" value={fmt(stats.cache_misses)} color={stats.cache_misses > 0 ? "#ff4757" : "#2ed573"} />
                  <StatRow label="Method Cache Hits" value={fmt(stats.method_cache_hits)} color="#2ed573" />
                  <StatRow label="Stack Cache Ops" value={fmt(stats.stack_cache_ops)} />
                </div>
              </div>
            )}
            {!hasBench && !benchmarking && !benchError && (
              <div className="text-[8px] text-[#484f58] mt-1">
                Uses timing model until benchmark runs. Start backend with: docker compose up
              </div>
            )}
          </PS>

          {/* Timing Model */}
          <PS title="WHY PATMOS WINS">
            <div className="text-[9px] text-[#8b949e] leading-relaxed space-y-1">
              <div>
                <span className="text-[#58a6ff]">Patmos</span>: T = N×CPI = {hasBench ? `${pasimCyc}` : `${AVOIDANCE_TASK.N_instr}`} cyc
                <span className="text-[#2ed573]"> (WCET=BCET, jitter=0)</span>
              </div>
              <div>
                <span className="text-[#d29922]">CPU</span>: T = base + <span className="text-[#ff4757]">cache</span> + <span className="text-[#ffa502]">branch</span> + <span className="text-[#d2a8ff]">OS</span>
                <span className="text-[#ff4757]"> (varies each run)</span>
              </div>
              <div className="border-t border-[#21262d] pt-1 mt-1 text-[8px] text-[#484f58] space-y-0.5">
                <div>Cache miss rate: {(NORMAL_CPU.cacheMissRate * 100)}% × {NORMAL_CPU.cacheMissPenalty}cyc penalty</div>
                <div>Branch mispredict: {(NORMAL_CPU.branchMispredRate * 100)}% × {NORMAL_CPU.branchFlushPenalty}cyc flush</div>
                <div>OS jitter: {NORMAL_CPU.osJitterRange[0]}–{NORMAL_CPU.osJitterRange[1]} cycles</div>
                <div>Deadline: {AVOIDANCE_TASK.deadline_cycles} cycles</div>
              </div>
            </div>
          </PS>

          {/* Controls */}
          <PS title="CONTROLS">
            <div className="flex items-center gap-2">
              <button onClick={() => setRunning((v) => !v)}
                className={`px-2 py-0.5 text-[9px] rounded border ${running ? "border-[#ff4757] text-[#ff4757]" : "border-[#2ed573] text-[#2ed573]"}`}>
                {running ? "PAUSE" : "RUN"}
              </button>
              <span className="text-[8px] text-[#484f58] tabular-nums w-8">{egoSpeed}</span>
              <input type="range" min={10} max={120} value={egoSpeed}
                onChange={(e) => setEgoSpeed(+e.target.value)} className="flex-1 h-0.5 accent-[#58a6ff]" />
            </div>
          </PS>

          {/* WS */}
          <div className="px-3 py-1.5 border-t border-[#21262d]">
            <button onClick={() => setWsOpen((v) => !v)} className="text-[8px] text-[#484f58] hover:text-[#8b949e] uppercase tracking-wider">
              {wsOpen ? "\u25BC" : "\u25B6"} WebSocket {wsConnected && <span className="text-[#2ed573]">(live)</span>}
            </button>
            {wsOpen && (
              <div className="mt-1 flex gap-1">
                <input className="flex-1 bg-[#0d1117] border border-[#21262d] text-[#e6edf3] text-[9px] px-1 py-0.5 rounded outline-none" value={wsUrl} onChange={(e) => setWsUrl(e.target.value)} disabled={wsConnected} />
                <button onClick={wsConnected ? disconnectWs : connectWs} className={`px-1.5 py-0.5 text-[8px] rounded ${wsConnected ? "bg-[#da3633] text-white" : "bg-[#238636] text-white"}`}>
                  {wsConnected ? "\u00D7" : "Go"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ─── Center Canvas ─── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <canvas ref={canvasRef} className="flex-1" style={{ display: "block", width: "100%", minHeight: 0 }} />
        </div>

        {/* ─── Right Panel ─── */}
        <div className="w-[240px] shrink-0 flex flex-col border-l border-[#21262d] overflow-y-auto">

          {/* Detected Objects */}
          <PS title="SCENE OBJECTS">
            <div className="space-y-0.5">
              {sorted.length === 0 && <div className="text-[9px] text-[#484f58] italic">No objects</div>}
              {sorted.slice(0, 10).map((o) => (
                <div key={o.id} className="flex items-center gap-1.5 text-[9px] py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: o.color }} />
                  <span className="uppercase text-[#c9d1d9] w-[50px] truncate">{o.type}</span>
                  <span className="text-[#8b949e] tabular-nums flex-1 text-right">{Math.floor(o.dist)}m</span>
                  <span className="text-[8px] font-bold px-1 py-px rounded"
                    style={{ backgroundColor: THREAT_COLORS[o.threatLevel] + "18", color: THREAT_COLORS[o.threatLevel] }}>
                    {o.threatLevel}
                  </span>
                  {o.detected && o.patmosTiming && (
                    <span className="text-[7px] text-[#8b949e] tabular-nums">{o.patmosTiming.cycles}cyc</span>
                  )}
                </div>
              ))}
            </div>
          </PS>

          {/* Detection Events Log */}
          <PS title="DETECTION LOG" grow>
            <div className="space-y-1 overflow-y-auto" style={{ maxHeight: 280 }}>
              {events.length === 0 && <div className="text-[8px] text-[#484f58] italic">Waiting for detections&hellip;</div>}
              {events.slice(0, 20).map((ev, i) => (
                <div key={`${ev.id}-${i}`} className="bg-[#0d1117] border border-[#21262d] rounded p-1.5">
                  <div className="flex items-center justify-between text-[8px]">
                    <span className="text-[#c9d1d9] uppercase">{ev.type} #{ev.id}</span>
                    <span className="text-[#484f58]">{ev.dist}m</span>
                  </div>
                  {/* Patmos timing */}
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[7px] text-[#2ed573] w-8">PATMOS</span>
                    <div className="flex-1 h-1 bg-[#21262d] rounded overflow-hidden">
                      <div className="h-full bg-[#2ed573] rounded" style={{ width: `${Math.min(100, (ev.patmosCycles / AVOIDANCE_TASK.deadline_cycles) * 100)}%` }} />
                    </div>
                    <span className="text-[7px] text-[#2ed573] tabular-nums w-12 text-right">{ev.patmosCycles}cyc</span>
                  </div>
                  {/* CPU timing with breakdown */}
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[7px] text-[#ff4757] w-8">CPU</span>
                    <div className="flex-1 h-1 bg-[#21262d] rounded overflow-hidden flex">
                      <div className="h-full bg-[#8b949e]" style={{ width: `${(ev.cpuBreakdown.base / Math.max(ev.cpuCycles, 1)) * 100}%` }} />
                      <div className="h-full bg-[#ff4757]" style={{ width: `${(ev.cpuBreakdown.cache / Math.max(ev.cpuCycles, 1)) * 100}%` }} />
                      <div className="h-full bg-[#ffa502]" style={{ width: `${(ev.cpuBreakdown.branch / Math.max(ev.cpuCycles, 1)) * 100}%` }} />
                      <div className="h-full bg-[#d2a8ff]" style={{ width: `${(ev.cpuBreakdown.os / Math.max(ev.cpuCycles, 1)) * 100}%` }} />
                    </div>
                    <span className="text-[7px] text-[#ff4757] tabular-nums w-12 text-right">{ev.cpuCycles}cyc</span>
                  </div>
                </div>
              ))}
            </div>
          </PS>

          {/* Sparkline */}
          <PS title="CYCLE TIMELINE">
            <div className="bg-[#010409] border border-[#21262d] rounded overflow-hidden" style={{ height: 100 }}>
              <canvas ref={sparkRef} className="w-full h-full" style={{ display: "block" }} />
            </div>
          </PS>
        </div>
      </div>

      {/* ═══ Bottom Stats ═══ */}
      <div className="flex items-end h-[48px] px-4 border-t border-[#21262d] bg-[#0d1117] shrink-0 gap-6 pb-1.5">
        <BStat v={totalDetected} l="DETECTED" s="" c="#58a6ff" />
        <BStat v={hasBench ? pasimCyc : AVOIDANCE_TASK.N_instr} l="PATMOS WCET" s="cycles" c="#2ed573" />
        <BStat v={events.length > 0 ? Math.round(events.reduce((a, e) => a + e.cpuCycles, 0) / events.length) : 0} l="CPU AVG" s="cycles" c="#d29922" />
        <BStat v={events.length > 0 ? Math.max(...events.map(e => e.cpuCycles)) : 0} l="CPU WORST" s="cycles" c="#ff4757" />
        <div className="flex-1" />
        <div className="text-right pb-0.5">
          <div className="text-[8px] text-[#484f58] uppercase tracking-wider">DEADLINE</div>
          <div className="text-lg font-bold text-[#8b949e] tabular-nums leading-tight">
            {fmt(AVOIDANCE_TASK.deadline_cycles)} <span className="text-[10px] text-[#484f58]">cycles</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ── Canvas Drawing Helpers ───────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

function drawObject(ctx: CanvasRenderingContext2D, obj: SceneObject, sc: number, elapsed: number) {
  switch (obj.type) {
    case "car": case "suv": {
      const bw = (obj.type === "suv" ? 22 : 18) * sc, bh = (obj.type === "suv" ? 42 : 36) * sc, r = 3 * sc;
      ctx.fillStyle = "#00000040"; ctx.fillRect(-bw / 2 + 2, -bh / 2 + 2, bw, bh);
      ctx.fillStyle = obj.color; roundRect(ctx, -bw / 2, -bh / 2, bw, bh, r); ctx.fill();
      ctx.fillStyle = "#00000060"; roundRect(ctx, -bw * 0.35, -bh * 0.2, bw * 0.7, bh * 0.28, r * 0.5); ctx.fill();
      ctx.fillStyle = "#00000040"; roundRect(ctx, -bw * 0.3, bh * 0.15, bw * 0.6, bh * 0.15, r * 0.5); ctx.fill();
      ctx.fillStyle = "#ff000088";
      ctx.fillRect(-bw / 2 + 1, bh / 2 - 3 * sc, 4 * sc, 2 * sc);
      ctx.fillRect(bw / 2 - 5 * sc, bh / 2 - 3 * sc, 4 * sc, 2 * sc);
      break;
    }
    case "truck": {
      const bw = 26 * sc, bh = 60 * sc, r = 2 * sc;
      ctx.fillStyle = "#00000040"; ctx.fillRect(-bw / 2 + 2, -bh / 2 + 2, bw, bh);
      ctx.fillStyle = obj.color; roundRect(ctx, -bw / 2, -bh / 2, bw, bh * 0.7, r); ctx.fill();
      ctx.fillStyle = lerpColor(obj.color, "#ffffff", 0.15);
      roundRect(ctx, -bw * 0.4, -bh / 2 + bh * 0.7, bw * 0.8, bh * 0.3, r); ctx.fill();
      ctx.fillStyle = "#ff4500aa"; ctx.fillRect(-bw / 2 + 1, -bh / 2 + 1, bw - 2, 3 * sc);
      break;
    }
    case "pedestrian": {
      const h = 28 * sc;
      ctx.fillStyle = "#f5c6aa";
      ctx.beginPath(); ctx.arc(0, -h * 0.35, 4.5 * sc, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = obj.color; ctx.lineWidth = Math.max(2, 3 * sc); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(0, -h * 0.15); ctx.lineTo(0, h * 0.2); ctx.stroke();
      const swing = Math.sin(elapsed * 6 + obj.wobble) * 4 * sc;
      ctx.beginPath(); ctx.moveTo(-5 * sc + swing, 0); ctx.lineTo(5 * sc - swing, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, h * 0.2); ctx.lineTo(-3 * sc + swing, h * 0.45);
      ctx.moveTo(0, h * 0.2); ctx.lineTo(3 * sc - swing, h * 0.45); ctx.stroke();
      break;
    }
    case "cyclist": {
      const h = 30 * sc;
      ctx.strokeStyle = "#666"; ctx.lineWidth = Math.max(1, 1.5 * sc);
      ctx.beginPath(); ctx.arc(-2 * sc, h * 0.25, 5 * sc, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(2 * sc, -h * 0.15, 5 * sc, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = obj.color; ctx.lineWidth = Math.max(1.5, 2 * sc);
      ctx.beginPath(); ctx.moveTo(-2 * sc, h * 0.25); ctx.lineTo(0, 0); ctx.lineTo(2 * sc, -h * 0.15);
      ctx.moveTo(0, 0); ctx.lineTo(0, -h * 0.35); ctx.stroke();
      ctx.fillStyle = "#f5c6aa"; ctx.beginPath(); ctx.arc(0, -h * 0.42, 3.5 * sc, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "cone": {
      const h = 16 * sc, bw = 10 * sc;
      ctx.fillStyle = "#ff6b35";
      ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(-bw / 2, 0); ctx.lineTo(bw / 2, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffffff88"; ctx.fillRect(-bw * 0.3, -h * 0.5, bw * 0.6, h * 0.15);
      ctx.fillStyle = "#ff6b3588"; ctx.fillRect(-bw * 0.6, 0, bw * 1.2, 3 * sc);
      break;
    }
    case "barrier": {
      const bw = 44 * sc, bh = 10 * sc;
      ctx.fillStyle = "#e6e6e6"; roundRect(ctx, -bw / 2, -bh / 2, bw, bh, 2 * sc); ctx.fill();
      ctx.fillStyle = "#ff4757cc";
      const stripeW = bw / 7;
      for (let i = 0; i < 4; i++) ctx.fillRect(-bw / 2 + i * stripeW * 2 + stripeW * 0.3, -bh / 2 + 1, stripeW * 0.8, bh - 2);
      ctx.fillStyle = "#999";
      ctx.fillRect(-bw * 0.35, bh / 2, 3 * sc, 8 * sc);
      ctx.fillRect(bw * 0.35 - 3 * sc, bh / 2, 3 * sc, 8 * sc);
      break;
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

function lerpColor(hex: string, target: string, t: number): string {
  const h2r = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [r1, g1, b1] = h2r(hex.length >= 7 ? hex : "#888888");
  const [r2, g2, b2] = h2r(target);
  const c = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${c(r1, r2)},${c(g1, g2)},${c(b1, b2)})`;
}

// ── Sub-components ───────────────────────────────────────────────

function Pill({ label, on, color, pulse }: { label: string; on: boolean; color: string; pulse?: boolean }) {
  return (
    <div className="flex items-center gap-1 text-[9px]">
      <span className={`w-1.5 h-1.5 rounded-full ${pulse && on ? "animate-pulse" : ""}`}
        style={{ backgroundColor: on ? color : "#30363d" }} />
      <span style={{ color: on ? color : "#484f58" }}>{label}</span>
    </div>
  );
}

function PS({ title, children, grow }: { title: string; children: React.ReactNode; grow?: boolean }) {
  return (
    <div className={`px-2.5 py-2 border-b border-[#21262d] ${grow ? "flex-1 min-h-0 flex flex-col" : ""}`}>
      <div className="text-[8px] text-[#58a6ff] font-bold uppercase tracking-[0.12em] mb-1.5">{title}</div>
      <div className={`space-y-1.5 ${grow ? "flex-1 min-h-0 overflow-y-auto" : ""}`}>{children}</div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-[#0d1117] border border-[#21262d] rounded p-2">{children}</div>;
}

function Bar({ value, max, color, label, pct }: { value: number; max: number; color: string; label: string; pct?: boolean }) {
  const p = clamp((value / max) * 100, 0, 100);
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <span className="text-[8px] text-[#484f58] uppercase w-10">{label}</span>
      <div className="flex-1 h-1 bg-[#21262d] rounded overflow-hidden">
        <div className="h-full rounded" style={{ width: `${p}%`, backgroundColor: color }} />
      </div>
      <span className="text-[8px] text-[#8b949e] tabular-nums w-8 text-right">{pct ? `${Math.floor(p)}%` : fmt(value)}</span>
    </div>
  );
}

function StatRow({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-[9px]">
      <span className="text-[#8b949e]">{label}</span>
      <span className={`tabular-nums ${bold ? "font-bold" : ""}`} style={{ color: color ?? "#e6edf3" }}>{value}</span>
    </div>
  );
}

function BStat({ v, l, s, c }: { v: number; l: string; s: string; c: string }) {
  return (
    <div>
      <div className="text-[24px] font-bold tabular-nums leading-none" style={{ color: c }}>{v}</div>
      <div className="text-[8px] text-[#484f58] uppercase tracking-wider leading-tight mt-px">{l}</div>
      {s && <div className="text-[8px] text-[#484f58] uppercase tracking-wider leading-tight">{s}</div>}
    </div>
  );
}
