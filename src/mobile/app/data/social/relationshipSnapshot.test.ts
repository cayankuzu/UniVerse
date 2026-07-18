import { debugLog } from "../../platform/logging/logger";
import { getViewerRelationshipSnapshot } from "./relationshipSnapshot";

const mockResolveProfileIdByUsername = jest.fn();
const mockRpc = jest.fn();
const mockFrom = jest.fn();

jest.mock("../profile/profileLookup", () => ({
  resolveProfileIdByUsername: (...args: unknown[]) => mockResolveProfileIdByUsername(...args),
}));

jest.mock("../../platform/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

jest.mock("../../platform/logging/logger", () => ({
  debugLog: jest.fn(),
}));

describe("getViewerRelationshipSnapshot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("falls back to direct Supabase reads when rpc support is unavailable", async () => {
    mockResolveProfileIdByUsername.mockResolvedValue("viewer-id");
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        message:
          "Could not find the function public.relationship_snapshot_projection(viewer_id, viewer_username) in the schema cache",
      },
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === "follows") {
        return {
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockResolvedValue({
            data: [{ following_id: "club-1" }, { following_id: "student-1" }],
            error: null,
          }),
          select: jest.fn().mockReturnThis(),
        };
      }
      if (table === "profiles") {
        return {
          in: jest.fn().mockReturnThis(),
          is: jest.fn().mockResolvedValue({
            data: [
              {
                account_type: "club",
                is_private: false,
                user_id: "club-1",
                username: "robot-kulup",
              },
              {
                account_type: "student",
                is_private: true,
                user_id: "student-1",
                username: "ogrenci",
              },
            ],
            error: null,
          }),
          select: jest.fn().mockReturnThis(),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(
      getViewerRelationshipSnapshot({
        viewerUsername: "viewer",
      }),
    ).resolves.toMatchObject({
      followingClubUsernames: ["robot-kulup"],
      followingStudentUsernames: ["ogrenci"],
      followingUsernames: ["robot-kulup", "ogrenci"],
      viewerUsername: "viewer",
    });
    expect(mockResolveProfileIdByUsername).toHaveBeenCalledWith("viewer");
    expect(mockFrom).toHaveBeenCalledWith("follows");
    expect(mockFrom).toHaveBeenCalledWith("profiles");
    expect(debugLog).not.toHaveBeenCalled();
  });
});
