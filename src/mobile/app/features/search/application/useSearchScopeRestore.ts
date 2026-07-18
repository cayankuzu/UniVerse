import { useEffect, useRef, useState } from "react";
import { getCachedWarmupPreferences, loadPersistedWarmupPreferences } from "../data";

type PersistedSearchScope = ReturnType<typeof getCachedWarmupPreferences>["lastSearchScope"];

export function useSearchScopeRestore(params: {
  applyPersistedScope: (scope: PersistedSearchScope) => void;
  viewerKey: string;
}) {
  const { applyPersistedScope, viewerKey } = params;
  const [restoreReady, setRestoreReady] = useState(
    Boolean(getCachedWarmupPreferences(viewerKey).lastSearchScope),
  );
  const persistedSearchScopeRef = useRef("");

  useEffect(() => {
    persistedSearchScopeRef.current = "";
    setRestoreReady(Boolean(getCachedWarmupPreferences(viewerKey).lastSearchScope));
  }, [viewerKey]);

  useEffect(() => {
    let cancelled = false;
    void loadPersistedWarmupPreferences(viewerKey).then((preferences) => {
      if (cancelled) return;
      applyPersistedScope(preferences.lastSearchScope);
      setRestoreReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [applyPersistedScope, viewerKey]);

  return {
    persistedSearchScopeRef,
    restoreReady,
  };
}
