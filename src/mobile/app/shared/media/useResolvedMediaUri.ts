import { useEffect, useRef, useState } from "react";
import { getCachedResolvedMediaUri, normalizeMediaUriInput, resolveMediaUri } from "./mediaUri";
import { runLowPriorityTask } from "../utils/lowPriorityTaskScheduler";
import { scheduleAfterInteractions } from "../utils/scheduleAfterInteractions";

const RETRY_DELAYS_MS = [120, 320, 900, 1800];
const DEFAULT_DEFERRED_RESOLVE_DELAY_MS = 96;

type ResolvePriority = "deferred" | "eager";

export function useResolvedMediaUri(
  uri?: string | null,
  options?: { priority?: ResolvePriority; retry?: boolean },
) {
  const normalizedUri = normalizeMediaUriInput(uri);
  const priority = options?.priority || "eager";
  const retryEnabled = options?.retry !== false;
  const [resolvedUri, setResolvedUri] = useState(() => getCachedResolvedMediaUri(normalizedUri));
  const [retryAttempt, setRetryAttempt] = useState(0);
  const lastNormalizedRef = useRef(normalizedUri);

  useEffect(() => {
    if (lastNormalizedRef.current !== normalizedUri) {
      lastNormalizedRef.current = normalizedUri;
      setRetryAttempt(0);
      const cached = getCachedResolvedMediaUri(normalizedUri);
      if (cached) {
        setResolvedUri(cached);
        return;
      }
      setResolvedUri("");
    }
  }, [normalizedUri]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let deferredTask: { cancel: () => void } | null = null;
    const immediate = getCachedResolvedMediaUri(normalizedUri);
    if (immediate || !normalizedUri) {
      setResolvedUri(immediate);
      return () => {
        cancelled = true;
      };
    }

    const handleResolvedUri = (nextUri: string) => {
      if (cancelled) return;
      setResolvedUri(nextUri);
      if (retryEnabled && !nextUri && retryAttempt < RETRY_DELAYS_MS.length) {
        retryTimer = setTimeout(() => {
          setRetryAttempt((current) => current + 1);
        }, RETRY_DELAYS_MS[retryAttempt]);
      }
    };

    const resolveTask = () => resolveMediaUri(normalizedUri).then(handleResolvedUri);

    if (priority === "deferred") {
      deferredTask = scheduleAfterInteractions(() => {
        void runLowPriorityTask(() => resolveMediaUri(normalizedUri), {
          key: `media-uri:${normalizedUri}`,
        }).then(handleResolvedUri);
      }, DEFAULT_DEFERRED_RESOLVE_DELAY_MS);
    } else {
      void resolveTask();
    }

    return () => {
      cancelled = true;
      deferredTask?.cancel();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [normalizedUri, priority, retryAttempt, retryEnabled]);

  return resolvedUri;
}
