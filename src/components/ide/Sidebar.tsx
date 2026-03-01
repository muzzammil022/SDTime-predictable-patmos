import React, { useState } from "react";
import {
  IconExplorer, IconSearch, IconGitBranch, IconExtensions,
  IconSettings, IconChevronRight, IconChevronDown, IconFile, IconFolder,
} from "./icons";

export interface FileEntry {
  id: string;
  name: string;
}

interface SidebarProps {
  expanded: boolean;
  activeItem: string;
  onItemClick: (item: string) => void;
  files: FileEntry[];
  onFileOpen: (fileId: string) => void;
  activeFileId: string;
}

/* Sidebar nav items */
const NAV_ITEMS = [
  { id: "explorer", label: "Explorer", icon: IconExplorer },
  { id: "search", label: "Search", icon: IconSearch },
  { id: "source-control", label: "Source Control", icon: IconGitBranch },
  { id: "extensions", label: "Extensions", icon: IconExtensions },
  { id: "settings", label: "Settings", icon: IconSettings },
];

/* Static folder structure for display */
interface FolderNode {
  name: string;
  type: "folder";
  children: (FolderNode | { name: string; type: "file"; fileId?: string })[];
  defaultOpen?: boolean;
}

function buildFileTree(files: FileEntry[]): FolderNode {
  return {
    name: "src",
    type: "folder",
    defaultOpen: true,
    children: [
      {
        name: "algorithms",
        type: "folder",
        defaultOpen: true,
        children: files.map((f) => ({ name: f.name, type: "file" as const, fileId: f.id })),
      },
      {
        name: "simulation",
        type: "folder",
        children: [{ name: "car-demo.c", type: "file" as const }],
      },
      {
        name: "config",
        type: "folder",
        children: [{ name: "patmos-config.h", type: "file" as const }],
      },
    ],
  };
}

