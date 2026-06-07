import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";

import { 
  GitBranch, Folder, File, ChevronRight, ChevronLeft, ChevronDown, Check, ArrowUp, RefreshCw, AlertTriangle,
  ChevronsDownUp, ChevronsUpDown
} from "lucide-react";
import "./styles.css";

type FileStatus = "modified" | "added" | "deleted" | "renamed" | "conflicted" | "untracked";

type ChangedFile = {
  path: string;
  oldPath: string | null;
  status: FileStatus;
  gitStatus: string;
  hasConflictMarkers: boolean;
};

type ProjectInspection = {
  selectedPath: string;
  repoRoot: string | null;
  isGitRepo: boolean;
  files: ChangedFile[];
  error: string | null;
};

type ConflictBlock = {
  label: string | null;
  ours: string;
  theirs: string;
};

type FileDiff = {
  path: string;
  status: FileStatus;
  baseline: string;
  working: string;
  conflicts: ConflictBlock[];
};

type TreeNode = {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
  file?: ChangedFile;
};

type ViewMode = "1way" | "2way" | "3way";

interface DiffChunk {
  id: number;
  type: 'equal' | 'modified' | 'added' | 'deleted' | 'mine_only' | 'theirs_only' | 'identical_change' | 'conflict';
  mIdxs: number[];
  bIdxs: number[];
  tIdxs: number[];
  mLines: string[];
  bLines: string[];
  tLines: string[];
  resLines: string[];
  resolved: boolean;
  mineWordDiff: number[];
  theirsWordDiff: number[];
  resultWordDiff: number[];
  resIdxStart?: number;
}

type DisplayChunk =
  | (DiffChunk & { display: 'lines' })
  | { display: 'separator'; separatorId: string; hiddenCount: number; chunkId: number };

const CONTEXT_LINES = 3;

const connectorColors: Record<string, { fill: string; stroke: string }> = {
  modified: { fill: "rgba(56, 85, 112, 0.3)", stroke: "rgba(74, 136, 199, 0.6)" },
  added: { fill: "rgba(41, 68, 54, 0.4)", stroke: "rgba(92, 159, 80, 0.6)" },
  deleted: { fill: "rgba(72, 74, 74, 0.3)", stroke: "rgba(107, 107, 107, 0.6)" },
  conflict: { fill: "rgba(92, 51, 51, 0.4)", stroke: "rgba(255, 107, 104, 0.6)" },
};

const statusLabel: Record<FileStatus, string> = {
  modified: "M",
  added: "A",
  deleted: "D",
  renamed: "R",
  conflicted: "C",
  untracked: "?",
};

const gitColorClass: Record<FileStatus, string> = {
  modified: "git-modified",
  added: "git-added",
  deleted: "git-deleted",
  renamed: "git-renamed",
  conflicted: "git-conflict",
  untracked: "git-untracked",
};

const gitBadgeClass: Record<FileStatus, string> = {
  modified: "bg-modified",
  added: "bg-added",
  deleted: "bg-deleted",
  renamed: "bg-renamed",
  conflicted: "bg-conflict",
  untracked: "bg-untracked",
};

const viewModeLabels: Record<ViewMode, string> = {
  "1way": "Editor",
  "2way": "Side-by-side Viewer",
  "3way": "3-Way Merge"
};

// --- LCS Alignment Engine ---
function lcsAlign(A: string[], B: string[]): { aIdx: number | null; bIdx: number | null }[] {
  const matrix: Int32Array[] = Array(A.length + 1);
  for (let i = 0; i <= A.length; i++) {
    matrix[i] = new Int32Array(B.length + 1);
  }
  
  for (let i = 1; i <= A.length; i++) {
    for (let j = 1; j <= B.length; j++) {
      if (A[i - 1] === B[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
      } else {
        matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
      }
    }
  }

  const result: { aIdx: number | null; bIdx: number | null }[] = [];
  let i = A.length;
  let j = B.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && A[i - 1] === B[j - 1]) {
      result.unshift({ aIdx: i - 1, bIdx: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
      result.unshift({ aIdx: null, bIdx: j - 1 });
      j--;
    } else if (i > 0 && (j === 0 || matrix[i][j - 1] < matrix[i - 1][j])) {
      result.unshift({ aIdx: i - 1, bIdx: null });
      i--;
    }
  }
  return result;
}

function getWordDiff(newText: string, oldText: string): number[] {
  const diff = new Array(newText.length).fill(0);
  if (newText.length * oldText.length > 500000) return diff;
  const arrN = newText.split('');
  const arrO = oldText.split('');
  const align = lcsAlign(arrN, arrO); 
  for (const r of align) {
    if (r.aIdx !== null && r.bIdx === null) {
      diff[r.aIdx] = 1;
    }
  }
  return diff;
}

function build3WayAlignment(baseLines: string[], mineLines: string[], theirsLines: string[]) {
  const alignM = lcsAlign(baseLines, mineLines);
  const alignT = lcsAlign(baseLines, theirsLines);

  const baseMap = Array.from({ length: baseLines.length + 1 }, () => ({
    mineMatch: null as number | null,
    theirsMatch: null as number | null,
    mineInserts: [] as number[],
    theirsInserts: [] as number[]
  }));

  let currBase = 0;
  for (const row of alignM) {
    if (row.aIdx === null) {
      if (row.bIdx !== null) baseMap[currBase].mineInserts.push(row.bIdx);
    } else {
      currBase = row.aIdx;
      baseMap[currBase].mineMatch = row.bIdx;
      currBase++;
    }
  }

  currBase = 0;
  for (const row of alignT) {
    if (row.aIdx === null) {
      if (row.bIdx !== null) baseMap[currBase].theirsInserts.push(row.bIdx);
    } else {
      currBase = row.aIdx;
      baseMap[currBase].theirsMatch = row.bIdx;
      currBase++;
    }
  }

  const finalRows: { baseIdx: number | null; mineIdx: number | null; theirsIdx: number | null }[] = [];
  for (let i = 0; i <= baseLines.length; i++) {
    const item = baseMap[i];
    if (item.mineInserts.length > 0 || item.theirsInserts.length > 0) {
      const insM = item.mineInserts.map(idx => mineLines[idx]);
      const insT = item.theirsInserts.map(idx => theirsLines[idx]);
      const insAlign = lcsAlign(insM, insT);
      for (const row of insAlign) {
        finalRows.push({
          baseIdx: null,
          mineIdx: row.aIdx !== null ? item.mineInserts[row.aIdx] : null,
          theirsIdx: row.bIdx !== null ? item.theirsInserts[row.bIdx] : null
        });
      }
    }
    if (i < baseLines.length) {
      finalRows.push({ baseIdx: i, mineIdx: item.mineMatch, theirsIdx: item.theirsMatch });
    }
  }
  return finalRows;
}

function buildChunks(
  finalRows: { baseIdx: number | null; mineIdx: number | null; theirsIdx: number | null }[],
  baseLines: string[],
  mineLines: string[],
  theirsLines: string[]
): DiffChunk[] {
  const chunks: { id: number; isImperfect: boolean; rows: typeof finalRows }[] = [];
  let currentChunk: typeof chunks[0] | null = null;
  let chunkId = 0;

  for (const row of finalRows) {
    const isPerfect = row.baseIdx !== null && row.mineIdx !== null && row.theirsIdx !== null
      && mineLines[row.mineIdx] === baseLines[row.baseIdx]
      && theirsLines[row.theirsIdx] === baseLines[row.baseIdx];
      
    if (isPerfect) {
      if (currentChunk && currentChunk.isImperfect) { chunks.push(currentChunk); currentChunk = null; }
      if (!currentChunk) currentChunk = { id: chunkId++, isImperfect: false, rows: [] };
      currentChunk.rows.push(row);
    } else {
      if (currentChunk && !currentChunk.isImperfect) { chunks.push(currentChunk); currentChunk = null; }
      if (!currentChunk) currentChunk = { id: chunkId++, isImperfect: true, rows: [] };
      currentChunk.rows.push(row);
    }
  }
  if (currentChunk) chunks.push(currentChunk);

  return chunks.map(chunk => {
    const mIdxs: number[] = [];
    const bIdxs: number[] = [];
    const tIdxs: number[] = [];
    
    for (const r of chunk.rows) {
      if (r.mineIdx !== null && !mIdxs.includes(r.mineIdx)) mIdxs.push(r.mineIdx);
      if (r.baseIdx !== null && !bIdxs.includes(r.baseIdx)) bIdxs.push(r.baseIdx);
      if (r.theirsIdx !== null && !tIdxs.includes(r.theirsIdx)) tIdxs.push(r.theirsIdx);
    }
    
    const mLines = mIdxs.map(i => mineLines[i]);
    const bLines = bIdxs.map(i => baseLines[i]);
    const tLines = tIdxs.map(i => theirsLines[i]);
    
    const mStr = mLines.join('\n');
    const bStr = bLines.join('\n');
    const tStr = tLines.join('\n');
    
    let type: DiffChunk['type'];
    if (mStr === bStr && tStr === bStr) type = 'equal';
    else if (mStr !== bStr && tStr === bStr) type = 'mine_only';
    else if (mStr === bStr && tStr !== bStr) type = 'theirs_only';
    else if (mStr === tStr) type = 'identical_change';
    else type = 'conflict';
    
    let resLines: string[] = [];
    if (type === 'mine_only' || type === 'identical_change') resLines = [...mLines];
    else if (type === 'theirs_only') resLines = [...tLines];
    else resLines = [...bLines];
    
    return {
      id: chunk.id,
      type,
      resolved: type !== 'conflict',
      mIdxs,
      bIdxs,
      tIdxs,
      mLines,
      bLines,
      tLines,
      resLines,
      mineWordDiff: getWordDiff(mStr, bStr),
      theirsWordDiff: getWordDiff(tStr, bStr),
      resultWordDiff: getWordDiff(resLines.join('\n'), bStr)
    };
  });
}

function build2WayChunks(baseLines: string[], mineLines: string[]): DiffChunk[] {
  const align = lcsAlign(baseLines, mineLines);
  const chunks: { id: number; isImperfect: boolean; rows: typeof align }[] = [];
  let cur: typeof chunks[0] | null = null;
  let id = 0;
  
  for (const row of align) {
    const isPerfect = row.aIdx !== null && row.bIdx !== null && baseLines[row.aIdx] === mineLines[row.bIdx];
    if (isPerfect) {
      if (cur && cur.isImperfect) { chunks.push(cur); cur = null; }
      if (!cur) cur = { id: id++, isImperfect: false, rows: [] };
      cur.rows.push(row);
    } else {
      if (cur && !cur.isImperfect) { chunks.push(cur); cur = null; }
      if (!cur) cur = { id: id++, isImperfect: true, rows: [] };
      cur.rows.push(row);
    }
  }
  if (cur) chunks.push(cur);
  
  return chunks.map(chunk => {
    const bIdxs = chunk.rows.map(r => r.aIdx).filter((i): i is number => i !== null);
    const mIdxs = chunk.rows.map(r => r.bIdx).filter((i): i is number => i !== null);
    const bLines = bIdxs.map(i => baseLines[i]);
    const mLines = mIdxs.map(i => mineLines[i]);
    
    let type: DiffChunk['type'];
    if (!chunk.isImperfect) type = 'equal';
    else if (bLines.length > 0 && mLines.length > 0) type = 'modified';
    else if (bLines.length === 0) type = 'added';
    else type = 'deleted';
    
    return {
      id: chunk.id,
      type,
      resolved: true,
      mIdxs,
      bIdxs,
      tIdxs: [],
      mLines,
      bLines,
      tLines: [],
      resLines: [],
      mineWordDiff: getWordDiff(mLines.join('\n'), bLines.join('\n')),
      theirsWordDiff: [],
      resultWordDiff: []
    };
  });
}

function parseConflictMarkers(rawText: string) {
  const lines = rawText.split('\n');
  const baseLines: string[] = [];
  const mineLines: string[] = [];
  const theirsLines: string[] = [];
  let state: 'NORMAL' | 'MINE' | 'BASE' | 'THEIRS' = 'NORMAL';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('<<<<<<<')) {
      state = 'MINE';
    } else if (line.startsWith('|||||||')) {
      state = 'BASE';
    } else if (line.startsWith('=======')) {
      state = 'THEIRS';
    } else if (line.startsWith('>>>>>>>')) {
      state = 'NORMAL';
    } else {
      if (state === 'NORMAL') {
        baseLines.push(line);
        mineLines.push(line);
        theirsLines.push(line);
      } else if (state === 'MINE') {
        mineLines.push(line);
      } else if (state === 'BASE') {
        baseLines.push(line);
      } else if (state === 'THEIRS') {
        theirsLines.push(line);
      }
    }
  }
  return {
    base: baseLines.join('\n'),
    mine: mineLines.join('\n'),
    theirs: theirsLines.join('\n')
  };
}

