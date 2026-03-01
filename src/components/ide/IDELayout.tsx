import React, { useState, useCallback, useRef } from "react";
import TopNavbar from "./TopNavbar";
import Sidebar from "./Sidebar";
import type { FileEntry } from "./Sidebar";
import EditorTabs from "./EditorTabs";
import type { Tab } from "./EditorTabs";
import CodeEditor from "./CodeEditor";
import PreviewPanel from "./PreviewPanel";
import BottomPanel from "./BottomPanel";
import { SAMPLE_CODES } from "@/lib/sample-code";
import type { CodeRunnerResponse } from "@/lib/types";

/* Build tab/file entries from sample codes */
interface EditorFile extends Tab {
  content: string;
}

const ALL_FILES: EditorFile[] = SAMPLE_CODES.map((s, i) => ({
  id: `file-${i}`,
  name: `${s.name.toLowerCase().replace(/\s+/g, "-")}.c`,
  language: "c",
  content: s.code,
  isModified: false,
}));

/* Sidebar-compatible file list */
const SIDEBAR_FILES: FileEntry[] = ALL_FILES.map((f) => ({
  id: f.id,
  name: f.name,
}));

/* Initial terminal lines */
const INIT_TERMINAL: string[] = [
  "\x1b[36m$ patmos-cc --version\x1b[0m",
  "patmos-cc v2.0.0 (Patmos Compiler Collection)",
  "\x1b[36m$ pasim --version\x1b[0m",
  "pasim v1.0.5 (Patmos Simulator)",
  "",
  "\x1b[90mReady. Open a file and click Run.\x1b[0m",
  "",
];

type BottomTab = "terminal" | "problems" | "output";

