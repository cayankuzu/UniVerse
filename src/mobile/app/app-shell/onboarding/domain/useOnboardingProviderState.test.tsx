import { renderHook, waitFor } from "@testing-library/react-native";
import { useOnboardingProviderState } from "./useOnboardingProviderState";

const mockUseAuth = jest.fn();
const mockReadPermissionPromptPreference = jest.fn();
const mockReadPermissionSnapshot = jest.fn();
const mockPersistPermissionPromptPreference = jest.fn();
const mockPersistPermissionSnapshot = jest.fn();

jest.mock("../../auth", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("../data/onboardingStorage", () => ({
  hasAnyPermissionGranted: (snapshot: {
    camera: string;
    location: string;
    microphone: string;
    notifications: string;
    photos: string;
  }) =>
    snapshot.camera === "granted" ||
    snapshot.location === "granted" ||
    snapshot.microphone === "granted" ||
    snapshot.notifications === "granted" ||
    snapshot.photos === "granted",
  persistPermissionPromptPreference: (...args: unknown[]) =>
    mockPersistPermissionPromptPreference(...args),
  persistPermissionSnapshot: (...args: unknown[]) => mockPersistPermissionSnapshot(...args),
  readPermissionPromptPreference: (...args: unknown[]) =>
    mockReadPermissionPromptPreference(...args),
  readPermissionSnapshot: (...args: unknown[]) => mockReadPermissionSnapshot(...args),
}));

describe("useOnboardingProviderState", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      authBootState: "signed_in_hydrated",
      isAuthBootstrapPending: false,
      isDemoMode: false,
      isLoggedIn: true,
      userData: { id: "user-1" },
    });
    mockReadPermissionPromptPreference.mockResolvedValue(false);
    mockPersistPermissionPromptPreference.mockResolvedValue(undefined);
    mockPersistPermissionSnapshot.mockResolvedValue({
      camera: "undetermined",
      location: "undetermined",
      microphone: "undetermined",
      notifications: "undetermined",
      photos: "undetermined",
      completedAt: "2026-06-28T00:00:00.000Z",
    });
  });

  it("does not auto-open the permissions modal after at least one permission was granted", async () => {
    mockReadPermissionSnapshot.mockResolvedValue({
      camera: "undetermined",
      location: "denied",
      microphone: "undetermined",
      notifications: "granted",
      photos: "granted",
      completedAt: "2026-06-28T00:00:00.000Z",
    });

    const { result } = renderHook(() => useOnboardingProviderState());

    await waitFor(() => {
      expect(result.current.hasPermissions).toBe(true);
    });

    expect(result.current.showPermissions).toBe(false);
  });

  it("keeps the reminder visible when no permission has been granted yet", async () => {
    mockReadPermissionSnapshot.mockResolvedValue({
      camera: "undetermined",
      location: "denied",
      microphone: "undetermined",
      notifications: "denied",
      photos: "undetermined",
      completedAt: "2026-06-28T00:00:00.000Z",
    });

    const { result } = renderHook(() => useOnboardingProviderState());

    await waitFor(() => {
      expect(result.current.showPermissions).toBe(true);
    });

    expect(result.current.hasPermissions).toBe(false);
  });
});
