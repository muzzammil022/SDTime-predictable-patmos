import React from "react";
import { IconClose, IconFile } from "./icons";

export interface Tab {
  id: string;
  name: string;
  language: string;
  isModified: boolean;
}

interface EditorTabsProps {
  tabs: Tab[];
  activeTabId: string;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
}

export default function EditorTabs({ tabs, activeTabId, onTabClick, onTabClose }: EditorTabsProps) {
  return (
    <div className="h-9 bg-slate-900/50 border-b border-white/6 flex items-end overflow-x-auto shrink-0">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => onTabClick(tab.id)}
            className={`group relative flex items-center gap-1.5 h-8.5 px-3 cursor-pointer select-none
              border-r border-white/4 transition-colors duration-150 min-w-0 max-w-40
              ${isActive
                ? "bg-slate-800 text-slate-200"
                : "bg-transparent text-slate-500 hover:text-slate-300 hover:bg-white/2"}`}
          >
            {/* Active tab top indicator */}
            {isActive && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-500" />
            )}

            {/* File icon */}
            <IconFile size={13} className={isActive ? "text-indigo-400" : "text-slate-600"} />

            {/* File name */}
            <span className="text-[11px] font-mono truncate flex-1">
              {tab.name}
            </span>

            {/* Modified dot or close button */}
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              {tab.isModified && !isActive ? (
                <span className="w-2 h-2 rounded-full bg-slate-500/60" />
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(tab.id);
                  }}
                  className={`w-4 h-4 rounded flex items-center justify-center transition-all duration-150
                    ${isActive || tab.isModified
                      ? "opacity-60 hover:opacity-100 hover:bg-white/10"
                      : "opacity-0 group-hover:opacity-60 hover:opacity-100! hover:bg-white/10"}`}
                >
                  {tab.isModified ? (
                    <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  ) : (
                    <IconClose size={12} />
                  )}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Fill remaining space */}
      <div className="flex-1 border-b border-transparent" />
    </div>
  );
}
