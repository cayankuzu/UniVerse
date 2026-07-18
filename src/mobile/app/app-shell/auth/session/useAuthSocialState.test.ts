import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook } from "@testing-library/react-native";
import { useAuthSocialState } from "./useAuthSocialState";

const mockGetBlockedUsers = jest.fn();
const mockGetSession = jest.fn();
const mockGetUser = jest.fn();
const mockBlock = jest.fn();
const mockLogError = jest.fn();
const mockUnblock = jest.fn();

jest.mock("../../../data/projections/projections.shared", () => ({
  ProjectionAPI: {
    getBlockedUsers: (...args: unknown[]) => mockGetBlockedUsers(...args),
  },
}));

jest.mock("../../../data/social", () => ({
  BlockAPI: {
    block: (...args: unknown[]) => mockBlock(...args),
    unblock: (...args: unknown[]) => mockUnblock(...args),
  },
}));

jest.mock("../../../platform/supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
  },
}));

jest.mock("../../../platform/observability", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}));

describe("useAuthSocialState", () => {
  beforeEach(() => {
    void AsyncStorage.clear();
    mockGetBlockedUsers.mockReset();
    mockGetSession.mockReset();
    mockGetUser.mockReset();
    mockBlock.mockReset();
    mockLogError.mockReset();
    mockUnblock.mockReset();
    jest.useRealTimers();
  });

  it("keeps the last blocked user list when the refresh request fails", async () => {
    let blockedUsers = ["alice"];
    const blockedUsersRef = { current: blockedUsers };
    const setBlockedUsers = jest.fn((updater: React.SetStateAction<string[]>) => {
      blockedUsers = typeof updater === "function" ? updater(blockedUsers) : updater;
      blockedUsersRef.current = blockedUsers;
    });

    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "viewer-id",
            user_metadata: {
              username: "viewer",
            },
          },
        },
      },
    });
    mockGetBlockedUsers.mockRejectedValue(new Error("projection-unavailable"));

    const { result } = renderHook(() =>
      useAuthSocialState({
        blockedUsersRef,
        isDemoRef: { current: false },
        setBlockedUsers: setBlockedUsers as React.Dispatch<React.SetStateAction<string[]>>,
      }),
    );

    await act(async () => {
      await result.current.refreshBlocked();
    });

    expect(blockedUsers).toEqual(["alice"]);
    expect(mockLogError).toHaveBeenCalledTimes(1);
  });

  it("reuses the blocked-users snapshot during the freshness window", async () => {
    let blockedUsers: string[] = [];
    const blockedUsersRef = { current: blockedUsers };
    const setBlockedUsers = jest.fn((updater: React.SetStateAction<string[]>) => {
      blockedUsers = typeof updater === "function" ? updater(blockedUsers) : updater;
      blockedUsersRef.current = blockedUsers;
    });
    const nowSpy = jest.spyOn(Date, "now");

    try {
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            user: {
              id: "viewer-id",
              user_metadata: {
                username: "viewer",
              },
            },
          },
        },
      });
      mockGetBlockedUsers.mockResolvedValue({
        items: [{ id: "blocked-1", username: "alice" }],
      });

      const { result } = renderHook(() =>
        useAuthSocialState({
          blockedUsersRef,
          isDemoRef: { current: false },
          setBlockedUsers: setBlockedUsers as React.Dispatch<React.SetStateAction<string[]>>,
        }),
      );

      nowSpy.mockReturnValue(31_000);
      await act(async () => {
        await result.current.refreshBlocked();
      });

      nowSpy.mockReturnValue(45_000);
      await act(async () => {
        await result.current.refreshBlocked();
      });

      expect(blockedUsers).toEqual(["alice"]);
      expect(mockGetBlockedUsers).toHaveBeenCalledTimes(1);

      nowSpy.mockReturnValue(331_000);
      await act(async () => {
        await result.current.refreshBlocked();
      });

      expect(mockGetBlockedUsers).toHaveBeenCalledTimes(2);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("applies blocked usernames optimistically and keeps them when the mutation succeeds", async () => {
    let blockedUsers: string[] = [];
    const blockedUsersRef = { current: blockedUsers };
    const setBlockedUsers = jest.fn((updater: React.SetStateAction<string[]>) => {
      blockedUsers = typeof updater === "function" ? updater(blockedUsers) : updater;
      blockedUsersRef.current = blockedUsers;
    });

    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "viewer-id",
            user_metadata: {
              username: "viewer",
            },
          },
        },
      },
    });
    mockBlock.mockResolvedValue({ blocked: true });

    const { result } = renderHook(() =>
      useAuthSocialState({
        blockedUsersRef,
        isDemoRef: { current: false },
        setBlockedUsers: setBlockedUsers as React.Dispatch<React.SetStateAction<string[]>>,
      }),
    );

    await act(async () => {
      await result.current.blockUser("alice", { targetUserId: "user-1" });
    });

    expect(blockedUsers).toEqual(["alice"]);
    expect(mockBlock).toHaveBeenCalledWith("alice", {
      clientMutationId: expect.stringContaining("block-toggle"),
      targetUserId: "user-1",
    });
  });

  it("rolls optimistic blocked usernames back when block fails", async () => {
    let blockedUsers = ["existing"];
    const blockedUsersRef = { current: blockedUsers };
    const setBlockedUsers = jest.fn((updater: React.SetStateAction<string[]>) => {
      blockedUsers = typeof updater === "function" ? updater(blockedUsers) : updater;
      blockedUsersRef.current = blockedUsers;
    });

    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "viewer-id",
            user_metadata: {
              username: "viewer",
            },
          },
        },
      },
    });
    mockBlock.mockRejectedValue(new Error("mutation-failed"));

    const { result } = renderHook(() =>
      useAuthSocialState({
        blockedUsersRef,
        isDemoRef: { current: false },
        setBlockedUsers: setBlockedUsers as React.Dispatch<React.SetStateAction<string[]>>,
      }),
    );

    await expect(
      act(async () => {
        await result.current.blockUser("alice", { targetUserId: "user-1" });
      }),
    ).rejects.toThrow("mutation-failed");

    expect(blockedUsers).toEqual(["existing"]);
  });
});