// --- Syntax Highlighting Helpers ---
const CODE_KEYWORDS = new Set([
  'import', 'export', 'const', 'let', 'var', 'function', 'return', 'if', 'else', 
  'for', 'while', 'do', 'class', 'extends', 'new', 'try', 'catch', 'finally', 
  'switch', 'case', 'break', 'continue', 'true', 'false', 'null', 'undefined',
  'package', 'func', 'struct', 'type', 'interface', 'map', 'range', 'go', 'select', 
  'chan', 'defer', 'import', 'func', 'struct', 'type', 'interface'
]);

function highlightTokens(text: string): { start: number; end: number; type: string }[] {
  const tokens: { start: number; end: number; type: string }[] = [];
  
  // 1. Strings
  const stringRegex = /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`/g;
  let match;
  while ((match = stringRegex.exec(text)) !== null) {
    tokens.push({ start: match.index, end: stringRegex.lastIndex, type: 'string' });
  }
  
  // 2. Comments
  const commentRegex = /\/\/.*/g;
  while ((match = commentRegex.exec(text)) !== null) {
    // Only capture if not already inside a string
    if (!tokens.some(t => match!.index >= t.start && match!.index < t.end)) {
      tokens.push({ start: match.index, end: commentRegex.lastIndex, type: 'comment' });
    }
  }
  
  // 3. Numbers
  const numberRegex = /\b\d+(\.\d+)?\b/g;
  while ((match = numberRegex.exec(text)) !== null) {
    if (!tokens.some(t => match!.index >= t.start && match!.index < t.end)) {
      tokens.push({ start: match.index, end: numberRegex.lastIndex, type: 'number' });
    }
  }

  // 4. Keywords
  const wordRegex = /\b[a-zA-Z_]\w*\b/g;
  while ((match = wordRegex.exec(text)) !== null) {
    const word = match[0];
    if (CODE_KEYWORDS.has(word)) {
      if (!tokens.some(t => match!.index >= t.start && match!.index < t.end)) {
        tokens.push({ start: match.index, end: wordRegex.lastIndex, type: 'keyword' });
      }
    }
  }
  
  return tokens;
}

function renderLineHtml(text: string, extension: string, diffState?: number[]): JSX.Element {
  if (text.length === 0) {
    return <span>&#8203;</span>;
  }
  
  const tokens = highlightTokens(text);
  const colors = new Array(text.length).fill(null);
  
  for (const t of tokens) {
    let color = null;
    if (t.type === 'keyword') color = '#cc7832';
    else if (t.type === 'string') color = '#a5c261';
    else if (t.type === 'number') color = '#6897bb';
    else if (t.type === 'comment') color = '#808080';
    
    if (color) {
      for (let i = t.start; i < t.end; i++) {
        colors[i] = color;
      }
    }
  }
  
  const segments: JSX.Element[] = [];
  let currentColor: string | null = null;
  let currentDiff = 0;
  let currentText = "";
  
  const pushSegment = (color: string | null, diffVal: number, txt: string, key: string) => {
    const style: React.CSSProperties = color ? { color } : {};
    const className = diffVal === 1 ? "word-diff-highlight" : "";
    segments.push(
      <span key={key} className={className} style={style}>
        {txt}
      </span>
    );
  };
  
  for (let i = 0; i < text.length; i++) {
    const c = colors[i];
    const d = diffState ? diffState[i] : 0;
    
    if (c !== currentColor || d !== currentDiff) {
      if (currentText) {
        pushSegment(currentColor, currentDiff, currentText, `char-${i - currentText.length}`);
      }
      currentColor = c;
      currentDiff = d;
      currentText = text[i];
    } else {
      currentText += text[i];
    }
  }
  
  if (currentText) {
    pushSegment(currentColor, currentDiff, currentText, `char-${text.length - currentText.length}`);
  }
  
  return <>{segments}</>;
}

// --- Folder Tree Sidebar Component ---
interface TreeNodeProps {
  node: TreeNode;
  level: number;
  selectedPath: string | null;
  expandedPaths: Record<string, boolean>;
  onSelect: (path: string) => void;
  onToggleExpand: (path: string) => void;
}

function TreeNodeView({
  node,
  level,
  selectedPath,
  expandedPaths,
  onSelect,
  onToggleExpand
}: TreeNodeProps) {
  const paddingLeft = level * 16 + 8;
  const isExpanded = expandedPaths[node.path] !== false; // defaults to true (expanded)
  
  if (node.isDir) {
    return (
      <div key={node.path}>
        <button
          type="button"
          className="tree-node"
          style={{ paddingLeft }}
          onClick={() => onToggleExpand(node.path)}
        >
          <span className="tree-node-arrow">
            {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </span>
          <Folder size={14} className="tree-node-icon" style={{ color: "#4a88c7" }} />
          <span className="tree-node-name">{node.name}</span>
        </button>
        {isExpanded && node.children.map(child => (
          <TreeNodeView
            key={child.path}
            node={child}
            level={level + 1}
            selectedPath={selectedPath}
            expandedPaths={expandedPaths}
            onSelect={onSelect}
            onToggleExpand={onToggleExpand}
          />
        ))}
      </div>
    );
  } else {
    const file = node.file!;
    const isSelected = selectedPath === file.path;
    const itemClass = `tree-node ${isSelected ? "selected" : ""} ${isSelected ? "" : gitColorClass[file.status]}`;
    
    return (
      <button
        type="button"
        key={file.path}
        className={itemClass}
        style={{ paddingLeft: paddingLeft + 16 }}
        onClick={() => onSelect(file.path)}
        title={file.oldPath ? `${file.oldPath} -> ${file.path}` : file.path}
      >
        <span className={`git-badge ${gitBadgeClass[file.status]}`}>
          {statusLabel[file.status]}
        </span>
        <File size={14} className="tree-node-icon" style={{ opacity: 0.7 }} />
        <span className="tree-node-name">{node.name}</span>
      </button>
    );
  }
}

function buildFileTree(files: ChangedFile[]): TreeNode[] {
  const root: TreeNode[] = [];
  
  for (const file of files) {
    const parts = file.path.split('/');
    let currentLevel = root;
    let accumulatedPath = "";
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
      const isLast = i === parts.length - 1;
      
      let existingNode = currentLevel.find(node => node.name === part);
      
      if (!existingNode) {
        existingNode = {
          name: part,
          path: accumulatedPath,
          isDir: !isLast,
          children: []
        };
        if (isLast) {
          existingNode.file = file;
        }
        currentLevel.push(existingNode);
      }
      
      currentLevel = existingNode.children;
    }
  }
  
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.isDir) {
        sortNodes(node.children);
      }
    }
  };
  
  sortNodes(root);
  return root;
}

// --- Main App Component ---
function App() {
  const [project, setProject] = useState<ProjectInspection | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [diff, setDiff] = useState<FileDiff | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Open a local Git folder to inspect working tree changes.");
  
  // Dropdown states
  const [isProjMenuOpen, setIsProjMenuOpen] = useState(false);
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  
  // Sidebar expanded paths state
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});
  
  // Aligned diff chunks
  const [processedChunks, setProcessedChunks] = useState<DiffChunk[]>([]);

  // Collapse unchanged fragments
  const [collapseEnabled, setCollapseEnabled] = useState(true);
  const [expandedSeparators, setExpandedSeparators] = useState<Set<string>>(new Set());

  // Open tabs state
  const [openTabs, setOpenTabs] = useState<string[]>([]);

  // Scroll position refs for real-time SVG connectors and separators updates in 2-way spacer-less view
  const scrollTopLeftRef = useRef(0);
  const scrollTopRightRef = useRef(0);

  // Sync scroll lock
  const isSyncing = useRef(false);
  const activeScrollRef = useRef<string | null>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const middleRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  const selectedFile = useMemo(
    () => project?.files.find((file) => file.path === selected) ?? null,
    [project, selected]
  );

  const viewMode = useMemo<ViewMode>(() => {
    if (selectedFile && selectedFile.status === "conflicted") {
      return "3way";
    }
    return "2way";
  }, [selectedFile]);

  const extension = useMemo(
    () => selected ? selected.split('.').pop() || "" : "",
    [selected]
  );

  async function openFolder() {
    setLoading(true);
    setMessage("Waiting for folder selection...");
    try {
      const folder = await invoke<string | null>("pick_folder");
      if (!folder) {
        setMessage("Folder selection cancelled.");
        return;
      }
      await inspect(folder);
    } catch (error) {
      setMessage(String(error));
    } finally {
      setLoading(false);
    }
  }

  async function inspect(folder = project?.selectedPath) {
    if (!folder) return;

    setLoading(true);
    setMessage("Inspecting local Git state...");
    try {
      const nextProject = await invoke<ProjectInspection>("inspect_project", { folder });
      setProject(nextProject);
      localStorage.setItem("last_opened_folder", folder);
      const first = nextProject.files[0]?.path ?? null;
      setSelected(first);
      setOpenTabs(first ? [first] : []);
      setDiff(null);
      setExpandedPaths({}); // Reset sidebar state to all expanded
      setMessage(
        nextProject.isGitRepo
          ? `${nextProject.files.length} changed or conflicted file${nextProject.files.length === 1 ? "" : "s"} found.`
          : nextProject.error ?? "The selected folder is not inside a Git repository."
      );
    } catch (error) {
      setMessage(String(error));
    } finally {
      setLoading(false);
    }
  }

  const handleSelectFile = (path: string) => {
    setSelected(path);
    setOpenTabs(prev => {
      if (prev.includes(path)) return prev;
      return [...prev, path];
    });
  };

  const handleCloseTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenTabs(prev => {
      const next = prev.filter(t => t !== path);
      if (selected === path) {
        const closedIndex = prev.indexOf(path);
        if (next.length > 0) {
          const nextSelect = next[closedIndex] || next[closedIndex - 1] || next[0];
          setSelected(nextSelect);
        } else {
          setSelected(null);
        }
      }
      return next;
    });
  };

  // Load last opened folder on startup
  useEffect(() => {
    const lastFolder = localStorage.getItem("last_opened_folder");
    if (lastFolder) {
      inspect(lastFolder);
    }
  }, []);

  // Load Diff
  useEffect(() => {
    if (!project?.selectedPath || !selected) {
      setDiff(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    invoke<FileDiff>("read_file_diff", { folder: project.selectedPath, path: selected })
      .then((nextDiff) => {
        if (!cancelled) {
          setDiff(nextDiff);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(String(error));
          setDiff(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [project?.selectedPath, selected]);

  // Aligned diff generator
  useEffect(() => {
    if (!diff) {
      setProcessedChunks([]);
      return;
    }
    
    let b = diff.baseline || "";
    let m = diff.working || "";
    let t = "";
    
    if (diff.status === "conflicted" && diff.working) {
      const parsed = parseConflictMarkers(diff.working);
      if (viewMode === "3way") {
        b = parsed.base;
        m = parsed.mine;
        t = parsed.theirs;
      } else {
        b = parsed.base;
        m = diff.working;
      }
    }
    
    const bLines = b.split('\n');
    const mLines = m.split('\n');
    
    if (viewMode === "3way") {
      const tLines = t.split('\n');
      const alignment = build3WayAlignment(bLines, mLines, tLines);
      const chunks = buildChunks(alignment, bLines, mLines, tLines);
      setProcessedChunks(chunks);
    } else {
      const chunks = build2WayChunks(bLines, mLines);
      setProcessedChunks(chunks);
    }
  }, [diff, viewMode]);

  // Resolve conflict chunk in memory
  const resolveConflict = (chunkId: number, side: 'mine' | 'theirs' | 'base') => {
    setProcessedChunks(prev => prev.map(chunk => {
      if (chunk.id !== chunkId) return chunk;
      
      let resLines: string[] = [];
      if (side === 'mine') resLines = [...chunk.mLines];
      else if (side === 'theirs') resLines = [...chunk.tLines];
      else resLines = [...chunk.bLines];
      
      return {
        ...chunk,
        resLines,
        resolved: true,
        type: side === 'mine' ? 'mine_only' : (side === 'theirs' ? 'theirs_only' : 'equal'),
        resultWordDiff: getWordDiff(resLines.join('\n'), chunk.bLines.join('\n'))
      };
    }));
  };

  // Helper for piecewise-linear scroll mapping in 2-way spacer-less view
  const getMappedScrollTop = (
    fromPane: 'left' | 'middle' | 'right',
    toPane: 'left' | 'middle' | 'right',
    scrollTop: number
  ): number => {
    if (displayChunks.length === 0) return scrollTop;
    
    let itemIndex = 0;
    let accumFrom = 0;
    
    for (let i = 0; i < displayChunks.length; i++) {
      const item = displayChunks[i] as any;
      const hFrom = fromPane === 'left' ? (item.leftH ?? 0) : (fromPane === 'middle' ? (item.middleH ?? 0) : (item.rightH ?? 0));
      if (scrollTop >= accumFrom && scrollTop <= accumFrom + hFrom) {
        itemIndex = i;
        break;
      }
      accumFrom += hFrom;
      if (i === displayChunks.length - 1) {
        itemIndex = i;
      }
    }
    
    const activeItem = displayChunks[itemIndex] as any;
    const yFrom = fromPane === 'left' ? (activeItem.leftY ?? 0) : (fromPane === 'middle' ? (activeItem.middleY ?? 0) : (activeItem.rightY ?? 0));
    const hFrom = fromPane === 'left' ? (activeItem.leftH ?? 0) : (fromPane === 'middle' ? (activeItem.middleH ?? 0) : (activeItem.rightH ?? 0));
    const yTo = toPane === 'left' ? (activeItem.leftY ?? 0) : (toPane === 'middle' ? (activeItem.middleY ?? 0) : (activeItem.rightY ?? 0));
    const hTo = toPane === 'left' ? (activeItem.leftH ?? 0) : (toPane === 'middle' ? (activeItem.middleH ?? 0) : (activeItem.rightH ?? 0));
    
    if (hFrom === 0) return yTo;
    
    const ratio = (scrollTop - yFrom) / hFrom;
    return yTo + ratio * hTo;
  };

  // Mouse hover event synchronization for separators
  const handleSeparatorMouseEnter = (id: string) => {
    const els = document.querySelectorAll(`[data-separator-id="${id}"]`);
    els.forEach(el => el.classList.add('hovered'));
  };

  const handleSeparatorMouseLeave = (id: string) => {
    const els = document.querySelectorAll(`[data-separator-id="${id}"]`);
    els.forEach(el => el.classList.remove('hovered'));
  };

  // Helper for computing separator coordinates and paths for both render and scroll sync
  const getSeparatorCoords = (
    leftY: number,
    rightY: number,
    middleY: number,
    leftScroll: number,
    rightScroll: number,
    middleScroll: number
  ) => {
    const localLeftY = (leftY - leftScroll) - (middleY - middleScroll);
    const localRightY = (rightY - rightScroll) - (middleY - middleScroll);

    const minY = Math.min(localLeftY, localRightY);
    const svgHeight = Math.max(25, Math.abs(localLeftY - localRightY) + 25);

    const yl = localLeftY - minY;
    const yr = localRightY - minY;

    // Use wavy lines in the Left line number zone (0 to 60px) and Right line number zone (120px to 180px)
    // with a smooth Bezier transition curve in the center (60px to 120px) to match JetBrains editor waves
    const centerPath = `M 0 ${yl + 8} ` +
      `C 4 ${yl + 8}, 4 ${yl + 12}, 8 ${yl + 12} ` +
      `S 12 ${yl + 8}, 16 ${yl + 8} ` +
      `C 20 ${yl + 8}, 20 ${yl + 12}, 24 ${yl + 12} ` +
      `S 28 ${yl + 8}, 32 ${yl + 8} ` +
      `C 36 ${yl + 8}, 36 ${yl + 12}, 40 ${yl + 12} ` +
      `S 44 ${yl + 8}, 48 ${yl + 8} ` +
      `C 52 ${yl + 8}, 52 ${yl + 12}, 56 ${yl + 12} ` +
      `S 60 ${yl + 8}, 64 ${yl + 8} ` +
      `C 90 ${yl + 8}, 90 ${yr + 8}, 116 ${yr + 8} ` +
      `C 120 ${yr + 8}, 120 ${yr + 12}, 124 ${yr + 12} ` +
      `S 128 ${yr + 8}, 132 ${yr + 8} ` +
      `C 136 ${yr + 8}, 136 ${yr + 12}, 140 ${yr + 12} ` +
      `S 144 ${yr + 8}, 148 ${yr + 8} ` +
      `C 152 ${yr + 8}, 152 ${yr + 12}, 156 ${yr + 12} ` +
      `S 160 ${yr + 8}, 164 ${yr + 8} ` +
      `C 168 ${yr + 8}, 168 ${yr + 12}, 172 ${yr + 12} ` +
      `S 176 ${yr + 8}, 180 ${yr + 8}`;

    return { localLeftY, localRightY, minY, svgHeight, centerPath };
  };

  // Helper to sync SVG curves and translation offsets in 2-way spacer-less view
  const syncGutterOffsets = useCallback(() => {
    if (viewMode !== "2way") return;

    const leftScroll = leftRef.current ? leftRef.current.scrollTop : 0;
    const rightScroll = rightRef.current ? rightRef.current.scrollTop : 0;
    const middleScroll = middleRef.current ? middleRef.current.scrollTop : 0;

    scrollTopLeftRef.current = leftScroll;
    scrollTopRightRef.current = rightScroll;

    const scrollDiff = rightScroll - leftScroll;

    // Update change chunk connectors directly in DOM
    const connectors = document.querySelectorAll('.gutter-svg-connector');
    connectors.forEach((el) => {
      const svgEl = el as SVGSVGElement;
      const leftHeight = parseFloat(svgEl.getAttribute('data-left-height') || '0');
      const rightHeight = parseFloat(svgEl.getAttribute('data-right-height') || '0');
      const middleY = parseFloat(svgEl.getAttribute('data-middle-y') || '0');
      const rightY = parseFloat(svgEl.getAttribute('data-right-y') || '0');

      const shiftY = rightY - middleY - scrollDiff;
      const rightTopLocal = shiftY;
      const rightBottomLocal = rightHeight + shiftY;
      const svgWidth = 60;

      const fillPath = `M 0 0 C ${svgWidth / 2} 0, ${svgWidth / 2} ${rightTopLocal}, ${svgWidth} ${rightTopLocal} L ${svgWidth} ${rightBottomLocal} C ${svgWidth / 2} ${rightBottomLocal}, ${svgWidth / 2} ${leftHeight}, 0 ${leftHeight} Z`;

      const fillEl = svgEl.querySelector('.fill-path');

      if (fillEl) fillEl.setAttribute('d', fillPath);

      const newSvgHeight = Math.max(leftHeight, rightHeight + Math.abs(shiftY));
      svgEl.style.height = `${newSvgHeight}px`;
    });

    // Update separator wave curves directly in DOM
    const separators = document.querySelectorAll('.gutter-separator');
    separators.forEach((el) => {
      const sepEl = el as HTMLElement;
      const leftY = parseFloat(sepEl.getAttribute('data-left-y') || '0');
      const rightY = parseFloat(sepEl.getAttribute('data-right-y') || '0');
      const middleY = parseFloat(sepEl.getAttribute('data-middle-y') || '0');

      const { minY, svgHeight, centerPath } = getSeparatorCoords(
        leftY,
        rightY,
        middleY,
        leftScroll,
        rightScroll,
        middleScroll
      );

      const svgEl = sepEl.querySelector('.separator-svg-connector') as SVGSVGElement | null;
      if (svgEl) {
        svgEl.style.top = `${minY}px`;
        svgEl.style.height = `${svgHeight}px`;
        const centerEl = svgEl.querySelector('.center-path');
        if (centerEl) centerEl.setAttribute('d', centerPath);
      }
    });

    // Update left and right gutter columns directly in DOM
    const leftColumns = document.querySelectorAll('.gutter-column.left');
    leftColumns.forEach((el) => {
      const colEl = el as HTMLElement;
      const leftY = parseFloat(colEl.getAttribute('data-left-y') || '0');
      const middleY = parseFloat(colEl.getAttribute('data-middle-y') || '0');
      
      const shiftY = leftY - leftScroll - (middleY - middleScroll);
      colEl.style.transform = `translateY(${shiftY}px)`;
    });

    const rightColumns = document.querySelectorAll('.gutter-column.right');
    rightColumns.forEach((el) => {
      const colEl = el as HTMLElement;
      const rightY = parseFloat(colEl.getAttribute('data-right-y') || '0');
      const middleY = parseFloat(colEl.getAttribute('data-middle-y') || '0');
      
      const shiftY = rightY - rightScroll - (middleY - middleScroll);
      colEl.style.transform = `translateY(${shiftY}px)`;
    });
  }, [viewMode]);

  // Sync scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const source = e.currentTarget;
    
    // Set horizontal scroll custom property for background wave alignment
    const isRtl = window.getComputedStyle(source).direction === 'rtl';
    const scrollXVal = isRtl
      ? source.scrollLeft + (source.scrollWidth - source.clientWidth)
      : source.scrollLeft;
    source.style.setProperty('--scroll-x', `${scrollXVal}px`);

    if (isSyncing.current) return;
    
    // Detect which pane is actively being scrolled by the user using ref comparisons
    let sourceKey = '';
    if (source === leftRef.current) sourceKey = 'left';
    else if (source === rightRef.current) sourceKey = 'right';
    else if (source === middleRef.current) sourceKey = 'middle';
    else if (source === centerRef.current) sourceKey = 'center';

    // Only allow scrolling to synchronize if it originates from the hovered pane.
    // This completely prevents infinite programmatic scroll event feedback loops.
    if (activeScrollRef.current && activeScrollRef.current !== sourceKey) {
      return;
    }

    isSyncing.current = true;
    
    const targetScrollTop = source.scrollTop;
    const targetScrollLeft = source.scrollLeft;
    
    if (viewMode === "2way") {
      const leftTarget = sourceKey === 'left' ? targetScrollTop : getMappedScrollTop(sourceKey as any, 'left', targetScrollTop);
      const middleTarget = sourceKey === 'middle' ? targetScrollTop : getMappedScrollTop(sourceKey as any, 'middle', targetScrollTop);
      const rightTarget = sourceKey === 'right' ? targetScrollTop : getMappedScrollTop(sourceKey as any, 'right', targetScrollTop);
      
      if (leftRef.current && leftRef.current !== source && Math.abs(leftRef.current.scrollTop - leftTarget) > 0.5) {
        leftRef.current.scrollTop = leftTarget;
      }
      if (middleRef.current && middleRef.current !== source && Math.abs(middleRef.current.scrollTop - middleTarget) > 0.5) {
        middleRef.current.scrollTop = middleTarget;
      }
      if (rightRef.current && rightRef.current !== source && Math.abs(rightRef.current.scrollTop - rightTarget) > 0.5) {
        rightRef.current.scrollTop = rightTarget;
      }
      
      // Sync horizontal scroll (left and right code panes only, middle has no horizontal scroll)
      if (leftRef.current && rightRef.current) {
        const leftMax = leftRef.current.scrollWidth - leftRef.current.clientWidth;
        
        if (source === leftRef.current) {
          // Left (RTL, scrollLeft is negative/0) to Right (LTR, scrollLeft is positive)
          const leftScrollLeft = leftRef.current.scrollLeft;
          const targetRightScrollLeft = leftMax + leftScrollLeft;
          if (Math.abs(rightRef.current.scrollLeft - targetRightScrollLeft) > 0.5) {
            rightRef.current.scrollLeft = targetRightScrollLeft;
          }
        } else if (source === rightRef.current) {
          // Right (LTR, scrollLeft is positive) to Left (RTL, scrollLeft is negative/0)
          const rightScrollLeft = rightRef.current.scrollLeft;
          const targetLeftScrollLeft = -leftMax + rightScrollLeft;
          if (Math.abs(leftRef.current.scrollLeft - targetLeftScrollLeft) > 0.5) {
            leftRef.current.scrollLeft = targetLeftScrollLeft;
          }
        }
      }

      syncGutterOffsets();
    } else {
      // Horizontal scroll sync with RTL/LTR mapping for 1-way and 3-way
      const panes = [
        { key: 'left', ref: leftRef.current },
        { key: 'center', ref: centerRef.current },
        { key: 'right', ref: rightRef.current }
      ];
      
      const leftMax = leftRef.current ? leftRef.current.scrollWidth - leftRef.current.clientWidth : 0;
      
      // Calculate normalized scrollLeft (distance from left content edge)
      let normalizedScrollLeft = targetScrollLeft;
      if (sourceKey === 'left') {
        normalizedScrollLeft = leftMax + targetScrollLeft;
      }
      
      for (const p of panes) {
        if (p.ref && p.ref !== source) {
          if (Math.abs(p.ref.scrollTop - targetScrollTop) > 0.5) {
            p.ref.scrollTop = targetScrollTop;
          }
          
          // Sync horizontal scroll (left is RTL, center and right are LTR)
          let targetLeft = normalizedScrollLeft;
          if (p.key === 'left') {
            targetLeft = -leftMax + normalizedScrollLeft;
          }
          
          if (Math.abs(p.ref.scrollLeft - targetLeft) > 0.5) {
            p.ref.scrollLeft = targetLeft;
          }
        }
      }
    }
    
    isSyncing.current = false;
  };

  // Sync pane offsets for global background alignment
  useEffect(() => {
    const syncPaneX = () => {
      [leftRef, middleRef, centerRef, rightRef].forEach(ref => {
        if (ref.current) {
          const rect = ref.current.getBoundingClientRect();
          ref.current.style.setProperty('--pane-x', `${rect.left}px`);
          
          // Set initial scroll offset custom property
          const source = ref.current;
          const isRtl = window.getComputedStyle(source).direction === 'rtl';
          const scrollXVal = isRtl
            ? source.scrollLeft + (source.scrollWidth - source.clientWidth)
            : source.scrollLeft;
          source.style.setProperty('--scroll-x', `${scrollXVal}px`);
        }
      });
      syncGutterOffsets();
    };
    
    syncPaneX();
    
    const container = leftRef.current?.parentElement;
    if (!container) return;
    
    const observer = new ResizeObserver(syncPaneX);
    observer.observe(container);
    window.addEventListener('resize', syncPaneX);
    
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncPaneX);
    };
  }, [viewMode, selected, processedChunks, syncGutterOffsets]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("#project-menu-container")) {
        setIsProjMenuOpen(false);
      }
      if (!target.closest("#branch-menu-container")) {
        setIsBranchMenuOpen(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  const handleToggleExpand = (path: string) => {
    setExpandedPaths(prev => ({
      ...prev,
      [path]: prev[path] === false
    }));
  };

  // Reset expanded separators and scroll refs when file changes
  useEffect(() => {
    setExpandedSeparators(new Set());
    scrollTopLeftRef.current = 0;
    scrollTopRightRef.current = 0;
    if (leftRef.current) leftRef.current.scrollTop = 0;
    if (rightRef.current) rightRef.current.scrollTop = 0;
    if (middleRef.current) middleRef.current.scrollTop = 0;
    if (centerRef.current) centerRef.current.scrollTop = 0;
    setTimeout(() => {
      if (leftRef.current) {
        leftRef.current.scrollLeft = -leftRef.current.scrollWidth;
      }
    }, 50);
  }, [selected]);

  // Expand a collapsed separator
  const handleExpandSeparator = (separatorId: string) => {
    setExpandedSeparators(prev => {
      const next = new Set(prev);
      next.add(separatorId);
      return next;
    });
  };

  // Display chunks: collapse equal chunks into context + separator + context
  const displayChunks = useMemo((): DisplayChunk[] => {
    const result: DisplayChunk[] = [];

    if (!collapseEnabled) {
      result.push(...processedChunks.map(c => ({ ...c, display: 'lines' as const })));
    } else {
      for (let i = 0; i < processedChunks.length; i++) {
        const chunk = processedChunks[i];
        const lineCount = Math.max(chunk.bLines.length, chunk.mLines.length);

        if (chunk.type !== 'equal' || lineCount <= CONTEXT_LINES * 2) {
          result.push({ ...chunk, display: 'lines' });
          continue;
        }

        const separatorId = `sep-${chunk.id}`;
        const isExpanded = expandedSeparators.has(separatorId);

        if (isExpanded) {
          result.push({ ...chunk, display: 'lines' });
          continue;
        }

        const isFirst = i === 0;
        const isLast = i === processedChunks.length - 1;
        const ctxAbove = isFirst ? 0 : CONTEXT_LINES;
        const ctxBelow = isLast ? 0 : CONTEXT_LINES;
        const hiddenCount = lineCount - ctxAbove - ctxBelow;

        if (hiddenCount <= 0) {
          result.push({ ...chunk, display: 'lines' });
          continue;
        }

        // Context above (trailing lines adjacent to previous change)
        if (ctxAbove > 0) {
          result.push({
            ...chunk,
            bIdxs: chunk.bIdxs.slice(0, ctxAbove),
            bLines: chunk.bLines.slice(0, ctxAbove),
            mIdxs: chunk.mIdxs.slice(0, ctxAbove),
            mLines: chunk.mLines.slice(0, ctxAbove),
            tIdxs: chunk.tIdxs.slice(0, ctxAbove),
            tLines: chunk.tLines.slice(0, ctxAbove),
            resLines: chunk.resLines.slice(0, ctxAbove),
            display: 'lines',
          });
        }

        // Collapsed separator
        result.push({
          display: 'separator',
          separatorId,
          hiddenCount,
          chunkId: chunk.id,
        });

        // Context below (leading lines adjacent to next change)
        if (ctxBelow > 0) {
          result.push({
            ...chunk,
            bIdxs: chunk.bIdxs.slice(-ctxBelow),
            bLines: chunk.bLines.slice(-ctxBelow),
            mIdxs: chunk.mIdxs.slice(-ctxBelow),
            mLines: chunk.mLines.slice(-ctxBelow),
            tIdxs: chunk.tIdxs.slice(-ctxBelow),
            tLines: chunk.tLines.slice(-ctxBelow),
            resLines: chunk.resLines.slice(-ctxBelow),
            display: 'lines',
          });
        }
      }
    }

    let leftY = 0;
    let middleY = 0;
    let rightY = 0;

    return result.map(item => {
      if (item.display === 'separator') {
        const leftH = 20;
        const middleH = 20;
        const rightH = 20;
        const enriched = {
          ...item,
          leftY,
          middleY,
          rightY,
          leftH,
          middleH,
          rightH,
        };
        leftY += leftH;
        middleY += middleH;
        rightY += rightH;
        return enriched;
      } else {
        const height = Math.max(item.bLines.length, item.mLines.length);
        const leftH = (viewMode === "2way" ? item.bLines.length : height) * 20;
        const middleH = height * 20;
        const rightH = (viewMode === "2way" ? item.mLines.length : height) * 20;
        const enriched = {
          ...item,
          leftY,
          middleY,
          rightY,
          leftH,
          middleH,
          rightH,
        };
        leftY += leftH;
        middleY += middleH;
        rightY += rightH;
        return enriched;
      }
    }) as any;
  }, [processedChunks, collapseEnabled, expandedSeparators, viewMode]);

  // Sync gutter offsets after rendering or layout shifts
  useEffect(() => {
    syncGutterOffsets();
  }, [displayChunks, viewMode, syncGutterOffsets]);

  // Dynamic merged center pane indices with collapse/separator support
  const displayChunksWithStartIdx = useMemo(() => {
    let nextResIdx = 1;
    return displayChunks.map(item => {
      if (item.display === 'separator') return item;
      const start = nextResIdx;
      if (item.resLines) {
        nextResIdx += item.resLines.length;
      }
      return {
        ...item,
        resIdxStart: start
      };
    });
  }, [displayChunks]);

  // Separator component used by all panes
  const renderSeparator = (item: any, pane: 'left' | 'middle' | 'right') => {
    if (viewMode === "2way" && pane === 'middle') {
      const leftY = item.leftY ?? 0;
      const rightY = item.rightY ?? 0;
      const middleY = item.middleY ?? 0;

      const leftScroll = scrollTopLeftRef.current;
      const rightScroll = scrollTopRightRef.current;
      const middleScroll = middleRef.current ? middleRef.current.scrollTop : getMappedScrollTop('left', 'middle', leftScroll);

      const { minY, svgHeight, centerPath } = getSeparatorCoords(
        leftY,
        rightY,
        middleY,
        leftScroll,
        rightScroll,
        middleScroll
      );

      return (
        <div
          key={item.separatorId}
          className="collapsed-separator gutter-separator"
          data-separator-id={item.separatorId}
          onClick={() => handleExpandSeparator(item.separatorId)}
          onMouseEnter={() => handleSeparatorMouseEnter(item.separatorId)}
          onMouseLeave={() => handleSeparatorMouseLeave(item.separatorId)}
          style={{ position: 'relative', zIndex: 10, transformStyle: 'preserve-3d' }}
          data-left-y={leftY}
          data-right-y={rightY}
          data-middle-y={middleY}
          title={`Expand ${item.hiddenCount} unchanged lines`}
        >
          <svg
            className="separator-svg-connector"
            style={{
              position: 'absolute',
              left: 0,
              top: `${minY}px`,
              width: 180,
              height: svgHeight,
              overflow: 'hidden',
              pointerEvents: 'none',
              zIndex: 10,
              transform: 'translateZ(0)'
            }}
          >
            <path className="center-path" d={centerPath} stroke="#5f6164" strokeWidth={0.8} fill="none" />
          </svg>
        </div>
      );
    }

    return (
      <div
        key={item.separatorId}
        className="collapsed-separator"
        data-separator-id={item.separatorId}
        onClick={() => handleExpandSeparator(item.separatorId)}
        onMouseEnter={() => handleSeparatorMouseEnter(item.separatorId)}
        onMouseLeave={() => handleSeparatorMouseLeave(item.separatorId)}
      >
      </div>
    );
  };

  return (
    <main className="app-shell">
      <header className="toolbar">
        <div className="toolbar-left">
          {/* Project Dropdown Selector */}
          <div id="project-menu-container" className="dropdown-container">
            <button 
              type="button" 
              className="dropdown-trigger" 
              onClick={() => setIsProjMenuOpen(!isProjMenuOpen)}
              title="Select Project Folder"
            >
              <Folder size={14} style={{ color: "#4a88c7" }} />
              <span style={{ fontWeight: 600 }}>
                {project?.selectedPath ? project.selectedPath.split(/[/\\]/).pop() : "No folder open"}
              </span>
              <span className="arrow">▼</span>
            </button>
            {isProjMenuOpen && (
              <div className="dropdown-menu">
                {project?.selectedPath && (
                  <>
                    <button 
                      type="button" 
                      className="dropdown-item active"
                      onClick={() => setIsProjMenuOpen(false)}
                    >
                      <Folder size={12} style={{ color: "#4a88c7" }} />
                      <span className="truncate">{project.selectedPath}</span>
                    </button>
                    <div className="dropdown-separator"></div>
                  </>
                )}
                <button 
                  type="button" 
                  className="dropdown-item" 
                  onClick={() => {
                    setIsProjMenuOpen(false);
                    openFolder();
                  }}
                >
                  Open Folder...
                </button>
              </div>
            )}
          </div>
          
          <div className="divider"></div>

          {/* Branch Dropdown Selector */}
          <div id="branch-menu-container" className="dropdown-container">
            <button 
              type="button" 
              className="dropdown-trigger" 
              onClick={() => setIsBranchMenuOpen(!isBranchMenuOpen)}
              title="Select Git Branch"
            >
              <GitBranch size={14} style={{ color: "#a5c261" }} />
              <span style={{ fontWeight: 600 }}>main</span>
              <span className="arrow">▼</span>
            </button>
            {isBranchMenuOpen && (
              <div className="dropdown-menu">
                <button 
                  type="button" 
                  className="dropdown-item active"
                  onClick={() => setIsBranchMenuOpen(false)}
                >
                  <GitBranch size={12} style={{ color: "#a5c261" }} />
                  <span>main</span>
                </button>
              </div>
            )}
          </div>

          <div className="divider"></div>

          {/* Git Icons Actions */}
          <div className="git-actions">
            <button 
              type="button" 
              className="action-btn pull" 
              title="Update Project (Refresh)"
              onClick={() => inspect()}
              disabled={loading || !project}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div className="toolbar-right">
          <button 
            type="button" 
            className={`action-btn ${collapseEnabled ? "active-toggle" : ""}`}
            title="Collapse Unchanged Fragments"
            onClick={() => setCollapseEnabled(prev => !prev)}
          >
            {collapseEnabled ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}
          </button>
        </div>

      </header>

      <section className="workspace">
        <aside className="sidebar">
          <div className="sidebar-title">Changes</div>
          <div className="file-tree-container">
            {project && project.files.length > 0 ? (
              buildFileTree(project.files).map(node => (
                <TreeNodeView
                  key={node.path}
                  node={node}
                  level={0}
                  selectedPath={selected}
                  expandedPaths={expandedPaths}
                  onSelect={handleSelectFile}
                  onToggleExpand={handleToggleExpand}
                />
              ))
            ) : (
              <div className="empty-tree">No changed files.</div>
            )}
          </div>
        </aside>

        <section className="viewer">
          <div className="tab-strip">
            {openTabs.map(tabPath => {
              const file = project?.files.find(f => f.path === tabPath);
              if (!file) return null;
              const isActive = tabPath === selected;
              return (
                <div 
                  key={tabPath} 
                  className={`editor-tab ${isActive ? "active" : ""}`}
                  onClick={() => setSelected(tabPath)}
                >
                  <span className={`tab-status-pill ${gitBadgeClass[file.status]}`}>
                    {statusLabel[file.status]}
                  </span>
                  <span>{tabPath.split('/').pop()}</span>
                  <button 
                    type="button" 
                    className="tab-close-btn"
                    onClick={(e) => handleCloseTab(tabPath, e)}
                  >
                    ×
                  </button>
                </div>
              );
            })}
            {openTabs.length === 0 && (
              <div className="editor-tab active" style={{ borderTop: 0, cursor: 'default' }}>
                No open files
              </div>
            )}
          </div>

          {diff ? (
            <div className={`diff-grid ${viewMode === "2way" ? "view-2way" : ""}`}>
              {/* PANE LEFT: 1-way (Editor), 2-way (Base), 3-way (Ours) */}
              <div className="pane-wrapper">
                <div className="pane-header">
                  {viewMode === "1way" ? (
                    <strong>Working Version</strong>
                  ) : viewMode === "2way" ? (
                    <>
                      <strong>Base Version</strong>
                      <span>HEAD</span>
                    </>
                  ) : (
                    <>
                      <strong>Local</strong>
                      <span>Ours</span>
                    </>
                  )}
                </div>
                <div className="pane-content" ref={leftRef} onScroll={handleScroll} onMouseEnter={() => { activeScrollRef.current = 'left'; }}>
                  {viewMode === "1way" ? (
                    // --- 1-WAY PANE ---
                    displayChunks.map((item) => {
                      if (item.display === 'separator') return renderSeparator(item, 'left');
                      const chunk = item;
                      let markerClass = "";
                      if (chunk.type !== 'equal') {
                        if (chunk.type === 'conflict') markerClass = 'marker-conflict';
                        else if (chunk.type === 'added') markerClass = 'marker-added';
                        else if (chunk.type === 'deleted') markerClass = 'marker-deleted';
                        else markerClass = 'marker-modified';
                      }
                      
                      if (chunk.type === 'deleted' && chunk.mLines.length === 0) {
                        return (
                          <div key={chunk.id} className="chunk-block equal">
                            <div className="line-row" style={{ height: 4 }}>
                              <span className={`line-num ${markerClass}`} style={{ height: 4, padding: 0 }}></span>
                              <code className="line-code" style={{ height: 4 }}></code>
                            </div>
                          </div>
                        );
                      }
                      
                      return (
                        <div key={chunk.id} className="chunk-block equal">
                          {chunk.mLines.map((lineText, i) => {
                            const lineNum = chunk.mIdxs[i] + 1;
                            return (
                              <div key={i} className="line-row">
                                <span className={`line-num ${markerClass}`}>{lineNum}</span>
                                <code className="line-code">
                                  {renderLineHtml(lineText, extension)}
                                </code>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })
                  ) : viewMode === "2way" ? (
                    // --- 2-WAY LEFT PANE ---
                    displayChunks.map((item) => {
                      if (item.display === 'separator') return renderSeparator(item, 'left');
                      const chunk = item;
                      const height = Math.max(chunk.bLines.length, chunk.mLines.length);
                      return (
                        <div key={chunk.id} className={`chunk-block ${chunk.type}`}>
                          {chunk.bLines.map((lineText, i) => (
                            <div key={i} className={`line-row ${chunk.type}`}>
                              <code className="line-code">
                                {renderLineHtml(lineText, extension)}
                              </code>
                            </div>
                          ))}
                           {viewMode !== "2way" && height > chunk.bLines.length && (
                             <div className={`diff-spacer ${chunk.type}`} style={{ height: (height - chunk.bLines.length) * 20 }} />
                           )}
                        </div>
                      );
                    })
                  ) : (
                    // --- 3-WAY LEFT PANE ---
                    displayChunks.map((item) => {
                      if (item.display === 'separator') return renderSeparator(item, 'left');
                      const chunk = item;
                      const height = Math.max(chunk.mLines.length, chunk.resLines.length, chunk.tLines.length);
                      let charOffset = 0;
                      return (
                        <div key={chunk.id} className={`chunk-block ${chunk.type}`}>
                          {chunk.mLines.map((lineText, i) => {
                            const lineNum = chunk.mIdxs[i] + 1;
                            const lineWordDiff = chunk.mineWordDiff.slice(charOffset, charOffset + lineText.length);
                            charOffset += lineText.length + 1;
                            return (
                              <div key={i} className={`line-row ${chunk.type}`}>
                                <span className="line-num">{lineNum}</span>
                                <code className="line-code">
                                  {renderLineHtml(lineText, extension, lineWordDiff)}
                                </code>
                              </div>
                            );
                          })}
                          {height > chunk.mLines.length && (
                            <div className={`diff-spacer ${chunk.type}`} style={{ height: (height - chunk.mLines.length) * 20 }} />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* PANE MIDDLE: Gutter actions (2-way), Merged Result (3-way) */}
              {viewMode === "2way" && (
                <div className="pane-wrapper middle-gutter">
                  <div className="pane-header">&nbsp;</div>
                  <div id="pane-middle" className="pane-content scrollbar-hide" ref={middleRef} onScroll={handleScroll} onMouseEnter={() => { activeScrollRef.current = 'middle'; }}>
                    {displayChunks.map((item) => {
                      if (item.display === 'separator') return renderSeparator(item, 'middle');
                      const chunk = item;
                      const leftCount = chunk.bLines.length;
                      const rightCount = chunk.mLines.length;
                      const height = Math.max(leftCount, rightCount);
                      
                      let connectorSvg = null;
                      if (chunk.type !== 'equal') {
                        const leftHeight = leftCount * 20;
                        const rightHeight = rightCount * 20;
                        const svgWidth = 60;
                        const colors = connectorColors[chunk.type] || { fill: "rgba(56, 85, 112, 0.3)", stroke: "rgba(74, 136, 199, 0.6)" };
                        
                        // Calculate dynamic shiftY based on scroll offsets
                        const shiftY = ((chunk as any).rightY ?? 0) - ((chunk as any).middleY ?? 0) - (scrollTopRightRef.current - scrollTopLeftRef.current);
                        const rightTopLocal = shiftY;
                        const rightBottomLocal = rightHeight + shiftY;
                        
                        const fillPath = `M 0 0 C ${svgWidth / 2} 0, ${svgWidth / 2} ${rightTopLocal}, ${svgWidth} ${rightTopLocal} L ${svgWidth} ${rightBottomLocal} C ${svgWidth / 2} ${rightBottomLocal}, ${svgWidth / 2} ${leftHeight}, 0 ${leftHeight} Z`;

                        connectorSvg = (
                          <svg
                            className="gutter-svg-connector"
                            data-left-height={leftHeight}
                            data-right-height={rightHeight}
                            data-middle-y={(chunk as any).middleY ?? 0}
                            data-right-y={(chunk as any).rightY ?? 0}
                            style={{
                              position: 'absolute',
                              left: 60,
                              top: 0,
                              width: svgWidth,
                              height: Math.max(leftHeight, rightHeight),
                              pointerEvents: 'none',
                              overflow: 'visible',
                              zIndex: 1
                            }}
                          >
                            <path className="fill-path" d={fillPath} fill={colors.fill} />
                          </svg>
                        );
                      }

                      const leftScroll = scrollTopLeftRef.current;
                      const rightScroll = scrollTopRightRef.current;
                      const middleScroll = middleRef.current ? middleRef.current.scrollTop : getMappedScrollTop('left', 'middle', leftScroll);
                      
                      const leftShift = ((chunk as any).leftY ?? 0) - leftScroll - (((chunk as any).middleY ?? 0) - middleScroll);
                      const rightShift = ((chunk as any).rightY ?? 0) - rightScroll - (((chunk as any).middleY ?? 0) - middleScroll);
                      
                      const leftHeight = leftCount * 20;
                      const rightHeight = rightCount * 20;

                      return (
                        <div 
                          key={chunk.id} 
                          className={`chunk-block ${chunk.type}`} 
                          style={{ position: 'relative', height: height * 20 }}
                        >
                          {connectorSvg}
                          
                          {/* Left Column (Line numbers and actions) */}
                          <div
                            className="gutter-column left"
                            data-left-y={(chunk as any).leftY ?? 0}
                            data-middle-y={(chunk as any).middleY ?? 0}
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              width: 60,
                              height: leftHeight,
                              transform: `translateY(${leftShift}px)`,
                              willChange: 'transform'
                            }}
                          >
                            {Array.from({ length: leftCount }).map((_, i) => {
                              const leftLineNum = chunk.bIdxs[i] + 1;
                              let leftAction = null;
                              if (chunk.type !== 'equal') {
                                if (i === 0) {
                                  leftAction = (
                                    <button
                                      type="button"
                                      className="gutter-action left"
                                      title="Accept Left Change"
                                      onClick={() => alert("Apply change functionality is read-only.")}
                                    >
                                      <ChevronRight size={12} />
                                    </button>
                                  );
                                } else {
                                  leftAction = (
                                    <div className="gutter-status left">
                                      <Check size={12} className="jetbrains-checkmark" />
                                    </div>
                                  );
                                }
                              }
                              return (
                                <div key={i} className="gutter-row-side left">
                                  <span className={`gutter-line-num left ${chunk.type}`}>{leftLineNum}</span>
                                  <div className={`gutter-action-wrapper left ${chunk.type}`}>
                                    {leftAction}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Right Column (Line numbers and actions) */}
                          <div
                            className="gutter-column right"
                            data-right-y={(chunk as any).rightY ?? 0}
                            data-middle-y={(chunk as any).middleY ?? 0}
                            style={{
                              position: 'absolute',
                              left: 120,
                              top: 0,
                              width: 60,
                              height: rightHeight,
                              transform: `translateY(${rightShift}px)`,
                              willChange: 'transform'
                            }}
                          >
                            {Array.from({ length: rightCount }).map((_, i) => {
                              const rightLineNum = chunk.mIdxs[i] + 1;
                              let rightAction = null;
                              if (chunk.type !== 'equal') {
                                if (i === 0) {
                                  rightAction = (
                                    <button
                                      type="button"
                                      className="gutter-action right"
                                      title="Accept Right Change"
                                      onClick={() => alert("Apply change functionality is read-only.")}
                                    >
                                      <ChevronLeft size={12} />
                                    </button>
                                  );
                                } else {
                                  rightAction = (
                                    <div className="gutter-status right">
                                      <Check size={12} className="jetbrains-checkmark" />
                                    </div>
                                  );
                                }
                              }
                              return (
                                <div key={i} className="gutter-row-side right">
                                  <div className={`gutter-action-wrapper right ${chunk.type}`}>
                                    {rightAction}
                                  </div>
                                  <span className={`gutter-line-num right ${chunk.type}`}>{rightLineNum}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {viewMode === "3way" && (
                <div className="pane-wrapper">
                  <div className="pane-header">
                    <strong>Base version</strong>
                    <span>common ancestor</span>
                  </div>
                  <div className="pane-content" ref={centerRef} onScroll={handleScroll} onMouseEnter={() => { activeScrollRef.current = 'center'; }}>
                    {displayChunksWithStartIdx.map((item) => {
                      if (item.display === 'separator') return renderSeparator(item, 'middle');
                      const chunk = item;
                      const height = Math.max(chunk.mLines.length, chunk.resLines.length, chunk.tLines.length);
                      let charOffset = 0;
                      return (
                        <div key={chunk.id} className={`chunk-block ${chunk.type}`}>
                          {chunk.resLines.map((lineText, i) => {
                            const lineNum = chunk.resIdxStart! + i;
                            const lineWordDiff = chunk.resultWordDiff.slice(charOffset, charOffset + lineText.length);
                            charOffset += lineText.length + 1;
                            return (
                              <div key={i} className={`line-row ${chunk.type}`}>
                                <span className="line-num">{lineNum}</span>
                                <code className="line-code">
                                  {renderLineHtml(lineText, extension, lineWordDiff)}
                                </code>
                              </div>
                            );
                          })}
                           {height > chunk.resLines.length && (
                             <div className={`diff-spacer ${chunk.type}`} style={{ height: (height - chunk.resLines.length) * 20 }} />
                           )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* PANE RIGHT: 2-way (Current), 3-way (Theirs) */}
              {viewMode !== "1way" && (
                <div className="pane-wrapper">
                  <div className="pane-header">
                    {viewMode === "2way" ? (
                      <>
                        <strong>Current Version</strong>
                        <span>working tree</span>
                      </>
                    ) : (
                      <>
                        <strong>Remote</strong>
                        <span>Theirs</span>
                      </>
                    )}
                  </div>
                  <div className="pane-content" ref={rightRef} onScroll={handleScroll} onMouseEnter={() => { activeScrollRef.current = 'right'; }}>
                    {viewMode === "2way" ? (
                      displayChunks.map((item) => {
                        if (item.display === 'separator') return renderSeparator(item, 'right');
                        const chunk = item;
                        const height = Math.max(chunk.bLines.length, chunk.mLines.length);
                        let charOffset = 0;
                        return (
                          <div key={chunk.id} className={`chunk-block ${chunk.type}`}>
                            {chunk.mLines.map((lineText, i) => {
                              const lineWordDiff = chunk.mineWordDiff.slice(charOffset, charOffset + lineText.length);
                              charOffset += lineText.length + 1;
                              return (
                                <div key={i} className={`line-row ${chunk.type}`}>
                                  <code className="line-code">
                                    {renderLineHtml(lineText, extension, lineWordDiff)}
                                  </code>
                                </div>
                              );
                            })}
                             {viewMode !== "2way" && height > chunk.mLines.length && (
                               <div className={`diff-spacer ${chunk.type}`} style={{ height: (height - chunk.mLines.length) * 20 }} />
                             )}
                          </div>
                        );
                      })
                    ) : (
                      displayChunks.map((item) => {
                        if (item.display === 'separator') return renderSeparator(item, 'right');
                        const chunk = item;
                        const height = Math.max(chunk.mLines.length, chunk.resLines.length, chunk.tLines.length);
                        let charOffset = 0;
                        return (
                          <div key={chunk.id} className={`chunk-block ${chunk.type}`}>
                            {chunk.tLines.map((lineText, i) => {
                              const lineNum = chunk.tIdxs[i] + 1;
                              const lineWordDiff = chunk.theirsWordDiff.slice(charOffset, charOffset + lineText.length);
                              charOffset += lineText.length + 1;
                              return (
                                <div key={i} className={`line-row ${chunk.type}`}>
                                  <span className="line-num">{lineNum}</span>
                                  <code className="line-code">
                                    {renderLineHtml(lineText, extension, lineWordDiff)}
                                  </code>
                                </div>
                              );
                            })}
                            {height > chunk.tLines.length && (
                              <div className={`diff-spacer ${chunk.type}`} style={{ height: (height - chunk.tLines.length) * 20 }} />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-title">{loading ? "Loading..." : "Ready"}</div>
              <p>{message}</p>
            </div>
          )}
        </section>
      </section>

      <footer className="status-bar">
        <span>{loading ? "Working..." : message}</span>
        <span>Read-only · Offline · Local Git</span>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
