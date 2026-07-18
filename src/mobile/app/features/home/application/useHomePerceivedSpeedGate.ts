import { useEffect, useMemo, useRef, useState } from "react";
import { subscribeToInteractionIdle } from "../../../shared/performance/interactionGate";
import { scheduleAfterInteractions } from "../../../shared/utils/scheduleAfterInteractions";

const SECONDARY_READ_DELAY_MS = 80;
const INTERACTION_SETTLE_DELAY_MS = 48;
const MEDIA_UPGRADE_DELAY_MS = 24;
const PREFETCH_DELAY_MS = 40;

type UseHomePerceivedSpeedGateParams = {
  hasImmediateContent: boolean;
  hasUserInteracted: boolean;
  scopeKey: string;
};

export function useHomePerceivedSpeedGate(params: UseHomePerceivedSpeedGateParams) {
  const firstVisibleAtRef = useRef(0);
  const [allowSecondaryReads, setAllowSecondaryReads] = useState(false);
  const [allowMediaUpgrade, setAllowMediaUpgrade] = useState(false);
  const [allowPrefetch, setAllowPrefetch] = useState(false);

  useEffect(() => {
    firstVisibleAtRef.current = 0;
    setAllowSecondaryReads(false);
    setAllowMediaUpgrade(false);
    setAllowPrefetch(false);
  }, [params.scopeKey]);

  useEffect(() => {
    if (!params.hasImmediateContent || firstVisibleAtRef.current > 0) {
      return;
    }
    firstVisibleAtRef.current = Date.now();
  }, [params.hasImmediateContent]);

  useEffect(() => {
    if (!params.hasImmediateContent || allowSecondaryReads) {
      return;
    }

    if (!params.hasUserInteracted) {
      const timer = setTimeout(() => {
        setAllowSecondaryReads(true);
      }, SECONDARY_READ_DELAY_MS);
      return () => clearTimeout(timer);
    }

    let settled = false;
    let settleTask: { cancel: () => void } | null = null;
    const unsubscribe = subscribeToInteractionIdle(() => {
      settleTask?.cancel();
      settleTask = scheduleAfterInteractions(() => {
        if (settled) return;
        settled = true;
        setAllowSecondaryReads(true);
      }, INTERACTION_SETTLE_DELAY_MS);
    });

    return () => {
      settled = true;
      settleTask?.cancel();
      unsubscribe();
    };
  }, [allowSecondaryReads, params.hasImmediateContent, params.hasUserInteracted]);

  useEffect(() => {
    if (!allowSecondaryReads || allowMediaUpgrade) return;
    const task = scheduleAfterInteractions(() => {
      setAllowMediaUpgrade(true);
    }, MEDIA_UPGRADE_DELAY_MS);
    return () => task.cancel();
  }, [allowMediaUpgrade, allowSecondaryReads]);

  useEffect(() => {
    if (!allowMediaUpgrade || allowPrefetch) return;
    const task = scheduleAfterInteractions(() => {
      setAllowPrefetch(true);
    }, PREFETCH_DELAY_MS);
    return () => task.cancel();
  }, [allowMediaUpgrade, allowPrefetch]);

  return useMemo(
    () => ({
      allowImmediateContent: params.hasImmediateContent,
      allowMediaUpgrade,
      allowPrefetch,
      allowSecondaryReads,
    }),
    [allowMediaUpgrade, allowPrefetch, allowSecondaryReads, params.hasImmediateContent],
  );
}
