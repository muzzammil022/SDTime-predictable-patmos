import React, { useState, useMemo } from "react";
import { IconRefresh } from "./icons";
import RoadCanvas from "@/components/RoadCanvas";
import DualTimingPanel from "@/components/DualTimingPanel";
import { useDualSimulation } from "@/hooks/useDualSimulation";
import { DEFAULT_CONFIG, DIFFICULTY_PRESETS } from "@/lib/types";

type PreviewTab = "simulation" | "monitor";

/* Status label mapping */
const STATUS_LABELS: Record<string, string> = {
  idle: "Ready to simulate",
  running: "Simulation running...",
  "patmos-triggered": "Decision pending...",
  avoiding: "Avoiding obstacle...",
  completed: "Simulation complete",
  collision: "Collision detected",
};

export default function PreviewPanel() {
  const [activeTab, setActiveTab] = useState<PreviewTab>("simulation");

  return (
    <div className="h-full flex flex-col bg-[#0c1222] overflow-hidden">
      {/* ── Browser chrome header ── */}
      <div className="flex items-center h-10 px-3 bg-slate-900/80 border-b border-white/6 shrink-0 gap-3">
        {/* Traffic lights */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        {/* URL bar */}
        <div className="flex-1 h-7 bg-white/4 rounded-lg flex items-center px-3 border border-white/4">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/60 mr-2 shrink-0" />
          <span className="text-[11px] text-slate-500 font-mono truncate">localhost:3000</span>
        </div>
        {/* Refresh */}
        <button className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/6 transition-all duration-150 shrink-0">
          <IconRefresh size={13} />
        </button>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex items-center gap-0.5 px-2 h-8 border-b border-white/6 shrink-0 bg-slate-900/40">
        {(["simulation", "monitor"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 rounded text-[11px] capitalize transition-all duration-150
              ${activeTab === tab
                ? "text-slate-200 bg-white/6"
                : "text-slate-500 hover:text-slate-300 hover:bg-white/3"}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto">
        {activeTab === "simulation" ? <SimulationView /> : <MonitorView />}
      </div>
    </div>
  );
}

/* ===================== SIMULATION TAB ===================== */

function SimulationView() {
  const config = useMemo(() => {
    const preset = DIFFICULTY_PRESETS["hard"];
    return {
      ...DEFAULT_CONFIG,
      numObstacles: 5,
      difficulty: "hard" as const,
      initialSpeed: preset.speed,
      detectionThreshold: preset.detectionThreshold,
      brakeDeceleration: preset.brakeDeceleration,
    };
  }, []);

  const { dualState, combinedStatus, start, reset, pause } =
    useDualSimulation(config);

  const isIdle = combinedStatus === "idle";
  const isDone =
    combinedStatus === "completed" || combinedStatus === "collision";

  return (
    <div className="p-4 space-y-4">
      {/* ── Header + controls ── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">
            Patmos vs Normal CPU
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {STATUS_LABELS[combinedStatus] || combinedStatus}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {isIdle || isDone ? (
            <button
              onClick={start}
              className="px-3 py-1.5 text-[11px] font-medium bg-indigo-500 text-white rounded-lg hover:bg-indigo-400 transition-colors shadow-sm shadow-indigo-500/20"
            >
              ▶ Start
            </button>
          ) : (
            <button
              onClick={pause}
              className="px-3 py-1.5 text-[11px] font-medium bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors"
            >
              ⏸ Pause
            </button>
          )}
          <button
            onClick={reset}
            className="px-3 py-1.5 text-[11px] font-medium bg-white/6 text-slate-300 rounded-lg hover:bg-white/10 transition-colors"
          >
            ↺
          </button>
        </div>
      </div>

      {/* ── Dual canvases ── */}
      <div className="flex gap-3 justify-center flex-wrap">
        {/* Patmos canvas */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-cyan-500" />
            <span className="text-[10px] font-mono font-medium text-cyan-400">
              Patmos
            </span>
          </div>
          <div className="rounded-lg overflow-hidden border border-white/6">
            <RoadCanvas
              state={dualState.patmos}
              config={config}
              width={170}
              height={320}
              carColor="#219ebc"
            />
          </div>
          <StatusBadge status={dualState.patmos.status} />
        </div>

        {/* Normal CPU canvas */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-[10px] font-mono font-medium text-orange-400">
              Normal CPU
            </span>
          </div>
          <div className="rounded-lg overflow-hidden border border-white/6">
            <RoadCanvas
              state={dualState.normal}
              config={config}
              width={170}
              height={320}
              carColor="#dc2626"
            />
          </div>
          <StatusBadge status={dualState.normal.status} />
        </div>
      </div>

      {/* ── Compact timing cards ── */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-2.5">
          <div className="text-[10px] font-mono font-medium text-cyan-400 mb-1">
            Patmos
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-white font-mono">
              {dualState.patmos.elapsedTime.toFixed(1)}
            </span>
            <span className="text-[10px] text-slate-500">sec</span>
          </div>
          <div className="text-[9px] text-slate-500 mt-0.5">
            Events: {dualState.patmosEvents.length}
          </div>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2.5">
          <div className="text-[10px] font-mono font-medium text-orange-400 mb-1">
            Normal CPU
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-white font-mono">
              {dualState.normal.elapsedTime.toFixed(1)}
            </span>
            <span className="text-[10px] text-slate-500">sec</span>
          </div>
          <div className="text-[9px] text-slate-500 mt-0.5">
            Events: {dualState.normalEvents.length}
          </div>
        </div>
      </div>

      {/* ── Full timing comparison panel ── */}
      <DualTimingPanel
        patmosEvents={dualState.patmosEvents}
        normalEvents={dualState.normalEvents}
        patmosElapsed={dualState.patmos.elapsedTime}
        normalElapsed={dualState.normal.elapsedTime}
      />

      {/* ── Legend ── */}
      <div className="flex items-center justify-center gap-4 text-[9px] text-slate-500 pt-2 border-t border-white/4">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-cyan-500" /> Time-predictable
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-orange-500" /> Non-deterministic
        </span>
      </div>
    </div>
  );
}

/* Status badge under each canvas */
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    idle: "text-slate-500",
    running: "text-blue-400",
    "patmos-triggered": "text-yellow-400",
    avoiding: "text-amber-400",
    completed: "text-green-400",
    collision: "text-red-400",
  };
  return (
    <span className={`text-[9px] font-mono ${colors[status] || "text-slate-500"}`}>
      {status}
    </span>
  );
}

/* ===================== MONITOR TAB ===================== */

function MonitorView() {
  return (
    <div className="flex items-center justify-center p-4 min-h-full">
      {/* Phone frame */}
      <div className="w-70 bg-black rounded-[2.5rem] p-2.5 shadow-2xl shadow-black/60 border border-white/8 shrink-0">
        <div className="bg-[#0f172a] rounded-4xl overflow-hidden relative">
          {/* Notch */}
          <div className="flex justify-center pt-2 pb-1 relative z-10">
            <div className="w-20 h-5 bg-black rounded-b-2xl" />
          </div>

          <div className="px-4 pb-6 space-y-3.5">
            {/* Status bar */}
            <div className="flex justify-between text-[9px] text-slate-500 px-1 -mt-1">
              <span className="font-medium">9:41</span>
              <div className="flex items-center gap-1">
                <span>&#9679;&#9679;&#9679;</span>
              </div>
            </div>

            {/* App header */}
            <div className="text-center pt-1">
              <h3 className="text-[13px] font-semibold text-white tracking-tight">
                Patmos Monitor
              </h3>
              <p className="text-[9px] text-slate-500 mt-0.5">
                Real-time WCET Analysis
              </p>
            </div>

            {/* Gauge */}
            <div className="flex justify-center py-2">
              <div className="relative w-24 h-24">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="40" fill="none" stroke="#1e293b" strokeWidth="6" />
                  <circle
                    cx="48" cy="48" r="40" fill="none" stroke="#6366f1" strokeWidth="6"
                    strokeDasharray="251.2" strokeDashoffset="75" strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold text-white font-mono">1.2</span>
                  <span className="text-[8px] text-slate-500">ms WCET</span>
                </div>
              </div>
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Cycles", value: "1,247" },
                { label: "Jitter", value: "0" },
                { label: "BCET", value: "1,102" },
                { label: "Cache Hit", value: "96%" },
              ].map((m) => (
                <div
                  key={m.label}
                  className="bg-white/4 rounded-lg p-2 border border-white/4"
                >
                  <p className="text-[8px] text-slate-500 mb-0.5">{m.label}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-bold text-white font-mono">
                      {m.value}
                    </span>
                    <span className="text-[8px] text-emerald-400">&#10003;</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Timeline chart */}
            <div className="bg-white/4 rounded-xl p-2.5 border border-white/4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[9px] text-slate-400 font-medium">
                  Execution Timeline
                </span>
                <span className="text-[8px] text-indigo-400">Live</span>
              </div>
              <div className="flex items-end gap-0.75 h-10">
                {[60, 45, 72, 55, 80, 40, 65, 50, 75, 42, 68, 55, 70, 48].map(
                  (h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-sm"
                      style={{
                        height: `${h}%`,
                        background:
                          h > 70
                            ? "linear-gradient(to top, #6366f1, #818cf8)"
                            : "linear-gradient(to top, #334155, #475569)",
                      }}
                    />
                  )
                )}
              </div>
            </div>

            {/* Action button */}
            <button className="w-full py-2.5 bg-linear-to-r from-indigo-500 to-indigo-600 rounded-xl text-white text-[11px] font-semibold shadow-lg shadow-indigo-500/30">
              Run Analysis
            </button>

            {/* Home indicator */}
            <div className="flex justify-center pt-1">
              <div className="w-28 h-1 bg-white/20 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
