import React from "react";
import { render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthContext, defaultUserData } from "../../../app-shell/auth/session/authContext.shared";
import { appTheme } from "../../../shared/theme";

export const TEST_VIEWER = {
  id: "viewer-1",
  name: "Viewer",
  profileImage: "",
  university: "Uni",
  username: "viewer",
} as const;
const TEST_AUTH_CONTEXT = {
  accountType: "student" as const,
  authBootState: "signed_in_hydrated" as const,
  blockedUsers: [],
  blockUser: async () => undefined,
  deleteAccount: async () => undefined,
  isAuthBootstrapPending: false,
  isBlocked: () => false,
  isDemoMode: false,
  isLoading: false,
  isLoggedIn: true,
  isPrivateAccount: false,
  login: async () => undefined,
  loginAsDemo: () => undefined,
  logout: async () => undefined,
  pendingVerification: null,
  setIsPrivateAccount: () => undefined,
  setPendingVerification: () => undefined,
  unblockUser: async () => undefined,
  updateUserData: () => undefined,
  userData: {
    ...defaultUserData,
    id: TEST_VIEWER.id,
    name: TEST_VIEWER.name,
    profileImage: TEST_VIEWER.profileImage,
    university: TEST_VIEWER.university,
    username: TEST_VIEWER.username,
  },
};
export function renderWithProviders(node: React.ReactElement) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 44, right: 0, bottom: 34, left: 0 },
      }}
    >
      <PaperProvider theme={appTheme}>
        <AuthContext.Provider value={TEST_AUTH_CONTEXT}>{node}</AuthContext.Provider>
      </PaperProvider>
    </SafeAreaProvider>,
  );
}
