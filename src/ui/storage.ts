// Save storage: IndexedDB (preferred) → localStorage → memory only.
// Each write is a single IndexedDB transaction (atomic replacement). Autosaves
// rotate between two slots so a failed or interrupted write never destroys the
// only copy. Browser saves live per origin and are not synced across devices.

import { peekMeta, peekSchema, type SaveMeta } from '../sim/save';

export type StoreMode = 'indexeddb' | 'localstorage' | 'memory';

export interface SlotInfo {
  key: string;
  meta: SaveMeta | null;
  /** save format number (older formats are converted when loaded) */
  schema: number | null;
  size: number;
}

export class SaveStore {
  mode: StoreMode = 'memory';
  problem: string | null = null;
  private db: IDBDatabase | null = null;
  private mem = new Map<string, string>();

  /** Saves by default; the map library keeps its maps in a store of its own. */
  constructor(
    private readonly dbName = 'crown-and-frontier',
    private readonly storeName = 'saves',
    private readonly prefix = 'cnf-save:',
  ) {}

  async init(): Promise<void> {
    try {
      if (typeof indexedDB === 'undefined') throw new Error('IndexedDB unavailable');
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(this.storeName)) req.result.createObjectStore(this.storeName);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('open failed'));
        req.onblocked = () => reject(new Error('blocked'));
        setTimeout(() => reject(new Error('timeout')), 4000);
      });
      this.mode = 'indexeddb';
      return;
    } catch {
      this.db = null;
    }
    try {
      const k = `${this.prefix}__probe`;
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      this.mode = 'localstorage';
      this.problem = 'IndexedDB is unavailable; saves use the smaller localStorage area.';
    } catch {
      this.mode = 'memory';
      this.problem = 'This browser context blocks storage (private mode or school policy). Saves last only until the tab closes — use Export to keep your campaign.';
    }
  }

  private tx(mode: IDBTransactionMode): IDBObjectStore {
    return this.db!.transaction(this.storeName, mode).objectStore(this.storeName);
  }

  async put(key: string, text: string): Promise<void> {
    if (this.mode === 'indexeddb' && this.db) {
      await new Promise<void>((resolve, reject) => {
        const t = this.db!.transaction(this.storeName, 'readwrite');
        t.objectStore(this.storeName).put(text, key);
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error ?? new Error('write failed'));
        t.onabort = () => reject(t.error ?? new Error('write aborted'));
      }).catch((e) => {
        throw new Error(quotaMessage(e));
      });
      return;
    }
    if (this.mode === 'localstorage') {
      try {
        localStorage.setItem(this.prefix + key, text);
      } catch (e) {
        throw new Error(quotaMessage(e));
      }
      return;
    }
    this.mem.set(key, text);
  }

  async get(key: string): Promise<string | null> {
    if (this.mode === 'indexeddb' && this.db) {
      return new Promise((resolve, reject) => {
        const r = this.tx('readonly').get(key);
        r.onsuccess = () => resolve((r.result as string | undefined) ?? null);
        r.onerror = () => reject(r.error);
      });
    }
    if (this.mode === 'localstorage') {
      try {
        return localStorage.getItem(this.prefix + key);
      } catch {
        return null;
      }
    }
    return this.mem.get(key) ?? null;
  }

  async remove(key: string): Promise<void> {
    if (this.mode === 'indexeddb' && this.db) {
      await new Promise<void>((resolve, reject) => {
        const t = this.db!.transaction(this.storeName, 'readwrite');
        t.objectStore(this.storeName).delete(key);
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
      });
      return;
    }
    if (this.mode === 'localstorage') {
      try {
        localStorage.removeItem(this.prefix + key);
      } catch {
        /* ignore */
      }
      return;
    }
    this.mem.delete(key);
  }

  async keys(): Promise<string[]> {
    if (this.mode === 'indexeddb' && this.db) {
      return new Promise((resolve, reject) => {
        const r = this.tx('readonly').getAllKeys();
        r.onsuccess = () => resolve((r.result as IDBValidKey[]).map(String));
        r.onerror = () => reject(r.error);
      });
    }
    if (this.mode === 'localstorage') {
      const out: string[] = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith(this.prefix)) out.push(k.slice(this.prefix.length));
        }
      } catch {
        /* ignore */
      }
      return out;
    }
    return [...this.mem.keys()];
  }

  async list(): Promise<SlotInfo[]> {
    const keys = await this.keys();
    const out: SlotInfo[] = [];
    for (const key of keys.sort()) {
      const text = await this.get(key);
      if (text) out.push({ key, meta: peekMeta(text), schema: peekSchema(text), size: text.length });
    }
    return out;
  }

  /** Writes an autosave into the older of two rotating slots. */
  async autosave(text: string): Promise<string> {
    const slots = await this.list();
    const a = slots.find((s) => s.key === 'autosave-a');
    const b = slots.find((s) => s.key === 'autosave-b');
    const older = !a ? 'autosave-a' : !b ? 'autosave-b' : (a.meta?.savedAt ?? '') <= (b.meta?.savedAt ?? '') ? 'autosave-a' : 'autosave-b';
    await this.put(older, text);
    return older;
  }

  async latest(): Promise<SlotInfo | null> {
    const slots = await this.list();
    let best: SlotInfo | null = null;
    for (const s of slots) if (s.meta && (!best || (s.meta.savedAt > (best.meta?.savedAt ?? '')))) best = s;
    return best;
  }
}

function quotaMessage(e: unknown): string {
  const name = (e as { name?: string })?.name ?? '';
  if (name === 'QuotaExceededError' || /quota/i.test(String(e))) return 'Browser storage is full. Delete old saves or export this campaign to a file.';
  return `Saving failed: ${(e as Error)?.message ?? e}. Try Export to keep a copy.`;
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1000);
}

export function pickFile(accept: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      if (f.size > 20_000_000) return resolve('__too_big__');
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => resolve(null);
      reader.readAsText(f);
    };
    input.click();
  });
}
