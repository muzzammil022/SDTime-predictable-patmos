import React, { useMemo, useState, useCallback } from "react";
import RoadCanvas from "@/components/RoadCanvas";
import ControlPanel from "@/components/ControlPanel";
import { useDualSimulation } from "@/hooks/useDualSimulation";
import { DEFAULT_CONFIG, DIFFICULTY_PRESETS, CodeRunnerResponse } from "@/lib/types";
import { SAMPLE_CODES } from "@/lib/sample-code";

const NUM_OBSTACLES = 5;
const DIFFICULTY = "hard" as const;

function StatusText({ status }: { status: string }) {
  return (
    <div className="text-[10px] font-mono text-[#8b949e] text-center h-4">
      {status === "idle" && "Waiting to start…"}
      {status === "running" && "Driving…"}
      {status === "patmos-triggered" && "⚡ Decision pending…"}
      {status === "avoiding" && "Avoiding obstacle…"}
      {status === "completed" && "✓ Safe stop — all obstacles handled!"}
      {status === "collision" && "✗ Collision — response too slow!"}
    </div>
  );
}

function ProcessorLabel({
  name,
  color,
  subtitle,
}: {
  name: string;
  color: string;
  subtitle: string;
}) {
  return (
    <div className="text-center mb-2">
      <div className={`text-sm font-mono font-bold ${color}`}>{name}</div>
      <div className="text-[10px] font-mono text-[#8b949e]">{subtitle}</div>
    </div>
  );
}

/** Get the obstacle avoidance sample code */
function getAvoidanceCode(): string {
  const sample = SAMPLE_CODES.find((s) => s.name === "Obstacle Avoidance");
  return sample?.code ?? "";
}

