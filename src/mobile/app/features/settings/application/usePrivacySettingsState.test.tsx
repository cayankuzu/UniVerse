import { Alert } from "react-native";
import { act, renderHook } from "@testing-library/react-native";
import { usePrivacySettingsState } from "./usePrivacySettingsState";

const mockUpdateViewerPrivacySetting = jest.fn();
const mockUpdateViewerProfileSetting = jest.fn();
const mockApplyHideEmailCacheUpdate = jest.fn();
const mockApplyPrivacyCacheUpdate = jest.fn();
const mockRefreshPrivacyCaches = jest.fn();
const mockScheduleAfterInteractions = jest.fn((callback: () => void) => {
  callback();
  return { cancel: jest.fn() };
});

jest.mock("../data", () => ({
  updateViewerPrivacySetting: (...args: unknown[]) => mockUpdateViewerPrivacySetting(...args),
  updateViewerProfileSetting: (...args: unknown[]) => mockUpdateViewerProfileSetting(...args),
}));

jest.mock("./usePrivacySettingsCacheActions", () => ({
  usePrivacySettingsCacheActions: () => ({
    applyHideEmailCacheUpdate: mockApplyHideEmailCacheUpdate,
    applyPrivacyCacheUpdate: mockApplyPrivacyCacheUpdate,
    refreshPrivacyCaches: mockRefreshPrivacyCaches,
  }),
}));

jest.mock("../../../shared/utils/scheduleAfterInteractions", () => ({
  scheduleAfterInteractions: (...args: unknown[]) =>
    mockScheduleAfterInteractions(...(args as Parameters<typeof mockScheduleAfterInteractions>)),
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

describe("usePrivacySettingsState", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function renderPrivacyState(isPrivateAccount = false) {
    return renderHook(() =>
      usePrivacySettingsState({
        accountType: "student",
        goBack: jest.fn(),
        isPrivateAccount,
        setIsPrivateAccount: jest.fn(),
        updateUserData: jest.fn(),
        userData: {
          categories: [],
          coverImage: "",
          email: "viewer@example.com",
          events: 0,
          followers: 0,
          following: 0,
          hideEmail: false,
          id: "viewer-1",
          isPrivate: isPrivateAccount,
          profileImage: "",
          university: "UniVerse",
          username: "viewer",
        },
      }),
    );
  }

  it("updates privacy immediately before the network request resolves", () => {
    const deferred = createDeferred<{ isPrivate: boolean }>();
    mockUpdateViewerPrivacySetting.mockReturnValue(deferred.promise);

    const { result } = renderPrivacyState(false);

    act(() => {
      result.current.handleTogglePrivacy();
    });

    expect(result.current.isPrivateAccount).toBe(true);
    expect(result.current.savingPrivacy).toBe(true);
    expect(mockApplyPrivacyCacheUpdate).toHaveBeenLastCalledWith(true);
  });

  it("collapses repeated taps to the final desired privacy state", async () => {
    const firstRequest = createDeferred<{ isPrivate: boolean }>();
    mockUpdateViewerPrivacySetting
      .mockReturnValueOnce(firstRequest.promise)
      .mockResolvedValueOnce({ isPrivate: false });

    const { result } = renderPrivacyState(false);

    act(() => {
      result.current.handleTogglePrivacy();
      result.current.handleTogglePrivacy();
    });

    expect(result.current.isPrivateAccount).toBe(false);
    expect(mockUpdateViewerPrivacySetting).toHaveBeenCalledTimes(1);
    expect(mockUpdateViewerPrivacySetting).toHaveBeenNthCalledWith(1, true);

    await act(async () => {
      firstRequest.resolve({ isPrivate: true });
      await firstRequest.promise;
      await Promise.resolve();
    });

    expect(mockUpdateViewerPrivacySetting).toHaveBeenCalledTimes(2);
    expect(mockUpdateViewerPrivacySetting).toHaveBeenNthCalledWith(2, false);
    expect(result.current.isPrivateAccount).toBe(false);
    expect(mockRefreshPrivacyCaches).toHaveBeenCalled();
  });

  it("rolls privacy back when the mutation fails", async () => {
    const deferred = createDeferred<{ isPrivate: boolean }>();
    mockUpdateViewerPrivacySetting.mockReturnValue(deferred.promise);

    const { result } = renderPrivacyState(false);

    act(() => {
      result.current.handleTogglePrivacy();
    });

    expect(result.current.isPrivateAccount).toBe(true);

    await act(async () => {
      deferred.reject(new Error("boom"));
      try {
        await deferred.promise;
      } catch {
        // Expected rejection drives the rollback assertion below.
      }
      await Promise.resolve();
    });

    expect(result.current.isPrivateAccount).toBe(false);
    expect(mockApplyPrivacyCacheUpdate).toHaveBeenLastCalledWith(false);
    expect(Alert.alert).toHaveBeenCalledWith("Hata", "boom");
  });

  it("optimistically updates hidden-email state and rolls it back on failure", async () => {
    const updateUserData = jest.fn();
    mockUpdateViewerProfileSetting.mockRejectedValueOnce(new Error("save failed"));
    const { result } = renderHook(() =>
      usePrivacySettingsState({
        accountType: "student",
        goBack: jest.fn(),
        isPrivateAccount: false,
        setIsPrivateAccount: jest.fn(),
        updateUserData,
        userData: {
          categories: [],
          coverImage: "",
          email: "viewer@example.com",
          events: 0,
          followers: 0,
          following: 0,
          hideEmail: false,
          id: "viewer-1",
          isPrivate: false,
          profileImage: "",
          university: "UniVerse",
          username: "viewer",
        },
      }),
    );

    await act(async () => {
      await result.current.handleHideEmailToggle();
    });

    expect(updateUserData).toHaveBeenNthCalledWith(1, { hideEmail: true });
    expect(updateUserData).toHaveBeenLastCalledWith({ hideEmail: false });
    expect(mockApplyHideEmailCacheUpdate).toHaveBeenLastCalledWith(false);
    expect(Alert.alert).toHaveBeenCalled();
  });
});