/* Recursive tree renderer */
function TreeNode({
  node,
  depth,
  onFileOpen,
  activeFileId,
}: {
  node: FolderNode | { name: string; type: "file"; fileId?: string };
  depth: number;
  onFileOpen: (id: string) => void;
  activeFileId: string;
}) {
  const [open, setOpen] = useState(
    node.type === "folder" ? (node as FolderNode).defaultOpen ?? false : false
  );

  if (node.type === "file") {
    const isActive = "fileId" in node && node.fileId === activeFileId;
    return (
      <button
        onClick={() => node.fileId && onFileOpen(node.fileId)}
        className={`w-full flex items-center gap-1.5 py-0.75 text-left transition-colors duration-150 rounded-sm
          ${isActive
            ? "bg-indigo-500/15 text-indigo-300"
            : node.fileId
              ? "text-slate-400 hover:text-slate-200 hover:bg-white/4"
              : "text-slate-500 cursor-default"}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <IconFile size={14} className={isActive ? "text-indigo-400" : "text-slate-500"} />
        <span className="text-[11px] font-mono truncate">{node.name}</span>
      </button>
    );
  }

  const folder = node as FolderNode;
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1 py-0.75 text-slate-400 hover:text-slate-200 transition-colors duration-150 rounded-sm hover:bg-white/4"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        <IconFolder size={14} className="text-slate-500" />
        <span className="text-[11px] font-mono">{folder.name}</span>
      </button>
      {open && (
        <div>
          {folder.children.map((child, i) => (
            <TreeNode
              key={i}
              node={child}
              depth={depth + 1}
              onFileOpen={onFileOpen}
              activeFileId={activeFileId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* Sidebar panel content for each nav item */
function ExplorerPanel({
  files, onFileOpen, activeFileId,
}: { files: FileEntry[]; onFileOpen: (id: string) => void; activeFileId: string }) {
  const tree = buildFileTree(files);
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
        Explorer
      </div>
      <div className="px-1 flex-1 overflow-y-auto">
        <div className="mb-1">
          <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Patmos Workspace
          </div>
        </div>
        <TreeNode node={tree} depth={0} onFileOpen={onFileOpen} activeFileId={activeFileId} />
      </div>
    </div>
  );
}

function SearchPanel() {
  return (
    <div className="px-3 py-2">
      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
        Search
      </div>
      <input
        type="text"
        placeholder="Search..."
        className="w-full h-7 px-2 rounded bg-white/4 border border-white/6 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/40 transition-colors"
      />
      <p className="text-[10px] text-slate-500 mt-3 text-center">Type to search across files</p>
    </div>
  );
}

function SourceControlPanel() {
  return (
    <div className="px-3 py-2">
      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
        Source Control
      </div>
      <div className="flex items-center gap-2 px-2 py-3">
        <IconGitBranch size={14} className="text-slate-500" />
        <span className="text-[11px] text-slate-400 font-mono">ide/ui/patmos</span>
      </div>
      <p className="text-[10px] text-slate-500 text-center mt-2">No uncommitted changes</p>
    </div>
  );
}

function ExtensionsPanel() {
  const extensions = [
    { name: "Patmos Compiler", desc: "C compiler for Patmos", active: true },
    { name: "WCET Analyzer", desc: "Worst-case execution time", active: true },
    { name: "Timing Vis", desc: "Timing visualization", active: false },
  ];
  return (
    <div className="px-3 py-2">
      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
        Extensions
      </div>
      <div className="space-y-1">
        {extensions.map((ext) => (
          <div key={ext.name} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/4 transition-colors">
            <div className={`w-2 h-2 rounded-full ${ext.active ? "bg-green-500" : "bg-slate-600"}`} />
            <div>
              <p className="text-[11px] text-slate-300">{ext.name}</p>
              <p className="text-[9px] text-slate-500">{ext.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsPanel() {
  return (
    <div className="px-3 py-2">
      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
        Settings
      </div>
      <div className="space-y-2">
        {[
          { label: "Auto Save", value: true },
          { label: "Word Wrap", value: false },
          { label: "Minimap", value: false },
          { label: "Bracket Pairs", value: true },
        ].map((s) => (
          <div key={s.label} className="flex items-center justify-between px-2 py-1">
            <span className="text-[11px] text-slate-400">{s.label}</span>
            <div className={`w-7 h-4 rounded-full transition-colors ${s.value ? "bg-indigo-500" : "bg-slate-700"} relative`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${s.value ? "left-3.5" : "left-0.5"}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Sidebar({
  expanded, activeItem, onItemClick, files, onFileOpen, activeFileId,
}: SidebarProps) {
  return (
    <div className="flex h-full shrink-0">
      {/* Icon rail - always visible */}
      <div className="w-12 bg-slate-950 border-r border-white/6 flex flex-col items-center py-2 gap-1 shrink-0">
        {NAV_ITEMS.map((item) => {
          const isActive = activeItem === item.id && expanded;
          return (
            <div key={item.id} className="tooltip-host">
              <button
                onClick={() => onItemClick(item.id)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 relative
                  ${isActive
                    ? "text-white bg-white/8"
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/4"}`}
              >
                <item.icon size={20} />
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-500 rounded-r" />
                )}
              </button>
              {!expanded && <span className="tooltip-text">{item.label}</span>}
            </div>
          );
        })}
      </div>

      {/* Expanded panel */}
      <div
        className="bg-slate-900/60 border-r border-white/6 overflow-hidden transition-all duration-200 ease-out"
        style={{ width: expanded ? 220 : 0 }}
      >
        <div className="w-55 h-full overflow-y-auto">
          {activeItem === "explorer" && (
            <ExplorerPanel files={files} onFileOpen={onFileOpen} activeFileId={activeFileId} />
          )}
          {activeItem === "search" && <SearchPanel />}
          {activeItem === "source-control" && <SourceControlPanel />}
          {activeItem === "extensions" && <ExtensionsPanel />}
          {activeItem === "settings" && <SettingsPanel />}
        </div>
      </div>
    </div>
  );
}
