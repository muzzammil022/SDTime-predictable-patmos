import React, { useState } from "react";
import { IconSearch, IconPlay, IconBell, IconSettings, IconPanelBottom } from "./icons";

interface TopNavbarProps {
  onRun: () => void;
  isRunning: boolean;
  onToggleTerminal: () => void;
  terminalVisible: boolean;
}

export default function TopNavbar({ onRun, isRunning, onToggleTerminal, terminalVisible }: TopNavbarProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);

  return (
    <nav className="h-14 flex items-center px-4 bg-slate-900/85 backdrop-blur-xl border-b border-white/6 shrink-0 z-30 relative">
      {/* Logo */}
      <div className="flex items-center gap-2.5 min-w-45">
        <div className="w-7 h-7 rounded-lg bg-linear-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
          <span className="text-white font-bold text-xs font-mono">P</span>
        </div>
        <span className="text-sm font-semibold text-slate-200 tracking-tight">
          Patmos<span className="text-indigo-400">IDE</span>
        </span>
        <span className="text-[10px] text-slate-500 bg-slate-800/80 px-1.5 py-0.5 rounded font-mono">
          v0.2
        </span>
      </div>

      {/* Center search bar */}
      <div className="flex-1 flex justify-center px-8">
        <div className="relative w-full max-w-md">
          <IconSearch
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            placeholder="Search files, symbols..."
            className={`w-full h-8 pl-9 pr-16 rounded-lg bg-white/4 border text-sm text-slate-200
              placeholder:text-slate-500/60 focus:outline-none search-glow transition-all duration-200
              ${searchFocused ? "border-indigo-500/40 bg-white/7" : "border-white/6"}`}
            style={{ fontFamily: "var(--font-sans)" }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500/70 bg-white/4 px-1.5 py-0.5 rounded border border-white/8">
            Ctrl+K
          </kbd>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1 min-w-55 justify-end">
        {/* Toggle terminal */}
        <button
          onClick={onToggleTerminal}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200
            ${terminalVisible ? "text-indigo-400 bg-indigo-500/10" : "text-slate-400 hover:text-slate-200 hover:bg-white/4"}`}
          title="Toggle Terminal"
        >
          <IconPanelBottom size={16} />
        </button>

        {/* Run button */}
        <button
          onClick={onRun}
          disabled={isRunning}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 mx-1
            ${isRunning
              ? "bg-indigo-500/15 text-indigo-400 cursor-wait"
              : "bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"}`}
        >
          {isRunning ? (
            <span className="pulse-dot text-sm leading-none">&#9679;</span>
          ) : (
            <IconPlay size={11} />
          )}
          {isRunning ? "Running..." : "Run"}
        </button>

        <div className="w-px h-5 bg-white/6 mx-1" />

        {/* Notifications */}
        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/4 transition-all duration-200 relative">
          <IconBell size={16} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full ring-2 ring-slate-900" />
        </button>

        {/* Settings */}
        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/4 transition-all duration-200">
          <IconSettings size={16} />
        </button>

        {/* User avatar */}
        <div className="relative ml-1">
          <button
            onClick={() => setAvatarOpen(!avatarOpen)}
            className="w-7 h-7 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold ring-2 ring-transparent hover:ring-indigo-500/30 transition-all duration-200"
          >
            SD
          </button>
          {avatarOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-white/10 rounded-xl shadow-2xl shadow-black/50 py-1.5 z-50">
              <div className="px-3 py-2 border-b border-white/6">
                <p className="text-xs font-medium text-slate-200">SDTime Dev</p>
                <p className="text-[10px] text-slate-500">dev@patmos-ide.local</p>
              </div>
              <button className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-white/4 transition-colors">
                Profile
              </button>
              <button className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-white/4 transition-colors">
                Preferences
              </button>
              <div className="border-t border-white/6 mt-1 pt-1">
                <button className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors">
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
