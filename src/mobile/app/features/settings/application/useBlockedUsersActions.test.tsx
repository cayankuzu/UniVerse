import { act, renderHook } from "@testing-library/react-native";
import { showErrorAlert } from "../../../shared/utils/alerts";
import { useBlockedUsersActions } from "./useBlockedUsersActions";

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({}),
}));
jest.mock("../../../data/profile/profileProjectionKeys", () => ({
  getProfileSurfaceProjectionKeys: jest.fn(() => []),
}));
jest.mock("../../../data/projections/projectionKeys", () => ({
  projectionKeys: { screen: jest.fn(() => ["screen"]) },
}));
jest.mock("../../../data/projections/projectionRefresh", () => ({
  replaceProjectionScope: jest.fn(),
}));
jest.mock("../../../data/social", () => ({
  applyBlockedClientIsolation: jest.fn(),
}));
jest.mock("../data", () => ({
  removeBlockedUserFromSettingsProjection: jest.fn(),
  reportBlockedUser: jest.fn(),
}));
jest.mock("../../../shared/utils/alerts", () => ({
  showErrorAlert: jest.fn(),
}));

const mockShowErrorAlert = showErrorAlert as jest.Mock;

describe("useBlockedUsersActions", () => {
  it("restores the projection and shows the mutation error when unblocking fails", async () => {
    const onRestoreProjection = jest.fn(async () => undefined);
    const unblockUser = jest.fn(async () => {
      throw new Error("Engel kaldırılamadı");
    });
    const { result } = renderHook(() =>
      useBlockedUsersActions({
        blockedData: [
          { accountType: "student", userId: "blocked-id", username: "blocked" } as never,
        ],
        onRestoreProjection,
        unblockUser,
        viewerKey: "viewer-key",
        viewerUsername: "viewer",
      }),
    );

    await act(async () => {
      await expect(result.current.handleUnblock("blocked")).resolves.toBe(false);
    });

    expect(onRestoreProjection).toHaveBeenCalled();
    expect(mockShowErrorAlert).toHaveBeenCalledWith("Engel kaldırılamadı");
  });
});
