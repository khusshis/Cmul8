/**
 * Per-project persistence for the Reliability Lab (settings, run history, scenario library).
 * Browser localStorage only: every access is wrapped so private mode, blocked storage or a
 * full quota degrade to "not saved" instead of crashing. Pass `store` in tests.
 */

export type KV = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function browserStore(): KV | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null; // Accessing localStorage itself can throw (blocked site data).
  }
}

export function readJSON<T>(key: string, fallback: T, store: KV | null = browserStore()): T {
  try {
    const raw = store?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Returns false when the value couldn't be stored (no storage, quota, serialisation error). */
export function writeJSON(key: string, value: unknown, store: KV | null = browserStore()): boolean {
  try {
    if (!store) return false;
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const k = (kind: string, projectId: string) => `justcmul8:lab:${kind}:${projectId || "local"}`;

// ─── Settings ────────────────────────────────────────────────────────────────

/** Shallow-merges saved settings over defaults, so new fields get their default. */
export function loadSettings<T extends object>(projectId: string, defaults: T, store?: KV | null): T {
  const saved = readJSON<Partial<T> | null>(k("settings", projectId), null, store);
  return saved && typeof saved === "object" ? { ...defaults, ...saved } : defaults;
}

export const saveSettings = (projectId: string, settings: object, store?: KV | null) => writeJSON(k("settings", projectId), settings, store);

// ─── Named lists (history, scenario library) ─────────────────────────────────

export interface Named {
  id: string;
  name: string;
}

function list<T extends Named>(kind: string, cap: number) {
  const key = (projectId: string) => k(kind, projectId);
  const load = (projectId: string, store?: KV | null): T[] => {
    const v = readJSON<unknown>(key(projectId), [], store);
    return Array.isArray(v) ? (v as T[]).filter((x) => x && typeof x.id === "string") : [];
  };
  const save = (projectId: string, items: T[], store?: KV | null) => writeJSON(key(projectId), items, store);
  return {
    load,
    /** Newest first; keeps at most `cap` items but never drops a pinned one. */
    add(projectId: string, item: T, store?: KV | null): T[] {
      const items = [item, ...load(projectId, store).filter((x) => x.id !== item.id)];
      const pinned = items.filter((x) => (x as { pinned?: boolean }).pinned);
      const rest = items.filter((x) => !(x as { pinned?: boolean }).pinned).slice(0, Math.max(0, cap - pinned.length));
      const next = items.filter((x) => pinned.includes(x) || rest.includes(x));
      save(projectId, next, store);
      return next;
    },
    rename(projectId: string, id: string, name: string, store?: KV | null): T[] {
      const next = load(projectId, store).map((x) => (x.id === id ? { ...x, name: name.trim() || x.name } : x));
      save(projectId, next, store);
      return next;
    },
    remove(projectId: string, id: string, store?: KV | null): T[] {
      const next = load(projectId, store).filter((x) => x.id !== id);
      save(projectId, next, store);
      return next;
    },
    update(projectId: string, fn: (items: T[]) => T[], store?: KV | null): T[] {
      const next = fn(load(projectId, store));
      save(projectId, next, store);
      return next;
    },
  };
}

/** Aggregates of one stress-test batch (never the raw SimResults). */
export interface HistoryEntry extends Named {
  createdAt: string;
  runCount: number;
  level: number;
  riskQ: number;
  durationSeconds: number;
  conditions: string[];
  metrics: Record<string, { n: number; mean: number; stdDev: number; ciLower: number; ciUpper: number; bandLo: number; bandHi: number; min: number; max: number }>;
  pinned?: boolean;
}

export const runHistory = list<HistoryEntry>("history", 10);

/** Pin one entry as the reference (or none with id = null). */
export const pinHistory = (projectId: string, id: string | null, store?: KV | null) =>
  runHistory.update(projectId, (items) => items.map((x) => ({ ...x, pinned: x.id === id })), store);

/** A saved scenario: graph + per-scenario stress, reusable across sessions. */
export interface LibraryScenario extends Named {
  savedAt: string;
  nodes: unknown[];
  edges: unknown[];
  sourceIds?: string[];
  stress?: unknown;
}

export const scenarioLibrary = list<LibraryScenario>("scenarios", 30);

export const newId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