export default function IDELayout() {
  /* --- Sidebar state --- */
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [activeSidebarItem, setActiveSidebarItem] = useState("explorer");

  /* --- Tab / file state --- */
  const [openTabs, setOpenTabs] = useState<EditorFile[]>([ALL_FILES[0], ALL_FILES[1]]);
  const [activeTabId, setActiveTabId] = useState(ALL_FILES[0].id);

  /* --- Bottom panel state --- */
  const [bottomPanelOpen, setBottomPanelOpen] = useState(true);
  const [bottomPanelTab, setBottomPanelTab] = useState<BottomTab>("terminal");
  const [bottomPanelHeight, setBottomPanelHeight] = useState(200);

  /* --- Terminal content --- */
  const [terminalLines, setTerminalLines] = useState<string[]>(INIT_TERMINAL);

  /* --- Execution state --- */
  const [isRunning, setIsRunning] = useState(false);
  const [executionResult, setExecutionResult] = useState<CodeRunnerResponse | null>(null);

  /* --- Preview width (percentage) --- */
  const [previewWidth, setPreviewWidth] = useState(40);

  /* Derived: current active tab */
  const activeTab = openTabs.find((t) => t.id === activeTabId) || openTabs[0];

  /* --- Sidebar toggle --- */
  const handleSidebarToggle = useCallback(
    (item: string) => {
      if (activeSidebarItem === item && sidebarExpanded) {
        setSidebarExpanded(false);
      } else {
        setActiveSidebarItem(item);
        setSidebarExpanded(true);
      }
    },
    [activeSidebarItem, sidebarExpanded]
  );

  /* --- Tab actions --- */
  const handleTabClick = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const handleTabClose = useCallback(
    (tabId: string) => {
      setOpenTabs((prev) => {
        const remaining = prev.filter((t) => t.id !== tabId);
        if (remaining.length === 0) return prev;
        if (activeTabId === tabId) {
          setActiveTabId(remaining[0].id);
        }
        return remaining;
      });
    },
    [activeTabId]
  );

  /* --- File open from sidebar explorer --- */
  const handleFileOpen = useCallback(
    (fileId: string) => {
      const file = ALL_FILES.find((f) => f.id === fileId);
      if (!file) return;
      if (!openTabs.find((t) => t.id === fileId)) {
        setOpenTabs((prev) => [...prev, file]);
      }
      setActiveTabId(fileId);
    },
    [openTabs]
  );

  /* --- Code editing --- */
  const handleCodeChange = useCallback(
    (newCode: string) => {
      setOpenTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId ? { ...t, content: newCode, isModified: true } : t
        )
      );
    },
    [activeTabId]
  );

  /* --- Run code --- */
  const handleRun = useCallback(async () => {
    if (isRunning || !activeTab) return;

    setIsRunning(true);
    setBottomPanelOpen(true);
    setBottomPanelTab("terminal");

    const fileName = activeTab.name;
    setTerminalLines((prev) => [
      ...prev,
      `\x1b[36m$ patmos-cc ${fileName} -o ${fileName.replace(".c", "")}\x1b[0m`,
      "Compiling...",
    ]);

    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: activeTab.content, language: "c" }),
      });
      const data: CodeRunnerResponse = await res.json();
      setExecutionResult(data);

      setTerminalLines((prev) => [
        ...prev,
        data.success
          ? "\x1b[32mCompilation successful.\x1b[0m"
          : `\x1b[31mError: ${data.error}\x1b[0m`,
        `\x1b[36m$ pasim ${fileName.replace(".c", "")}\x1b[0m`,
        ...(data.output ? data.output.split("\n") : []),
        "",
        `\x1b[33m[Patmos] Cycles: ${data.timing.patmos.cycles} | WCET: ${data.timing.patmos.wcet} | Jitter: ${data.timing.patmos.jitter}\x1b[0m`,
        `\x1b[35m[Normal] Cycles: ${data.timing.normal.cycles} | WCET: ${data.timing.normal.wcet} | Jitter: ${data.timing.normal.jitter}\x1b[0m`,
        "",
      ]);
    } catch {
      setTerminalLines((prev) => [
        ...prev,
        "\x1b[31mExecution failed. Check connection.\x1b[0m",
        "",
      ]);
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, activeTab]);

  /* --- Horizontal resize (editor <-> preview) --- */
  const containerRef = useRef<HTMLDivElement>(null);
  const isResizingH = useRef(false);

  const handleHResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizingH.current = true;

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isResizingH.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const pct = ((rect.right - ev.clientX) / rect.width) * 100;
        setPreviewWidth(Math.max(18, Math.min(55, pct)));
      };

      const handleMouseUp = () => {
        isResizingH.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    []
  );

  /* --- Vertical resize (main area <-> bottom panel) --- */
  const isResizingV = useRef(false);

  const handleVResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizingV.current = true;
      const startY = e.clientY;
      const startH = bottomPanelHeight;

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isResizingV.current) return;
        const delta = startY - ev.clientY;
        setBottomPanelHeight(Math.max(80, Math.min(500, startH + delta)));
      };

      const handleMouseUp = () => {
        isResizingV.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [bottomPanelHeight]
  );

  /* --- Toggle terminal from navbar --- */
  const handleToggleTerminal = useCallback(() => {
    setBottomPanelOpen((prev) => !prev);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-200 overflow-hidden">
      {/* Top navigation bar */}
      <TopNavbar
        onRun={handleRun}
        isRunning={isRunning}
        onToggleTerminal={handleToggleTerminal}
        terminalVisible={bottomPanelOpen}
      />

      {/* Main content: sidebar + editor area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <Sidebar
          expanded={sidebarExpanded}
          activeItem={activeSidebarItem}
          onItemClick={handleSidebarToggle}
          files={SIDEBAR_FILES}
          onFileOpen={handleFileOpen}
          activeFileId={activeTabId}
        />

        {/* Editor + Preview + Bottom panel */}
        <div className="flex-1 flex flex-col overflow-hidden" ref={containerRef}>
          {/* Top: Editor + Preview (horizontal split) */}
          <div className="flex-1 flex overflow-hidden">
            {/* Editor column */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              <EditorTabs
                tabs={openTabs}
                activeTabId={activeTabId}
                onTabClick={handleTabClick}
                onTabClose={handleTabClose}
              />
              <CodeEditor
                code={activeTab?.content || ""}
                onChange={handleCodeChange}
                language={activeTab?.language || "c"}
              />
            </div>

            {/* Horizontal resize handle */}
            <div
              className="w-0.75 cursor-col-resize shrink-0 bg-transparent hover:bg-indigo-500/50 active:bg-indigo-500 transition-colors duration-100 relative group"
              onMouseDown={handleHResizeStart}
            >
              <div className="absolute inset-y-0 -left-1 -right-1" />
            </div>

            {/* Preview panel */}
            <div
              style={{ width: `${previewWidth}%` }}
              className="shrink-0 overflow-hidden"
            >
              <PreviewPanel />
            </div>
          </div>

          {/* Vertical resize handle (above bottom panel) */}
          {bottomPanelOpen && (
            <div
              className="h-0.75 cursor-row-resize shrink-0 bg-transparent hover:bg-indigo-500/50 active:bg-indigo-500 transition-colors duration-100 relative group"
              onMouseDown={handleVResizeStart}
            >
              <div className="absolute inset-x-0 -top-1 -bottom-1" />
            </div>
          )}

          {/* Bottom panel */}
          {bottomPanelOpen && (
            <BottomPanel
              height={bottomPanelHeight}
              activeTab={bottomPanelTab}
              onTabChange={setBottomPanelTab}
              onClose={() => setBottomPanelOpen(false)}
              terminalLines={terminalLines}
              executionResult={executionResult}
            />
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="h-6 bg-indigo-600 flex items-center justify-between px-3 text-[11px] text-white/90 shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="6" y1="3" x2="6" y2="15" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 9a9 9 0 01-9 9" />
            </svg>
            ide/ui/patmos
          </span>
          <span className="opacity-60">|</span>
          <span>0 errors, 0 warnings</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Ln 1, Col 1</span>
          <span className="opacity-60">|</span>
          <span>UTF-8</span>
          <span className="opacity-60">|</span>
          <span>C</span>
          <span className="opacity-60">|</span>
          <span>Patmos Compiler</span>
        </div>
      </div>
    </div>
  );
}
