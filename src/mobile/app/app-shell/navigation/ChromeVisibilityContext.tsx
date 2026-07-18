import { createContext, useContext, useState, type ReactNode } from "react";

type SetBottomTabsVisible = (visible: boolean) => void;

const ChromeVisibilityStateContext = createContext(true);
const ChromeVisibilityActionsContext = createContext<SetBottomTabsVisible>(() => undefined);

export function ChromeVisibilityProvider({ children }: { children: ReactNode }) {
  const [bottomTabsVisible, setBottomTabsVisible] = useState(true);

  return (
    <ChromeVisibilityActionsContext.Provider value={setBottomTabsVisible}>
      <ChromeVisibilityStateContext.Provider value={bottomTabsVisible}>
        {children}
      </ChromeVisibilityStateContext.Provider>
    </ChromeVisibilityActionsContext.Provider>
  );
}

export function useBottomTabsVisible() {
  return useContext(ChromeVisibilityStateContext);
}

export function useSetBottomTabsVisible() {
  return useContext(ChromeVisibilityActionsContext);
}
