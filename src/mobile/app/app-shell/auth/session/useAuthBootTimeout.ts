import { useEffect } from "react";
import { AUTH_BOOT_TIMEOUT_MS } from "./authContext.shared";

export function useAuthBootTimeout(params: { clearAuthState: () => void; isLoading: boolean }) {
  const { clearAuthState, isLoading } = params;
  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => {
      clearAuthState();
    }, AUTH_BOOT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [clearAuthState, isLoading]);
}
