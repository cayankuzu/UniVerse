import { useCallback, useMemo, useRef, useState } from "react";
import {
  resolveLockedRequestState,
  type RequestAction,
  type RequestStatus,
} from "../domain/followRequestState";
import {
  applyPendingActionState,
  applyProcessedActionState,
  type PendingFollowActions,
} from "./notificationFollowRequestAction.shared";

export function useFollowRequestActionStore() {
  const [pendingActions, setPendingActions] = useState<PendingFollowActions>({});
  const [processedActions, setProcessedActions] = useState<PendingFollowActions>({});
  const pendingActionRef = useRef<Record<string, RequestAction>>({});
  const processedActionRef = useRef<PendingFollowActions>({});

  const clearPendingActionRef = useCallback((key: string) => {
    delete pendingActionRef.current[key];
  }, []);

  const rememberPendingAction = useCallback((key: string, action: RequestAction) => {
    pendingActionRef.current[key] = action;
  }, []);

  const resolveLockedState = useCallback(
    (key: string, requestStatus?: RequestStatus) =>
      resolveLockedRequestState({
        pendingAction: pendingActionRef.current[key],
        processedAction: processedActionRef.current[key],
        requestStatus,
      }),
    [],
  );

  const setPendingAction = useCallback((key: string, action?: RequestAction) => {
    setPendingActions((current) => applyPendingActionState(current, key, action));
  }, []);

  const setProcessedAction = useCallback((key: string, action: RequestAction) => {
    setProcessedActions((current) => {
      const next = applyProcessedActionState(current, key, action);
      processedActionRef.current = next;
      return next;
    });
  }, []);

  return useMemo(
    () => ({
      clearPendingActionRef,
      pendingActions,
      processedActions,
      rememberPendingAction,
      resolveLockedState,
      setPendingAction,
      setProcessedAction,
    }),
    [
      clearPendingActionRef,
      pendingActions,
      processedActions,
      rememberPendingAction,
      resolveLockedState,
      setPendingAction,
      setProcessedAction,
    ],
  );
}
