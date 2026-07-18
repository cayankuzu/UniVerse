import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export type MainTabKey = "home" | "search" | "profile";

type TabReselectCounters = Record<MainTabKey, number>;

const INITIAL_COUNTERS: TabReselectCounters = {
  home: 0,
  profile: 0,
  search: 0,
};

const TabReselectStateContext = createContext<TabReselectCounters>(INITIAL_COUNTERS);
const TabReselectActionsContext = createContext<(tab: MainTabKey) => void>(() => undefined);

export function TabReselectProvider({ children }: { children: ReactNode }) {
  const [counters, setCounters] = useState<TabReselectCounters>(INITIAL_COUNTERS);
  const triggerTabReselect = useCallback((tab: MainTabKey) => {
    setCounters((previous) => ({
      ...previous,
      [tab]: previous[tab] + 1,
    }));
  }, []);

  return (
    <TabReselectActionsContext.Provider value={triggerTabReselect}>
      <TabReselectStateContext.Provider value={counters}>
        {children}
      </TabReselectStateContext.Provider>
    </TabReselectActionsContext.Provider>
  );
}

export function useTriggerTabReselect() {
  return useContext(TabReselectActionsContext);
}

export function useTabReselectCounter(tab: MainTabKey) {
  return useContext(TabReselectStateContext)[tab] ?? 0;
}
