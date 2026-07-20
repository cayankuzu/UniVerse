import { act, renderHook } from "@testing-library/react-native";
import { useScreenRefresh } from "../../../data/projections/screen/useScreenRefresh";
import { getOwnProfileContentQueryDef } from "../data";
import { useOwnProfileOverviewState } from "./useOwnProfileOverviewState";
import { useOwnProfileProjectionState } from "./useOwnProfileProjectionState";
import { useProfileBootstrapState } from "./useProfileBootstrapState";
import { useProfileContentProjections } from "./useProfileContentProjections";
import { useProfileProjectionContentState } from "./useProfileProjectionContentState";

jest.mock("../../../data/projections/screen/useScreenRefresh", () => ({
  useScreenRefresh: jest.fn(),
}));
jest.mock("../data", () => ({ getOwnProfileContentQueryDef: jest.fn() }));
jest.mock("./useOwnProfileOverviewState", () => ({ useOwnProfileOverviewState: jest.fn() }));
jest.mock("./useProfileBootstrapState", () => ({ useProfileBootstrapState: jest.fn() }));
jest.mock("./useProfileContentProjections", () => ({ useProfileContentProjections: jest.fn() }));
jest.mock("./useProfileProjectionContentState", () => ({
  useProfileProjectionContentState: jest.fn(),
}));

const mockedRefresh = useScreenRefresh as jest.MockedFunction<typeof useScreenRefresh>;
const mockedOverview = useOwnProfileOverviewState as jest.MockedFunction<
  typeof useOwnProfileOverviewState
>;
const mockedBootstrap = useProfileBootstrapState as jest.MockedFunction<
  typeof useProfileBootstrapState
>;
const mockedProjections = useProfileContentProjections as jest.MockedFunction<
  typeof useProfileContentProjections
>;

describe("useOwnProfileProjectionState", () => {
  const overviewRefetch = jest.fn();
  const albumRefresh = jest.fn();
  const eventRefresh = jest.fn();
  let refreshOptions: any;

  beforeEach(() => {
    jest.clearAllMocks();
    refreshOptions = null;
    (getOwnProfileContentQueryDef as jest.Mock).mockImplementation(({ tab }) => ({ tab }));
    mockedBootstrap.mockReturnValue({ isBootstrapping: false } as any);
    mockedOverview.mockReturnValue({
      overviewQuery: { isFetching: false, refetch: overviewRefetch },
      resolvedAccountType: "student",
      resolvedProfile: { id: "viewer-1" },
      resolvedUserData: { id: "viewer-1" },
    } as any);
    mockedProjections.mockReturnValue({
      activeProjection: { loadingMore: true },
      albumProjection: { items: [{ id: "album-1" }], onRefresh: albumRefresh, refreshing: true },
      eventProjection: { items: [{ id: "event-1" }], onRefresh: eventRefresh, refreshing: false },
    } as any);
    (useProfileProjectionContentState as jest.Mock).mockReturnValue({
      sourceAlbums: [{ id: "album-1" }],
      sourceEvents: [{ id: "event-1" }],
    });
    mockedRefresh.mockImplementation((options) => {
      refreshOptions = options;
      return jest.fn();
    });
  });

  it("composes both profile projections and refresh tasks", () => {
    const { result } = renderHook(() =>
      useOwnProfileProjectionState({
        accountType: "student",
        contentTab: "album",
        profileTab: "album",
        profileUsername: "viewer",
        userData: { id: "viewer-1" } as any,
        viewerKey: "viewer-1",
      }),
    );

    expect(result.current.loadingMore).toBe(true);
    expect(result.current.refreshing).toBe(true);
    expect(result.current.sourceAlbums).toEqual([{ id: "album-1" }]);
    act(() => refreshOptions.tasks.forEach((task: any) => task.run()));
    expect(overviewRefetch).toHaveBeenCalled();
    expect(albumRefresh).toHaveBeenCalled();
    expect(eventRefresh).toHaveBeenCalled();
  });

  it("keeps content requests paused while bootstrap is active", () => {
    mockedBootstrap.mockReturnValue({ isBootstrapping: true } as any);
    mockedOverview.mockReturnValue({
      overviewQuery: { isFetching: true, refetch: overviewRefetch },
      resolvedAccountType: "student",
      resolvedProfile: null,
      resolvedUserData: { id: "viewer-1" },
    } as any);

    const { result } = renderHook(() =>
      useOwnProfileProjectionState({
        accountType: "student",
        contentTab: "events",
        profileTab: "events",
        profileUsername: "",
        userData: { id: "viewer-1" } as any,
        viewerKey: "viewer-1",
      }),
    );

    expect(result.current.refreshing).toBe(true);
    act(() => refreshOptions.tasks.slice(1).forEach((task: any) => task.run()));
    expect(albumRefresh).not.toHaveBeenCalled();
    expect(eventRefresh).not.toHaveBeenCalled();
  });
});
