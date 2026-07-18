import { createContext, useContext } from "react";
import type {
  PermissionSnapshot,
  PermissionStatus,
} from "../../../platform/permissions/permission.types";

export type { PermissionSnapshot, PermissionStatus };

export interface OnboardingContextType {
  grantPermissions: (
    snapshot?: PermissionSnapshot,
    options?: { suppressPrompt?: boolean },
  ) => Promise<void>;
  hasPermissions: boolean;
  showPermissions: boolean;
}

export const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function useRequiredOnboardingContext(): OnboardingContextType {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be within OnboardingProvider");
  }
  return context;
}

export function useOnboarding() {
  return useRequiredOnboardingContext();
}
