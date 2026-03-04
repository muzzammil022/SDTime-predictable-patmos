import React, { useState, useCallback } from "react";
import {
  CodeRunnerResponse,
  ExecutionResult,
  ExecutionMode,
  PatmosStats,
} from "@/lib/types";
import { SAMPLE_CODES } from "@/lib/sample-code";

export default function CodeRunner() {
  const [code, setCode] = useState(SAMPLE_CODES[0].code);
  const [selectedSample, setSelectedSample] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [runningMode, setRunningMode] = useState<ExecutionMode | null>(null);
  const [result, setResult] = useState<CodeRunnerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runHistory, setRunHistory] = useState<
    { code: string; result: CodeRunnerResponse; timestamp: number; mode: ExecutionMode }[]
  >([]);

  const handleSampleChange = useCallback((idx: number) => {
    setSelectedSample(idx);
    setCode(SAMPLE_CODES[idx].code);
    setResult(null);
    setError(null);
  }, []);

  const handleRun = useCallback(
    async (mode: ExecutionMode) => {
      setIsRunning(true);
      setRunningMode(mode);
      setResult(null);
      setError(null);

      try {
        const res = await fetch("/api/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            mode,
            timeout: mode === "emulate" ? 60 : 30,
            run_gcc: true,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: res.statusText }));
          setError(errData.error || `HTTP ${res.status}`);
          return;
        }

        const data: CodeRunnerResponse = await res.json();
        setResult(data);
        setRunHistory((prev) => [
          { code, result: data, timestamp: Date.now(), mode },
          ...prev.slice(0, 9),
        ]);
      } catch (err: any) {
        setError(err.message || "Network error");
      } finally {
        setIsRunning(false);
        setRunningMode(null);
      }
    },
    [code]
  );

  // Determine the primary output to show
  const primaryResult: ExecutionResult | null =
    result?.pasim ?? result?.patemu ?? null;
  const gccResult: ExecutionResult | null = result?.gcc ?? null;

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Left: Code editor area */}
      <div className="flex flex-col gap-4 flex-1 min-w-0">
        {/* Sample selector */}
        <div className="flex gap-2 flex-wrap">
          {SAMPLE_CODES.map((sample, idx) => (
            <button
              key={idx}
              onClick={() => handleSampleChange(idx)}
              className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${
                selectedSample === idx
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
              }`}
            >
              {sample.name}
            </button>
          ))}
        </div>

        <p className="text-xs font-mono text-zinc-500">
          {SAMPLE_CODES[selectedSample].description}
        </p>

        {/* Code editor */}
        <div className="relative">
          {/* Action buttons */}
          <div className="absolute top-2 right-2 flex gap-2 z-10">
            <button
              onClick={() => handleRun("simulate")}
              disabled={isRunning || !code.trim()}
              className={`px-4 py-2 text-xs font-mono rounded-lg transition-all ${
                isRunning && runningMode === "simulate"
                  ? "bg-zinc-700 text-zinc-400 cursor-wait"
                  : isRunning
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/20"
              }`}
            >
              {isRunning && runningMode === "simulate"
                ? "⏳ Running..."
                : "▶ Run (pasim)"}
            </button>
            <button
              onClick={() => handleRun("emulate")}
              disabled={isRunning || !code.trim()}
              className={`px-4 py-2 text-xs font-mono rounded-lg transition-all ${
                isRunning && runningMode === "emulate"
                  ? "bg-zinc-700 text-zinc-400 cursor-wait"
                  : isRunning
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20"
              }`}
            >
              {isRunning && runningMode === "emulate"
                ? "⏳ Emulating..."
                : "⚡ Analyze (patemu)"}
            </button>
            <button
              onClick={() => handleRun("both")}
              disabled={isRunning || !code.trim()}
              className={`px-3 py-2 text-xs font-mono rounded-lg transition-all ${
                isRunning && runningMode === "both"
                  ? "bg-zinc-700 text-zinc-400 cursor-wait"
                  : isRunning
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
              }`}
              title="Run both pasim and patemu"
            >
              {isRunning && runningMode === "both" ? "⏳" : "⇄ Both"}
            </button>
          </div>

          <textarea
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setResult(null);
              setError(null);
            }}
            spellCheck={false}
            className="w-full h-[460px] bg-zinc-950 text-green-400 font-mono text-sm p-4 
                       rounded-lg border border-zinc-800 resize-none focus:outline-none 
                       focus:border-blue-600 transition-colors leading-relaxed"
            placeholder="Write time-predictable C code here..."
          />
          <div className="absolute bottom-2 left-3 text-[10px] font-mono text-zinc-700">
            {code.split("\n").length} lines • C • patmos-clang
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-950/50 rounded-lg border border-red-800 p-4">
            <h3 className="text-xs font-mono text-red-400 uppercase tracking-wider mb-1">
              Error
            </h3>
            <pre className="text-sm font-mono text-red-300 whitespace-pre-wrap">
              {error}
            </pre>
          </div>
        )}

        {/* Program Output */}
        {primaryResult && (
          <div className="bg-zinc-950 rounded-lg border border-zinc-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                Program Output
              </h3>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  primaryResult.success
                    ? "bg-green-900/50 text-green-400"
                    : "bg-red-900/50 text-red-400"
                }`}
              >
                {primaryResult.success ? "OK" : `exit ${primaryResult.exit_code}`}
              </span>
            </div>
            <pre
              className={`text-sm font-mono whitespace-pre-wrap ${
                primaryResult.success ? "text-zinc-300" : "text-red-400"
              }`}
            >
              {primaryResult.error && !primaryResult.success
                ? primaryResult.error
                : primaryResult.output || "(no output)"}
            </pre>
          </div>
        )}

        {/* Execution Results — pasim & patemu side by side */}
        {result && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.pasim && (
              <ToolResultPanel result={result.pasim} color="blue" />
            )}
            {result.patemu && (
              <ToolResultPanel result={result.patemu} color="purple" />
            )}
          </div>
        )}

        {/* Summary bar */}
        {result?.summary && (
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 px-4 py-3">
            <p className="text-xs font-mono text-zinc-400">{result.summary}</p>
          </div>
        )}
      </div>

      {/* Right: Stats panel */}
      <div className="flex flex-col gap-4 w-full lg:w-[380px] lg:min-w-[380px]">
        {result ? (
          <StatsComparison result={result} />
        ) : (
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
            <div className="text-center space-y-3">
              <div className="text-4xl">⚡</div>
              <h3 className="text-sm font-mono text-zinc-300">
                Run Code on Patmos
              </h3>
              <p className="text-xs font-mono text-zinc-500 leading-relaxed">
                Write or pick a C sample, then hit{" "}
                <span className="text-green-400">Run</span> (pasim, fast) or{" "}
                <span className="text-purple-400">Analyze</span> (patemu,
                cycle-accurate). Code is compiled with{" "}
                <span className="text-blue-400">patmos-clang</span> and
                executed on the real Patmos toolchain inside Docker.
              </p>
            </div>
          </div>
        )}

        {/* GCC Baseline */}
        {gccResult && (
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
            <h3 className="text-xs font-mono text-orange-400 uppercase tracking-wider mb-2">
              GCC Baseline
            </h3>
            <div className="space-y-1">
              <StatRow label="Status" value={gccResult.success ? "OK" : "Failed"} />
              <StatRow label="Wall Time" value={`${gccResult.wall_time_ms.toFixed(0)}ms`} />
              {gccResult.output && (
                <div className="mt-2">
                  <pre className="text-[11px] font-mono text-zinc-400 whitespace-pre-wrap max-h-24 overflow-y-auto">
                    {gccResult.output}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rules card */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
          <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">
            Time-Predictable Rules
          </h3>
          <div className="space-y-2 text-xs font-mono text-zinc-400">
            <Rule ok label="Bounded loops (fixed iteration count)" />
            <Rule ok label="Static branching (if/else)" />
            <Rule ok label="Fixed-size arrays" />
            <Rule ok label="Integer & fixed-point arithmetic" />
            <Rule bad label="Dynamic memory (malloc/calloc)" />
            <Rule bad label="Unbounded loops (while true)" />
            <Rule bad label="Recursion" />
            <Rule bad label="Virtual dispatch / function pointers" />
          </div>
        </div>

        {/* Run history */}
        {runHistory.length > 0 && (
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
            <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">
              Run History
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {runHistory.map((entry, i) => {
                const pasimCycles = entry.result.pasim?.stats?.cycles;
                const patemuCycles = entry.result.patemu?.stats?.cycles;
                return (
                  <div
                    key={entry.timestamp}
                    className="flex justify-between items-center text-xs font-mono py-1 border-b border-zinc-800 last:border-b-0"
                  >
                    <span className="text-zinc-500">#{runHistory.length - i}</span>
                    <span
                      className={
                        entry.mode === "emulate"
                          ? "text-purple-400"
                          : "text-blue-400"
                      }
                    >
                      {entry.mode}
                    </span>
                    {pasimCycles != null && (
                      <span className="text-blue-400">{pasimCycles} cyc</span>
                    )}
                    {patemuCycles != null && (
                      <span className="text-purple-400">{patemuCycles} cyc</span>
                    )}
                    <span
                      className={
                        entry.result.success ? "text-green-400" : "text-red-400"
                      }
                    >
                      {entry.result.success ? "OK" : "ERR"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──

function Rule({ ok, bad, label }: { ok?: boolean; bad?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={ok ? "text-green-500" : "text-red-500"}>
        {ok ? "✓" : "✗"}
      </span>
      <span>{label}</span>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[11px] font-mono">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-300">{value}</span>
    </div>
  );
}

function ToolResultPanel({
  result,
  color,
}: {
  result: ExecutionResult;
  color: "blue" | "purple";
}) {
  const stats = result.stats;
  const headerColor = color === "blue" ? "text-blue-400" : "text-purple-400";
  const borderColor =
    color === "blue" ? "border-blue-900/50" : "border-purple-900/50";
  const toolLabel = result.tool === "pasim" ? "pasim (Simulator)" : "patemu (Emulator)";

  return (
    <div className={`bg-zinc-900 rounded-lg border ${borderColor} p-3`}>
      <div className="flex items-center justify-between mb-2">
        <h4
          className={`text-[10px] font-mono ${headerColor} uppercase tracking-wider font-bold`}
        >
          {toolLabel}
        </h4>
        <span className={`text-[10px] font-mono ${headerColor}`}>
          {result.wall_time_ms.toFixed(0)}ms
        </span>
      </div>
      <div className="space-y-1">
        {stats ? (
          <>
            {stats.cycles > 0 && (
              <StatRow label="Cycles" value={stats.cycles.toLocaleString()} />
            )}
            {stats.instructions > 0 && (
              <StatRow
                label="Instructions"
                value={stats.instructions.toLocaleString()}
              />
            )}
            {stats.bundles > 0 && (
              <StatRow label="Bundles" value={stats.bundles.toLocaleString()} />
            )}
            {(stats.cache_hits > 0 || stats.cache_misses > 0) && (
              <>
                <StatRow
                  label="Cache Hits"
                  value={stats.cache_hits.toLocaleString()}
                />
                <StatRow
                  label="Cache Misses"
                  value={stats.cache_misses.toLocaleString()}
                />
              </>
            )}
            {(stats.method_cache_hits > 0 || stats.method_cache_misses > 0) && (
              <>
                <StatRow
                  label="Method $ Hits"
                  value={stats.method_cache_hits.toLocaleString()}
                />
                <StatRow
                  label="Method $ Misses"
                  value={stats.method_cache_misses.toLocaleString()}
                />
              </>
            )}
            {stats.stack_cache_ops > 0 && (
              <StatRow
                label="Stack Cache Ops"
                value={stats.stack_cache_ops.toLocaleString()}
              />
            )}
          </>
        ) : (
          <p className="text-[11px] font-mono text-zinc-500 italic">
            No detailed stats available
          </p>
        )}
      </div>

      {/* Raw stats toggle */}
      {stats?.raw_output && <RawStatsSection raw={stats.raw_output} />}
    </div>
  );
}

function RawStatsSection({ raw }: { raw: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-[10px] font-mono text-zinc-600 hover:text-zinc-400 transition-colors"
      >
        {open ? "▼ Hide raw stats" : "▶ Show raw stats"}
      </button>
      {open && (
        <pre className="mt-1 text-[10px] font-mono text-zinc-500 whitespace-pre-wrap max-h-32 overflow-y-auto bg-zinc-950 rounded p-2">
          {raw}
        </pre>
      )}
    </div>
  );
}

function StatsComparison({ result }: { result: CodeRunnerResponse }) {
  const pasimStats = result.pasim?.stats;
  const patemuStats = result.patemu?.stats;

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
          Execution Results
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Cycle comparison bars */}
        {(pasimStats?.cycles ?? 0) > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono text-blue-400 font-bold">
                pasim (Simulator)
              </span>
              <span className="text-xs font-mono text-zinc-400">
                {pasimStats!.cycles.toLocaleString()} cycles
              </span>
            </div>
            <div className="relative h-6 bg-zinc-800 rounded overflow-hidden">
              <div
                className="h-full bg-blue-500/80 rounded transition-all duration-700"
                style={{
                  width: `${Math.min(
                    100,
                    patemuStats?.cycles
                      ? (pasimStats!.cycles /
                          Math.max(pasimStats!.cycles, patemuStats.cycles)) *
                        100
                      : 100
                  )}%`,
                }}
              />
              <div className="absolute inset-0 flex items-center px-3">
                <span className="text-[11px] font-mono text-white font-bold drop-shadow">
                  {pasimStats!.cycles.toLocaleString()} cyc
                </span>
              </div>
            </div>
          </div>
        )}

        {(patemuStats?.cycles ?? 0) > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono text-purple-400 font-bold">
                patemu (Emulator)
              </span>
              <span className="text-xs font-mono text-zinc-400">
                {patemuStats!.cycles.toLocaleString()} cycles
              </span>
            </div>
            <div className="relative h-6 bg-zinc-800 rounded overflow-hidden">
              <div
                className="h-full bg-purple-500/80 rounded transition-all duration-700"
                style={{
                  width: `${Math.min(
                    100,
                    pasimStats?.cycles
                      ? (patemuStats!.cycles /
                          Math.max(pasimStats.cycles, patemuStats!.cycles)) *
                        100
                      : 100
                  )}%`,
                }}
              />
              <div className="absolute inset-0 flex items-center px-3">
                <span className="text-[11px] font-mono text-white font-bold drop-shadow">
                  {patemuStats!.cycles.toLocaleString()} cyc
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Key metrics grid */}
        <div className="bg-zinc-950 rounded-lg p-3 border border-zinc-800">
          <div className="grid grid-cols-2 gap-3">
            {pasimStats && pasimStats.cycles > 0 && (
              <>
                <QuickStat
                  label="pasim Cycles"
                  value={pasimStats.cycles.toLocaleString()}
                  color="text-blue-400"
                />
                <QuickStat
                  label="pasim Instructions"
                  value={pasimStats.instructions.toLocaleString()}
                  color="text-blue-400"
                />
              </>
            )}
            {patemuStats && patemuStats.cycles > 0 && (
              <>
                <QuickStat
                  label="patemu Cycles"
                  value={patemuStats.cycles.toLocaleString()}
                  color="text-purple-400"
                />
                <QuickStat
                  label="patemu Instructions"
                  value={patemuStats.instructions.toLocaleString()}
                  color="text-purple-400"
                />
              </>
            )}
            {result.gcc && (
              <QuickStat
                label="GCC Wall Time"
                value={`${result.gcc.wall_time_ms.toFixed(0)}ms`}
                color="text-orange-400"
              />
            )}
          </div>
        </div>

        {/* Insight */}
        <div className="text-xs font-mono text-zinc-500 leading-relaxed space-y-1">
          <p>
            <span className="text-blue-400">pasim</span> gives fast
            instruction-level simulation.{" "}
            <span className="text-purple-400">patemu</span> provides
            cycle-accurate hardware emulation matching real Patmos FPGA
            behavior.
          </p>
          <p>
            <span className="text-green-400">
              Patmos guarantees deterministic execution
            </span>{" "}
            — the same code always takes the same number of cycles.
          </p>
        </div>
      </div>
    </div>
  );
}

function QuickStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-mono text-zinc-500 uppercase">
        {label}
      </div>
      <div className={`text-sm font-mono font-bold ${color}`}>{value}</div>
    </div>
  );
}
