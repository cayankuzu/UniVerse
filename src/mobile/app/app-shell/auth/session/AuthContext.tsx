import {
  AuthContext,
  type AccountType,
  type AuthProviderProps,
  type UserData,
  useRequiredAuthContext,
} from "./authContext.shared";
import { useAuthContextValue } from "./useAuthContextValue";
import { useAuthRuntime } from "./useAuthRuntime";

export type { AccountType };
export { AuthContext };
export type { UserData };

export function AuthProvider({ children }: AuthProviderProps) {
  const runtime = useAuthRuntime();
  const value = useAuthContextValue(runtime);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useRequiredAuthContext();
}
