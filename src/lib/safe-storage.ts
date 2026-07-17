// Safari Private Browsing + iOS lockdown modes throw SecurityError on any
// localStorage/sessionStorage access. Wrap every read/write so a module
// import never explodes and takes hydration down with it.

type StorageKind = "local" | "session";

function getStore(kind: StorageKind): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function safeGet(key: string, kind: StorageKind = "local"): string | null {
  const s = getStore(kind);
  if (!s) return null;
  try {
    return s.getItem(key);
  } catch {
    return null;
  }
}

export function safeSet(key: string, value: string, kind: StorageKind = "local"): void {
  const s = getStore(kind);
  if (!s) return;
  try {
    s.setItem(key, value);
  } catch {
    // Quota exceeded or SecurityError — ignore.
  }
}

export function safeRemove(key: string, kind: StorageKind = "local"): void {
  const s = getStore(kind);
  if (!s) return;
  try {
    s.removeItem(key);
  } catch {
    // ignore
  }
}

// Returns a Storage-shaped object that never throws. Handy for libraries
// that expect a Storage instance (e.g. Supabase auth's `storage` option).
export function safeStorage(kind: StorageKind = "local"): Storage {
  return {
    get length() {
      const s = getStore(kind);
      try {
        return s?.length ?? 0;
      } catch {
        return 0;
      }
    },
    clear() {
      const s = getStore(kind);
      try {
        s?.clear();
      } catch {
        /* ignore */
      }
    },
    getItem(key: string) {
      return safeGet(key, kind);
    },
    key(index: number) {
      const s = getStore(kind);
      try {
        return s?.key(index) ?? null;
      } catch {
        return null;
      }
    },
    removeItem(key: string) {
      safeRemove(key, kind);
    },
    setItem(key: string, value: string) {
      safeSet(key, value, kind);
    },
  };
}