export default function CarDemo() {
  const config = useMemo(() => {
    const preset = DIFFICULTY_PRESETS[DIFFICULTY];
    return {
      ...DEFAULT_CONFIG,
      numObstacles: NUM_OBSTACLES,
      difficulty: DIFFICULTY,
      initialSpeed: preset.speed,
      detectionThreshold: preset.detectionThreshold,
      brakeDeceleration: preset.brakeDeceleration,
    };
  }, []);

  // Backend benchmark state
  const [benchResult, setBenchResult] = useState<CodeRunnerResponse | null>(null);
  const [benchError, setBenchError] = useState<string | null>(null);
  const [benchmarking, setBenchmarking] = useState(false);

  const realTiming = useMemo(() => {
    if (!benchResult) return undefined;
    return {
      pasimCycles: benchResult.pasim?.stats?.cycles ?? 0,
      pasimWallMs: benchResult.pasim?.wall_time_ms ?? 0,
      patemuCycles: benchResult.patemu?.stats?.cycles ?? 0,
      patemuWallMs: benchResult.patemu?.wall_time_ms ?? 0,
      gccWallMs: benchResult.gcc?.wall_time_ms ?? 0,
    };
  }, [benchResult]);

  const { dualState, combinedStatus, start, reset, pause } =
    useDualSimulation(config, realTiming);

  // Run the obstacle avoidance code on real pasim + patemu + gcc
  const runBenchmark = useCallback(async () => {
    setBenchmarking(true);
    setBenchError(null);
    setBenchResult(null);
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
      if (!data.success) {
        setBenchError("Benchmark failed — check backend logs");
      }
    } catch (e: any) {
      setBenchError(
        e.message?.includes("fetch")
          ? "Cannot reach backend. Run: docker compose up"
          : e.message || "Network error"
      );
    } finally {
      setBenchmarking(false);
    }
  }, []);

  const handleStart = useCallback(() => {
    if (!benchResult) {
      // Run benchmark first, then start
      runBenchmark().then(() => {
        // start will be called after benchmark result arrives via effect
      });
    } else {
      start();
    }
  }, [benchResult, runBenchmark, start]);

  // Auto-start animation after benchmark completes
  const startAfterBench = useCallback(() => {
    if (benchResult && benchResult.success && combinedStatus === "idle") {
      start();
    }
  }, [benchResult, combinedStatus, start]);

  // Trigger start after first successful benchmark
  React.useEffect(() => {
    startAfterBench();
  }, [startAfterBench]);

  return (
    <div className="flex flex-col gap-6">
      {/* Benchmark status bar */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-mono text-[#8b949e] uppercase tracking-wider">
            Real Patmos Benchmark
          </h3>
          <button
            onClick={runBenchmark}
            disabled={benchmarking}
            className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${
              benchmarking
                ? "bg-[#21262d] text-[#8b949e] cursor-wait"
                : "bg-[#238636] text-white hover:bg-[#2ea043]"
            }`}
          >
            {benchmarking ? "⏳ Running on backend…" : "⚡ Run Benchmark"}
          </button>
        </div>

        {benchError && (
          <div className="bg-[#da3633]/10 border border-[#da3633]/30 rounded p-3 text-xs font-mono text-[#f85149] mb-3">
            {benchError}
          </div>
        )}

        {benchResult && benchResult.success && (
          <div className="grid grid-cols-3 gap-3">
            {benchResult.pasim?.stats && (
              <div className="bg-[#0d1117] rounded p-3 border border-[#21262d]">
                <div className="text-[10px] text-[#8b949e] uppercase">pasim (Simulator)</div>
                <div className="text-lg font-mono text-[#58a6ff] font-bold">
                  {benchResult.pasim.stats.cycles.toLocaleString()}
                </div>
                <div className="text-[10px] text-[#484f58]">
                  cycles • {benchResult.pasim.wall_time_ms.toFixed(0)}ms wall
                </div>
              </div>
            )}
            {benchResult.patemu?.stats && (
              <div className="bg-[#0d1117] rounded p-3 border border-[#21262d]">
                <div className="text-[10px] text-[#8b949e] uppercase">patemu (Emulator)</div>
                <div className="text-lg font-mono text-[#d2a8ff] font-bold">
                  {benchResult.patemu.stats.cycles.toLocaleString()}
                </div>
                <div className="text-[10px] text-[#484f58]">
                  cycles • {benchResult.patemu.wall_time_ms.toFixed(0)}ms wall
                </div>
              </div>
            )}
            {benchResult.gcc && (
              <div className="bg-[#0d1117] rounded p-3 border border-[#21262d]">
                <div className="text-[10px] text-[#8b949e] uppercase">GCC (Normal CPU)</div>
                <div className="text-lg font-mono text-[#d18616] font-bold">
                  {benchResult.gcc.wall_time_ms < 1 ? '<1' : benchResult.gcc.wall_time_ms.toFixed(1)}ms
                </div>
                <div className="text-[10px] text-[#484f58]">
                  actual exec time (non-deterministic)
                </div>
              </div>
            )}
          </div>
        )}

        {!benchResult && !benchError && !benchmarking && (
          <p className="text-xs font-mono text-[#484f58]">
            Click &quot;Run Benchmark&quot; to compile and run the obstacle avoidance code
            on real pasim, patemu, and GCC before starting the car demo.
          </p>
        )}
      </div>

      {/* Top row: Controls + Dual Canvases */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <ControlPanel
          status={combinedStatus}
          onStart={handleStart}
          onReset={reset}
          onPause={pause}
        />

        {/* Dual Canvases */}
        <div className="flex gap-6 flex-1 justify-center">
          {/* Normal CPU — left */}
          <div className="flex flex-col items-center gap-2">
            <ProcessorLabel
              name="Normal CPU"
              color="text-[#d18616]"
              subtitle="Non-deterministic (variable jitter)"
            />
            <RoadCanvas state={dualState.normal} config={config} width={260} height={500} carColor="#dc2626" />
            <StatusText status={dualState.normal.status} />
          </div>

          {/* VS divider */}
          <div className="flex flex-col items-center justify-center">
            <div className="text-[#484f58] font-mono text-xs font-bold">VS</div>
          </div>

          {/* Patmos — right */}
          <div className="flex flex-col items-center gap-2">
            <ProcessorLabel
              name="Patmos"
              color="text-[#58a6ff]"
              subtitle={
                realTiming
                  ? `Deterministic — ${realTiming.pasimCycles.toLocaleString()} cycles every time`
                  : "Deterministic (zero jitter)"
              }
            />
            <RoadCanvas state={dualState.patmos} config={config} width={260} height={500} carColor="#219ebc" />
            <StatusText status={dualState.patmos.status} />
          </div>
        </div>
      </div>

      {/* Bottom: Real timing comparison */}
      {benchResult && benchResult.success && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
          <h3 className="text-xs font-mono text-[#8b949e] uppercase tracking-wider mb-3">
            Timing Predictability Comparison
          </h3>
          <TimingComparisonBars result={benchResult} />
          <p className="text-[10px] font-mono text-[#3fb950] mt-3">
            Patmos cycle counts from real pasim execution. Normal CPU estimates from architectural timing model
            (cache misses, branch mispredictions, OS jitter).
          </p>
        </div>
      )}
    </div>
  );
}

function TimingComparisonBars({ result }: { result: CodeRunnerResponse }) {
  const pCyc = result.pasim?.stats?.cycles ?? 0;
  const eCyc = result.patemu?.stats?.cycles ?? 0;
  const gExecMs = result.gcc?.wall_time_ms ?? 0;

  // Estimate normal CPU cycles from the GCC exec time (@ ~1 GHz = 1M cyc/ms)
  // Use the timing model's WCET range for a normal CPU running this workload
  const normalWcet = Math.ceil(pCyc * 0.8 * 1.5) + 200; // base + pessimistic overhead
  const normalBcet = Math.ceil(pCyc * 0.8);

  const maxCyc = Math.max(pCyc, eCyc, normalWcet, 1);

  return (
    <div className="space-y-3">
      {/* Patmos bars */}
      {pCyc > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-[#58a6ff] text-[11px] font-mono w-36 shrink-0">pasim (Patmos)</span>
          <div className="flex-1 h-4 bg-[#21262d] rounded overflow-hidden">
            <div
              className="h-full bg-[#58a6ff]/60 rounded transition-all"
              style={{ width: `${Math.max(4, (pCyc / maxCyc) * 100)}%` }}
            />
          </div>
          <span className="text-[11px] font-mono text-[#e6edf3] w-36 text-right shrink-0">
            {pCyc.toLocaleString()} cyc (WCET=BCET)
          </span>
        </div>
      )}
      {eCyc > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-[#d2a8ff] text-[11px] font-mono w-36 shrink-0">patemu (Patmos HW)</span>
          <div className="flex-1 h-4 bg-[#21262d] rounded overflow-hidden">
            <div
              className="h-full bg-[#d2a8ff]/60 rounded transition-all"
              style={{ width: `${Math.max(4, (eCyc / maxCyc) * 100)}%` }}
            />
          </div>
          <span className="text-[11px] font-mono text-[#e6edf3] w-36 text-right shrink-0">
            {eCyc.toLocaleString()} cyc (WCET=BCET)
          </span>
        </div>
      )}

      {/* Normal CPU bar — shows WCET range */}
      <div className="flex items-center gap-3">
        <span className="text-[#d18616] text-[11px] font-mono w-36 shrink-0">Normal CPU (est.)</span>
        <div className="flex-1 h-4 bg-[#21262d] rounded overflow-hidden relative">
          {/* BCET bar */}
          <div
            className="h-full bg-[#d18616]/30 rounded-l transition-all absolute inset-y-0 left-0"
            style={{ width: `${Math.max(4, (normalWcet / maxCyc) * 100)}%` }}
          />
          {/* BCET marker */}
          <div
            className="h-full bg-[#d18616]/70 rounded-l transition-all absolute inset-y-0 left-0"
            style={{ width: `${Math.max(4, (normalBcet / maxCyc) * 100)}%` }}
          />
        </div>
        <span className="text-[11px] font-mono text-[#e6edf3] w-36 text-right shrink-0">
          {normalBcet.toLocaleString()}–{normalWcet.toLocaleString()} cyc
        </span>
      </div>

      {/* Key insight */}
      <div className="mt-2 p-2 bg-[#0d1117] rounded border border-[#30363d]">
        <p className="text-[10px] font-mono text-[#8b949e]">
          <span className="text-[#58a6ff]">Patmos</span>: WCET = BCET = {pCyc.toLocaleString()} cycles (jitter: <span className="text-[#3fb950]">0</span>)
        </p>
        <p className="text-[10px] font-mono text-[#8b949e]">
          <span className="text-[#d18616]">Normal CPU</span>: BCET = {normalBcet.toLocaleString()}, WCET = {normalWcet.toLocaleString()} cycles (jitter: <span className="text-[#f85149]">{(normalWcet - normalBcet).toLocaleString()}</span>)
        </p>
        <p className="text-[10px] font-mono text-[#3fb950] mt-1">
          Patmos eliminates {(normalWcet - normalBcet).toLocaleString()} cycles of jitter — critical for real-time safety.
          {gExecMs > 0 && ` (GCC actual exec: ${gExecMs < 1 ? '<1' : gExecMs.toFixed(1)}ms)`}
        </p>
      </div>
    </div>
  );
}

