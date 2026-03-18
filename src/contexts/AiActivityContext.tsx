import { createContext, useContext, useCallback, useSyncExternalStore, useRef } from "react";

type Listener = () => void;

interface AiActivityStore {
  subscribe: (listener: Listener) => () => void;
  getSnapshot: () => ReadonlySet<string>;
  start: (key: string) => void;
  end: (key: string) => void;
}

function createAiActivityStore(): AiActivityStore {
  let activities = new Set<string>();
  const listeners = new Set<Listener>();

  function emit() {
    listeners.forEach((l) => l());
  }

  return {
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return activities;
    },
    start(key: string) {
      if (!activities.has(key)) {
        activities = new Set(activities);
        activities.add(key);
        emit();
      }
    },
    end(key: string) {
      if (activities.has(key)) {
        activities = new Set(activities);
        activities.delete(key);
        emit();
      }
    },
  };
}

const AiActivityCtx = createContext<AiActivityStore | null>(null);

export function AiActivityProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<AiActivityStore>();
  if (!storeRef.current) {
    storeRef.current = createAiActivityStore();
  }
  return (
    <AiActivityCtx.Provider value={storeRef.current}>
      {children}
    </AiActivityCtx.Provider>
  );
}

export function useAiActivity() {
  const store = useContext(AiActivityCtx);
  if (!store) throw new Error("useAiActivity must be used inside AiActivityProvider");

  const activities = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  const start = useCallback((key: string) => store.start(key), [store]);
  const end = useCallback((key: string) => store.end(key), [store]);

  return {
    /** Currently active AI operation keys */
    activities,
    /** Number of concurrent AI operations */
    activeCount: activities.size,
    /** Whether any AI operation is running */
    isAnyActive: activities.size > 0,
    /** Mark an AI operation as started */
    start,
    /** Mark an AI operation as finished */
    end,
  };
}
