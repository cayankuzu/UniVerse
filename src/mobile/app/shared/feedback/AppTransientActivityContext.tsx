import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type AppTransientActivityTone = "error" | "info" | "success";

export type AppTransientActivity = {
  dismissAfterMs?: number;
  hint?: string;
  id: string;
  percent?: number;
  stage: string;
  title: string;
  tone: AppTransientActivityTone;
};

type AppTransientActivityContextValue = {
  activity: AppTransientActivity | null;
  dismissActivity: (activityId?: string) => void;
  showActivity: (activity: Omit<AppTransientActivity, "id"> & { id?: string }) => string;
  updateActivity: (activityId: string, patch: Partial<Omit<AppTransientActivity, "id">>) => void;
};

const AppTransientActivityContext = createContext<AppTransientActivityContextValue | null>(null);

function createActivityId() {
  return `app-activity:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

export function AppTransientActivityProvider({ children }: { children: React.ReactNode }) {
  const [activity, setActivity] = useState<AppTransientActivity | null>(null);

  useEffect(() => {
    if (!activity?.dismissAfterMs) return undefined;
    const timer = setTimeout(() => {
      setActivity((current) => (current?.id === activity.id ? null : current));
    }, activity.dismissAfterMs);
    return () => clearTimeout(timer);
  }, [activity]);

  const dismissActivity = useCallback((activityId?: string) => {
    setActivity((current) => {
      if (!current) return current;
      if (activityId && current.id !== activityId) return current;
      return null;
    });
  }, []);

  const showActivity = useCallback(
    (nextActivity: Omit<AppTransientActivity, "id"> & { id?: string }) => {
      const activityId = nextActivity.id || createActivityId();
      setActivity({
        ...nextActivity,
        id: activityId,
      });
      return activityId;
    },
    [],
  );

  const updateActivity = useCallback(
    (activityId: string, patch: Partial<Omit<AppTransientActivity, "id">>) => {
      setActivity((current) => {
        if (!current || current.id !== activityId) return current;
        return {
          ...current,
          ...patch,
        };
      });
    },
    [],
  );

  const value = useMemo<AppTransientActivityContextValue>(
    () => ({
      activity,
      dismissActivity,
      showActivity,
      updateActivity,
    }),
    [activity, dismissActivity, showActivity, updateActivity],
  );

  return (
    <AppTransientActivityContext.Provider value={value}>
      {children}
    </AppTransientActivityContext.Provider>
  );
}

export function useAppTransientActivity() {
  const context = useContext(AppTransientActivityContext);
  if (!context) {
    throw new Error("useAppTransientActivity must be used within AppTransientActivityProvider.");
  }
  return context;
}
