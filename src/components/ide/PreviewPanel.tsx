import React from "react";
import { IconRefresh } from "./icons";

export default function PreviewPanel() {
  return (
    <div className="h-full flex flex-col bg-slate-900/40 overflow-hidden">
      {/* Panel header */}
      <div className="h-9 flex items-center justify-between px-3 border-b border-white/[0.06] flex-shrink-0 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
          <span className="text-[11px] text-slate-400 font-mono">Preview</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] transition-all duration-150">
            <IconRefresh size={13} />
          </button>
        </div>
      </div>

      {/* Preview content area */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        {/* Mobile phone frame */}
        <div className="w-[280px] bg-black rounded-[2.5rem] p-2.5 shadow-2xl shadow-black/60 border border-white/[0.08] flex-shrink-0">
          {/* Phone screen */}
          <div className="bg-[#0f172a] rounded-[2rem] overflow-hidden relative">
            {/* Notch */}
            <div className="flex justify-center pt-2 pb-1 relative z-10">
              <div className="w-20 h-5 bg-black rounded-b-2xl" />
            </div>

            {/* App content */}
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
                <p className="text-[9px] text-slate-500 mt-0.5">Real-time WCET Analysis</p>
              </div>

              {/* Gauge visualization */}
              <div className="flex justify-center py-2">
                <div className="relative w-24 h-24">
                  {/* Gauge background ring */}
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
                <MetricCard label="Cycles" value="1,247" trend="stable" />
                <MetricCard label="Jitter" value="0" trend="good" />
                <MetricCard label="BCET" value="1,102" trend="stable" />
                <MetricCard label="Cache Hit" value="96%" trend="good" />
              </div>

              {/* Mini chart */}
              <div className="bg-white/[0.04] rounded-xl p-2.5 border border-white/[0.04]">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] text-slate-400 font-medium">Execution Timeline</span>
                  <span className="text-[8px] text-indigo-400">Live</span>
                </div>
                <div className="flex items-end gap-[3px] h-10">
                  {[60, 45, 72, 55, 80, 40, 65, 50, 75, 42, 68, 55, 70, 48].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-sm"
                      style={{
                        height: `${h}%`,
                        background: h > 70
                          ? "linear-gradient(to top, #6366f1, #818cf8)"
                          : "linear-gradient(to top, #334155, #475569)",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Action button */}
              <button className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-xl text-white text-[11px] font-semibold shadow-lg shadow-indigo-500/30 active:scale-[0.98] transition-transform">
                Run Analysis
              </button>

              {/* Bottom bar */}
              <div className="flex justify-center pt-1">
                <div className="w-28 h-1 bg-white/20 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Metric card used inside the mock preview */
function MetricCard({
  label, value, trend,
}: { label: string; value: string; trend: "good" | "stable" | "bad" }) {
  const trendColor = trend === "good"
    ? "text-emerald-400"
    : trend === "bad"
      ? "text-red-400"
      : "text-slate-400";

  return (
    <div className="bg-white/[0.04] rounded-lg p-2 border border-white/[0.04]">
      <p className="text-[8px] text-slate-500 mb-0.5">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-bold text-white font-mono">{value}</span>
        <span className={`text-[8px] ${trendColor}`}>
          {trend === "good" ? "&#10003;" : trend === "bad" ? "&#9650;" : "&#8212;"}
        </span>
      </div>
    </div>
  );
}
