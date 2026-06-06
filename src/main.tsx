import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import { 
  GitBranch, Folder, File, ChevronRight, ChevronDown, Check, ArrowUp, RefreshCw, AlertTriangle 
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

  // Open tabs state
  const [openTabs, setOpenTabs] = useState<string[]>([]);

  // Sync scroll lock
  const isSyncing = useRef(false);
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

  // Sync scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const source = e.currentTarget;
    if (isSyncing.current) return;
    isSyncing.current = true;
    
    const targetScrollTop = source.scrollTop;
    const targetScrollLeft = source.scrollLeft;
    
    const panes = [leftRef.current, middleRef.current, centerRef.current, rightRef.current];
    for (const p of panes) {
      if (p && p !== source) {
        if (p.scrollTop !== targetScrollTop) {
          p.scrollTop = targetScrollTop;
        }
        if (p.id !== 'pane-middle' && p.scrollLeft !== targetScrollLeft) {
          p.scrollLeft = targetScrollLeft;
        }
      }
    }
    
    isSyncing.current = false;
  };

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

  // Dynamic merged center pane indices
  const chunksWithStartIdx = useMemo(() => {
    let nextResIdx = 1;
    return processedChunks.map(chunk => {
      const start = nextResIdx;
      if (chunk.resLines) {
        nextResIdx += chunk.resLines.length;
      }
      return {
        ...chunk,
        resIdxStart: start
      };
    });
  }, [processedChunks]);

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
            <div className="diff-grid">
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
                <div className="pane-content" ref={leftRef} onScroll={handleScroll}>
                  {viewMode === "1way" ? (
                    // --- 1-WAY PANE ---
                    processedChunks.map((chunk) => {
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
                    processedChunks.map((chunk) => {
                      const height = Math.max(chunk.bLines.length, chunk.mLines.length);
                      return (
                        <div key={chunk.id} className={`chunk-block ${chunk.type}`}>
                          {Array.from({ length: height }).map((_, i) => {
                            const hasLine = i < chunk.bLines.length;
                            const lineText = hasLine ? chunk.bLines[i] : "";
                            const lineNum = hasLine ? chunk.bIdxs[i] + 1 : "";
                            const isEmpty = !hasLine;
                            return (
                              <div key={i} className="line-row">
                                <span className={`line-num ${isEmpty ? "empty-bg" : ""}`}>{lineNum}</span>
                                <code className={`line-code ${isEmpty ? "empty-bg" : ""}`}>
                                  {hasLine ? renderLineHtml(lineText, extension) : ""}
                                </code>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })
                  ) : (
                    // --- 3-WAY LEFT PANE ---
                    processedChunks.map((chunk) => {
                      const height = Math.max(chunk.mLines.length, chunk.resLines.length, chunk.tLines.length);
                      let charOffset = 0;
                      return (
                        <div key={chunk.id} className={`chunk-block ${chunk.type}`}>
                          {Array.from({ length: height }).map((_, i) => {
                            const hasLine = i < chunk.mLines.length;
                            const lineText = hasLine ? chunk.mLines[i] : "";
                            const lineNum = hasLine ? chunk.mIdxs[i] + 1 : "";
                            const isEmpty = !hasLine;
                            
                            const lineWordDiff = hasLine ? chunk.mineWordDiff.slice(charOffset, charOffset + lineText.length) : undefined;
                            if (hasLine) {
                              charOffset += lineText.length + 1;
                            }
                            
                            return (
                              <div key={i} className="line-row">
                                <span className={`line-num ${isEmpty ? "empty-bg" : ""}`}>{lineNum}</span>
                                <code className={`line-code ${isEmpty ? "empty-bg" : ""}`}>
                                  {hasLine ? renderLineHtml(lineText, extension, lineWordDiff) : ""}
                                </code>
                              </div>
                            );
                          })}
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
                  <div id="pane-middle" className="pane-content scrollbar-hide" ref={middleRef} onScroll={handleScroll}>
                    {processedChunks.map((chunk) => {
                      const height = Math.max(chunk.bLines.length, chunk.mLines.length);
                      return (
                        <div 
                          key={chunk.id} 
                          className={`chunk-block ${chunk.type}`} 
                          style={{ height: height * 20, position: 'relative' }}
                        >
                          {chunk.type !== 'equal' && (
                            <div 
                              className="gutter-action" 
                              title="Apply change"
                              style={{ position: 'sticky', top: 0 }}
                              onClick={() => alert("Apply change functionality is read-only.")}
                            >
                              <ChevronRight size={14} />
                            </div>
                          )}
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
                  <div className="pane-content" ref={centerRef} onScroll={handleScroll}>
                    {chunksWithStartIdx.map((chunk) => {
                      const height = Math.max(chunk.mLines.length, chunk.resLines.length, chunk.tLines.length);
                      let charOffset = 0;
                      return (
                        <div key={chunk.id} className={`chunk-block ${chunk.type}`}>
                          {Array.from({ length: height }).map((_, i) => {
                            const hasLine = i < chunk.resLines.length;
                            const lineText = hasLine ? chunk.resLines[i] : "";
                            const lineNum = hasLine ? chunk.resIdxStart! + i : "";
                            const isEmpty = !hasLine;
                            
                            const lineWordDiff = hasLine ? chunk.resultWordDiff.slice(charOffset, charOffset + lineText.length) : undefined;
                            if (hasLine) {
                              charOffset += lineText.length + 1;
                            }
                            
                            return (
                              <div key={i} className="line-row">
                                <span className={`line-num ${isEmpty ? "empty-bg" : ""}`}>{lineNum}</span>
                                <code className={`line-code ${isEmpty ? "empty-bg" : ""}`}>
                                  {hasLine ? renderLineHtml(lineText, extension, lineWordDiff) : ""}
                                </code>
                              </div>
                            );
                          })}
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
                  <div className="pane-content" ref={rightRef} onScroll={handleScroll}>
                    {viewMode === "2way" ? (
                      processedChunks.map((chunk) => {
                        const height = Math.max(chunk.bLines.length, chunk.mLines.length);
                        let charOffset = 0;
                        return (
                          <div key={chunk.id} className={`chunk-block ${chunk.type}`}>
                            {Array.from({ length: height }).map((_, i) => {
                              const hasLine = i < chunk.mLines.length;
                              const lineText = hasLine ? chunk.mLines[i] : "";
                              const lineNum = hasLine ? chunk.mIdxs[i] + 1 : "";
                              const isEmpty = !hasLine;
                              
                              const lineWordDiff = hasLine ? chunk.mineWordDiff.slice(charOffset, charOffset + lineText.length) : undefined;
                              if (hasLine) {
                                charOffset += lineText.length + 1;
                              }
                              
                              return (
                                <div key={i} className="line-row">
                                  <span className={`line-num ${isEmpty ? "empty-bg" : ""}`}>{lineNum}</span>
                                  <code className={`line-code ${isEmpty ? "empty-bg" : ""}`}>
                                    {hasLine ? renderLineHtml(lineText, extension, lineWordDiff) : ""}
                                  </code>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })
                    ) : (
                      processedChunks.map((chunk) => {
                        const height = Math.max(chunk.mLines.length, chunk.resLines.length, chunk.tLines.length);
                        let charOffset = 0;
                        return (
                          <div key={chunk.id} className={`chunk-block ${chunk.type}`}>
                            {Array.from({ length: height }).map((_, i) => {
                              const hasLine = i < chunk.tLines.length;
                              const lineText = hasLine ? chunk.tLines[i] : "";
                              const lineNum = hasLine ? chunk.tIdxs[i] + 1 : "";
                              const isEmpty = !hasLine;
                              
                              const lineWordDiff = hasLine ? chunk.theirsWordDiff.slice(charOffset, charOffset + lineText.length) : undefined;
                              if (hasLine) {
                                charOffset += lineText.length + 1;
                              }
                              
                              return (
                                <div key={i} className="line-row">
                                  <span className={`line-num ${isEmpty ? "empty-bg" : ""}`}>{lineNum}</span>
                                  <code className={`line-code ${isEmpty ? "empty-bg" : ""}`}>
                                    {hasLine ? renderLineHtml(lineText, extension, lineWordDiff) : ""}
                                  </code>
                                </div>
                              );
                            })}
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
