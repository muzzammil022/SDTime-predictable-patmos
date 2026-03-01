import React, { useRef, useEffect } from "react";
import { IconClose, IconTerminal, IconAlertTriangle, IconOutput } from "./icons";

type BottomTab = "terminal" | "problems" | "output";

interface BottomPanelProps {
  height: number;
  activeTab: BottomTab;
  onTabChange: (tab: BottomTab) => void;
  onClose: () => void;
  terminalLines: string[];
  executionResult: {
    timing?: {
      patmos: { cycles: number; wcet: number; jitter: number };
      normal: { cycles: number; wcet: number; jitter: number };
      predictabilityGain: number;
    };
  } | null;
}

const TABS: { id: BottomTab; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
  { id: "terminal", label: "Terminal", icon: IconTerminal },
  { id: "problems", label: "Problems", icon: IconAlertTriangle },
  { id: "output", label: "Output", icon: IconOutput },
];

/* Parse basic ANSI color codes for terminal display */
function parseTerminalLine(line: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = line;
  let key = 0;

  const colorMap: Record<string, string> = {
    "31": "#f87171", /* red */
    "32": "#4ade80", /* green */
    "33": "#facc15", /* yellow */
    "35": "#c084fc", /* purple */
    "36": "#22d3ee", /* cyan */
    "90": "#64748b", /* gray */
  };

  while (remaining.length > 0) {
    const ansiMatch = remaining.match(/\x1b\[(\d+)m/);
    if (!ansiMatch) {
      parts.push(remaining);
      break;
    }

    /* Push text before the ANSI code */
    if (ansiMatch.index && ansiMatch.index > 0) {
      parts.push(remaining.slice(0, ansiMatch.index));
    }

    const colorCode = ansiMatch[1];
    remaining = remaining.slice((ansiMatch.index || 0) + ansiMatch[0].length);

    /* Find the closing reset code */
    const endMatch = remaining.match(/\x1b\[0m/);
    if (endMatch && endMatch.index !== undefined) {
      const colored = remaining.slice(0, endMatch.index);
      const color = colorMap[colorCode] || "#94a3b8";
      parts.push(
        <span key={key++} style={{ color }}>
          {colored}
        </span>
      );
      remaining = remaining.slice(endMatch.index + endMatch[0].length);
    } else {
      /* No closing tag - color the rest */
      const color = colorMap[colorCode] || "#94a3b8";
      parts.push(
        <span key={key++} style={{ color }}>
          {remaining}
        </span>
      );
      remaining = "";
    }
  }

  return <>{parts}</>;
}

function TerminalContent({ lines }: { lines: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  /* Auto-scroll to bottom on new lines */
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto p-3"
      style={{ fontFamily: 'var(--font-mono, "Fira Code", monospace)' }}
    >
      {lines.map((line, i) => (
        <div key={i} className="text-[12px] leading-5 text-slate-300 whitespace-pre-wrap">
          {parseTerminalLine(line)}
        </div>
      ))}
    </div>
  );
}

function ProblemsContent() {
  return (
    <div className="flex-1 overflow-auto p-3">
      <div className="flex items-center gap-2 text-[12px] text-slate-500">
        <IconAlertTriangle size={14} />
        <span>No problems detected in workspace.</span>
      </div>
    </div>
  );
}

function OutputContent({
  result,
}: {
  result: BottomPanelProps["executionResult"];
}) {
  if (!result?.timing) {
    return (
      <div className="flex-1 overflow-auto p-3">
        <p className="text-[12px] text-slate-500">Run code to see timing output.</p>
      </div>
    );
  }

  const { patmos, normal, predictabilityGain } = result.timing;

  return (
    <div className="flex-1 overflow-auto p-3 space-y-2" style={{ fontFamily: 'var(--font-mono, monospace)' }}>
      <div className="text-[12px] leading-5">
        <span className="text-indigo-400">[Patmos]</span>
        <span className="text-slate-300">
          {" "}Cycles: {patmos.cycles} | WCET: {patmos.wcet} | Jitter: {patmos.jitter}
        </span>
      </div>
      <div className="text-[12px] leading-5">
        <span className="text-purple-400">[Normal]</span>
        <span className="text-slate-300">
          {" "}Cycles: {normal.cycles} | WCET: {normal.wcet} | Jitter: {normal.jitter}
        </span>
      </div>
      <div className="border-t border-white/6 pt-2 mt-2">
        <div className="text-[12px] leading-5">
          <span className="text-emerald-400">[Result]</span>
          <span className="text-slate-300">
            {" "}Predictability gain: {predictabilityGain.toFixed(1)}x
            {patmos.jitter === 0 && " — Zero jitter on Patmos"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function BottomPanel({
  height, activeTab, onTabChange, onClose, terminalLines, executionResult,
}: BottomPanelProps) {
  return (
    <div
      className="flex flex-col bg-[#0d1117] border-t border-white/6 shrink-0"
      style={{ height }}
    >
      {/* Tab bar */}
      <div className="h-8 flex items-center justify-between px-2 border-b border-white/6 shrink-0">
        <div className="flex items-center gap-0.5">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] transition-all duration-150
                  ${isActive
                    ? "text-slate-200 bg-white/6"
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/3"}`}
              >
                <tab.icon size={13} />
                {tab.label}
                {tab.id === "problems" && (
                  <span className="ml-0.5 text-[9px] bg-emerald-500/20 text-emerald-400 px-1 rounded">
                    0
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/6 transition-colors"
        >
          <IconClose size={14} />
        </button>
      </div>

      {/* Content */}
      {activeTab === "terminal" && <TerminalContent lines={terminalLines} />}
      {activeTab === "problems" && <ProblemsContent />}
      {activeTab === "output" && <OutputContent result={executionResult} />}
    </div>
  );
}
