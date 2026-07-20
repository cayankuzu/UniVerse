import { renderHook } from "@testing-library/react-native";
import { useProfileContentProjections } from "./useProfileContentProjections";

type ProjectionParams = { entity: string; queryKey: readonly unknown[] };

const mockUseProjectionScreen = jest.fn((params: ProjectionParams) => ({
  items: [{ id: params.entity }],
  query: { isFetching: false },
}));

jest.mock("../../../data/projections/screen/useProjectionScreen", () => ({
  useProjectionScreen: (params: ProjectionParams) => mockUseProjectionScreen(params),
}));

const albumDef = {
  entity: "profile-albums",
  fetchProjection: jest.fn(),
  queryKey: ["profile", "albums"],
};
const eventDef = {
  entity: "profile-events",
  fetchProjection: jest.fn(),
  queryKey: ["profile", "events"],
};

describe("useProfileContentProjections", () => {
  beforeEach(() => mockUseProjectionScreen.mockClear());

  it("keeps both projection hooks mounted while the selected tab changes", () => {
    let tab: "album" | "events" = "album";
    const { rerender, result } = renderHook(() =>
      useProfileContentProjections({ albumDef, enabled: true, eventDef, tab }),
    );

    expect(mockUseProjectionScreen).toHaveBeenCalledTimes(2);
    expect(result.current.activeProjection.items).toEqual([{ id: "profile-albums" }]);

    tab = "events";
    rerender({});

    expect(result.current.activeProjection.items).toEqual([{ id: "profile-events" }]);
    expect(mockUseProjectionScreen.mock.calls.slice(-2).map((call) => call[0].queryKey)).toEqual([
      albumDef.queryKey,
      eventDef.queryKey,
    ]);
  });
});
