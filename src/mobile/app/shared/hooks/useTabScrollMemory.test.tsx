import { act, renderHook } from "@testing-library/react-native";
import { useTabScrollMemory } from "./useTabScrollMemory";

describe("useTabScrollMemory", () => {
  it("keeps an independent offset for every tab", () => {
    const albumHandle = { scrollToOffset: jest.fn() };
    const remountedAlbumHandle = { scrollToOffset: jest.fn() };
    const eventHandle = { scrollToOffset: jest.fn() };
    const { result } = renderHook(() => useTabScrollMemory<"album" | "events">());

    const albumRef = result.current.getTabScrollRefCallback("album");
    const eventRef = result.current.getTabScrollRefCallback("events");
    expect(result.current.getTabScrollRefCallback("album")).toBe(albumRef);

    act(() => {
      albumRef?.(albumHandle);
      eventRef?.(eventHandle);
      result.current.recordTabScrollOffset("album", 320);
    });

    expect(eventHandle.scrollToOffset).not.toHaveBeenCalled();

    act(() => {
      albumRef?.(null);
      albumRef?.(remountedAlbumHandle);
    });

    expect(remountedAlbumHandle.scrollToOffset).toHaveBeenCalledWith({
      animated: false,
      offset: 320,
    });
    expect(result.current.getTabScrollRef("events")).toBe(eventHandle);
  });

  it("normalizes invalid offsets without moving another tab", () => {
    const albumHandle = { scrollToOffset: jest.fn() };
    const eventHandle = { scrollToOffset: jest.fn() };
    const { result } = renderHook(() => useTabScrollMemory<"album" | "events">());

    act(() => {
      result.current.recordTabScrollOffset("album", Number.NaN);
      result.current.recordTabScrollOffset("events", -40);
      result.current.getTabScrollRefCallback("album")?.(albumHandle);
      result.current.getTabScrollRefCallback("events")?.(eventHandle);
    });

    expect(albumHandle.scrollToOffset).not.toHaveBeenCalled();
    expect(eventHandle.scrollToOffset).not.toHaveBeenCalled();
  });

  it("can force-restore a tab to its saved offset or the top before activation", () => {
    const albumHandle = { scrollToOffset: jest.fn() };
    const eventHandle = { scrollToOffset: jest.fn() };
    const { result } = renderHook(() => useTabScrollMemory<"album" | "events">());

    act(() => {
      result.current.getTabScrollRefCallback("album")?.(albumHandle);
      result.current.getTabScrollRefCallback("events")?.(eventHandle);
      result.current.recordTabScrollOffset("album", 280);
      result.current.restoreTabScrollOffset("events");
      result.current.restoreTabScrollOffset("album");
    });

    expect(eventHandle.scrollToOffset).toHaveBeenCalledWith({ animated: false, offset: 0 });
    expect(albumHandle.scrollToOffset).toHaveBeenCalledWith({ animated: false, offset: 280 });
  });
});
