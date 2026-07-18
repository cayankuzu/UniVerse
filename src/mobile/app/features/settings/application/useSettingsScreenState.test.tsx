import { act, renderHook } from "@testing-library/react-native";
import { useSettingsScreenState } from "./useSettingsScreenState";

const mockShowConfirmAlert = jest.fn();

jest.mock("../../../shared/utils/alerts", () => ({
  showConfirmAlert: (...args: unknown[]) => mockShowConfirmAlert(...args),
}));

function createDeferred<T>() {
  let reject!: (error?: unknown) => void;
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}

describe("useSettingsScreenState", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("asks for confirmation before logout", () => {
    const { result } = renderHook(() =>
      useSettingsScreenState({
        accountType: "student",
        blockedUsersCount: 0,
        deleteAccount: jest.fn(),
        goBack: jest.fn(),
        logout: jest.fn().mockResolvedValue(undefined),
        resetToWelcome: jest.fn(),
      }),
    );

    act(() => {
      result.current.handleLogout();
    });

    expect(mockShowConfirmAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmLabel: "Çıkış Yap",
        title: "Çıkış Yap",
      }),
    );
  });

  it("shows pending logout state after the confirmation is accepted", async () => {
    const deferred = createDeferred<void>();
    const logout = jest.fn().mockReturnValue(deferred.promise);
    const resetToWelcome = jest.fn();
    const { result } = renderHook(() =>
      useSettingsScreenState({
        accountType: "student",
        blockedUsersCount: 0,
        deleteAccount: jest.fn(),
        goBack: jest.fn(),
        logout,
        resetToWelcome,
      }),
    );

    act(() => {
      result.current.handleLogout();
    });

    const confirmConfig = mockShowConfirmAlert.mock.calls[0]?.[0] as {
      onConfirm: () => void;
    };

    act(() => {
      confirmConfig.onConfirm();
    });

    expect(result.current.loggingOut).toBe(true);
    expect(
      result.current.sections
        .flatMap((section) => section.items)
        .find((item) => item.key === "logout"),
    ).toEqual(
      expect.objectContaining({
        disabled: true,
        subtitle: "Oturum kapatılıyor...",
      }),
    );

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });

    expect(logout).toHaveBeenCalledTimes(1);
    expect(resetToWelcome).toHaveBeenCalledTimes(1);
  });

  it("keeps delete account errors in retryable screen state", async () => {
    const deleteAccount = jest.fn().mockRejectedValue(new Error("Silme başarısız."));
    const { result } = renderHook(() =>
      useSettingsScreenState({
        accountType: "student",
        blockedUsersCount: 0,
        deleteAccount,
        goBack: jest.fn(),
        logout: jest.fn(),
        resetToWelcome: jest.fn(),
      }),
    );

    act(() => {
      result.current.showDeleteConfirmModal();
    });

    await act(async () => {
      await result.current.handleDeleteAccount();
    });

    expect(result.current.showDeleteConfirm).toBe(true);
    expect(result.current.deletingAccount).toBe(false);
    expect(result.current.operationError).toBe("Silme başarısız.");
  });
});
