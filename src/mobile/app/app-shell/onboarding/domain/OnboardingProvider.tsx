import type { ReactNode } from "react";
import {
  OnboardingContext,
  type OnboardingContextType,
  type PermissionSnapshot,
  useOnboarding as useRuntimeOnboarding,
} from "./runtime";
import { useOnboardingProviderState } from "./useOnboardingProviderState";

export type { PermissionSnapshot };

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const value = useOnboardingProviderState();
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextType {
  return useRuntimeOnboarding();
}
