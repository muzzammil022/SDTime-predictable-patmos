import React, { useRef, useCallback, useMemo } from "react";

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  language: string;
}

/* C language token sets */
const C_KEYWORDS = new Set([
  "int", "char", "void", "return", "if", "else", "for", "while", "do",
  "break", "continue", "unsigned", "signed", "const", "static", "struct",
  "typedef", "enum", "sizeof", "long", "short", "float", "double",
  "switch", "case", "default",
]);

const C_TYPES = new Set([
  "int", "char", "void", "unsigned", "signed", "long", "short",
  "float", "double", "struct", "enum",
]);

const C_STDLIB = new Set([
  "printf", "scanf", "malloc", "free", "strlen", "strcmp",
  "memcpy", "memset", "NULL", "stdin", "stdout", "stderr",
]);

/* Token regex: matches tokens in priority order */
const TOKEN_REGEX =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|#\s*\w+|\b(?:int|char|void|return|if|else|for|while|do|break|continue|unsigned|signed|const|static|struct|typedef|enum|sizeof|long|short|float|double|switch|case|default)\b|\b\d+\.?\d*[fFLlUu]*\b|\b(?:printf|scanf|malloc|free|strlen|strcmp|memcpy|memset|NULL|stdin|stdout|stderr)\b)/g;

function getTokenColor(token: string): string {
  if (token.startsWith("//") || token.startsWith("/*")) return "#6a9955"; /* green comment */
  if (token.startsWith('"') || token.startsWith("'")) return "#ce9178"; /* amber string */
  if (token.startsWith("#")) return "#c586c0"; /* purple preprocessor */
  if (C_KEYWORDS.has(token)) return "#569cd6"; /* blue keyword */
  if (/^\d/.test(token)) return "#b5cea8"; /* light green number */
  if (C_STDLIB.has(token)) return "#dcdcaa"; /* yellow stdlib */
  return "";
}

/* Highlight code into React nodes */
function highlightCode(code: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  const regex = new RegExp(TOKEN_REGEX.source, "g");
  let match: RegExpExecArray | null;

  while ((match = regex.exec(code)) !== null) {
    /* Text before this match */
    if (match.index > lastIndex) {
      result.push(code.slice(lastIndex, match.index));
    }
    const color = getTokenColor(match[0]);
    if (color) {
      result.push(
        <span key={match.index} style={{ color }}>
          {match[0]}
        </span>
      );
    } else {
      result.push(match[0]);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < code.length) {
    result.push(code.slice(lastIndex));
  }

  return result;
}

export default function CodeEditor({ code, onChange }: CodeEditorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineNumRef = useRef<HTMLDivElement>(null);

  const lines = code.split("\n");

  /* Sync line number scroll with code scroll */
  const handleScroll = useCallback(() => {
    if (scrollRef.current && lineNumRef.current) {
      lineNumRef.current.scrollTop = scrollRef.current.scrollTop;
    }
  }, []);

  /* Memoize highlighted code for performance */
  const highlighted = useMemo(() => highlightCode(code), [code]);

  const monoStyle = { fontFamily: 'var(--font-mono, "Fira Code", monospace)' };

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-800 relative">
      {/* Line numbers gutter */}
      <div
        ref={lineNumRef}
        className="w-13 bg-slate-800 border-r border-white/4 overflow-hidden select-none shrink-0 pt-3"
        style={monoStyle}
      >
        {lines.map((_, i) => (
          <div
            key={i}
            className="h-5.5 text-right pr-3 text-[11px] leading-5.5 text-slate-600"
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* Code editing area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto relative"
        onScroll={handleScroll}
      >
        <div className="relative" style={{ minHeight: "100%" }}>
          {/* Syntax-highlighted display layer */}
          <pre
            className="p-3 text-[13px] leading-5.5 text-[#d4d4d4] whitespace-pre pointer-events-none"
            style={monoStyle}
            aria-hidden="true"
          >
            <code>{highlighted}</code>
            {"\n"}
          </pre>

          {/* Transparent textarea for input */}
          <textarea
            value={code}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="absolute inset-0 w-full h-full resize-none bg-transparent text-transparent
              caret-slate-200 outline-none p-3 text-[13px] leading-5.5 whitespace-pre
              selection:bg-indigo-500/25 z-10"
            style={{ ...monoStyle, tabSize: 4 }}
          />
        </div>
      </div>

      {/* Minimap indicator (decorative) */}
      <div className="w-12.5 bg-slate-800/50 border-l border-white/4 shrink-0 hidden xl:block">
        <div className="mt-3 mx-1.5 space-y-px">
          {lines.slice(0, 60).map((line, i) => (
            <div
              key={i}
              className="h-0.5 rounded-sm bg-slate-600/30"
              style={{ width: `${Math.min(100, Math.max(10, line.length * 1.5))}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
