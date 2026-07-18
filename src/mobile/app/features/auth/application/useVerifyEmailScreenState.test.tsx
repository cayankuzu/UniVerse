import { act, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";

const mockGetAuthSession = jest.fn();
const mockIsFocused = jest.fn(() => true);

jest.mock("@react-navigation/native", () => ({
  useIsFocused: () => mockIsFocused(),
}));

jest.mock("../data", () => ({
  getAuthSession: (...args: unknown[]) => mockGetAuthSession(...args),
  resendSignupVerification: jest.fn(),
  subscribeToAuthState: jest.fn(() => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  })),
}));

jest.mock("../data/pendingRegistration", () => ({
  finalizePendingRegistrationOrThrow: jest.fn(async () => undefined),
  PENDING_REGISTRATION_FINALIZE_ERROR_MESSAGE: "finalize failed",
}));

import { useVerifyEmailScreenState } from "./useVerifyEmailScreenState";

function renderVerificationHook(
  options: { email?: string; goHome?: jest.Mock; goToWelcome?: jest.Mock } = {},
) {
  const goHome = options.goHome || jest.fn();
  const goToWelcome = options.goToWelcome || jest.fn();
  return renderHook(() =>
    useVerifyEmailScreenState({
      email: options.email === undefined ? "alice@example.test" : options.email,
      goHome,
      goToLogin: jest.fn(),
      goToWelcome,
      setPendingVerification: jest.fn(),
      updateUserData: jest.fn(),
    }),
  );
}

describe("useVerifyEmailScreenState polling budget", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockIsFocused.mockReturnValue(true);
    mockGetAuthSession.mockResolvedValue({ data: { session: null } });
    (AppState as unknown as { currentState: string }).currentState = "active";
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("does not poll while the verification screen is unfocused", async () => {
    mockIsFocused.mockReturnValue(false);
    renderVerificationHook();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });

    expect(mockGetAuthSession).not.toHaveBeenCalled();
  });

  it("polls once per interval while focused and active", async () => {
    renderVerificationHook();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(5_000);
    });

    expect(mockGetAuthSession).toHaveBeenCalledTimes(1);
  });

  it("returns to welcome when no verification identity is available", () => {
    const goToWelcome = jest.fn();
    renderVerificationHook({ email: "", goToWelcome });
    expect(goToWelcome).toHaveBeenCalledTimes(1);
  });

  it("stops polling and completes registration as soon as confirmation appears", async () => {
    const goHome = jest.fn();
    mockGetAuthSession.mockResolvedValue({
      data: { session: { user: { email_confirmed_at: "2026-07-18T00:00:00.000Z" } } },
    });
    renderVerificationHook({ goHome });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(5_000);
      await Promise.resolve();
    });

    expect(goHome).toHaveBeenCalledTimes(1);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });
    expect(mockGetAuthSession).toHaveBeenCalledTimes(1);
  });
});
