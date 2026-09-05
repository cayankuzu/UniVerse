import { renderHook } from "@testing-library/react-native";
import { AccessibilityInfo, Platform } from "react-native";
import { useLiveRegionAnnouncement } from "./useLiveRegionAnnouncement";

// The React Native preset already replaces AccessibilityInfo with mocks, so a
// spy here would wrap that shared mock and inherit its call history.
const announce = AccessibilityInfo.announceForAccessibility as jest.Mock;
const mutablePlatform = Platform as { OS: string };

describe("useLiveRegionAnnouncement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mutablePlatform.OS = "ios";
  });

  afterEach(() => {
    mutablePlatform.OS = "ios";
  });

  it("announces a message on iOS, where accessibilityLiveRegion does nothing", () => {
    renderHook(() => useLiveRegionAnnouncement("Bağlantı yok"));

    expect(announce).toHaveBeenCalledWith("Bağlantı yok");
  });

  it("stays silent on Android, where the live region already speaks", () => {
    mutablePlatform.OS = "android";
    renderHook(() => useLiveRegionAnnouncement("Bağlantı yok"));

    expect(announce).not.toHaveBeenCalled();
  });

  it("does not repeat an unchanged message across re-renders", () => {
    const { rerender } = renderHook(
      ({ message }: { message: string }) => useLiveRegionAnnouncement(message),
      { initialProps: { message: "Yükleniyor" } },
    );

    rerender({ message: "Yükleniyor" });
    rerender({ message: "Yükleniyor" });

    expect(announce).toHaveBeenCalledTimes(1);
  });

  it("announces again once the message actually changes", () => {
    const { rerender } = renderHook(
      ({ message }: { message: string }) => useLiveRegionAnnouncement(message),
      { initialProps: { message: "Yükleniyor" } },
    );

    rerender({ message: "İşlem başarısız" });

    expect(announce).toHaveBeenNthCalledWith(1, "Yükleniyor");
    expect(announce).toHaveBeenNthCalledWith(2, "İşlem başarısız");
  });

  it("says nothing for an empty or cleared message", () => {
    const { rerender } = renderHook(
      ({ message }: { message: string | null }) => useLiveRegionAnnouncement(message),
      { initialProps: { message: "   " as string | null } },
    );

    rerender({ message: null });

    expect(announce).not.toHaveBeenCalled();
  });

  it("re-announces a message that returns after being cleared", () => {
    const { rerender } = renderHook(
      ({ message }: { message: string | null }) => useLiveRegionAnnouncement(message),
      { initialProps: { message: "Bağlantı yok" as string | null } },
    );

    rerender({ message: null });
    rerender({ message: "Bağlantı yok" });

    expect(announce).toHaveBeenCalledTimes(2);
  });
});
