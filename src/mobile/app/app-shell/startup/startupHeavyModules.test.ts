const mockExpoVideoLoaded = jest.fn();
const mockImagePickerLoaded = jest.fn();
const mockMediaLibraryLoaded = jest.fn();
const mockFileSystemLoaded = jest.fn();
const mockAuthNavigatorLoaded = jest.fn();
const mockMainTabsNavigatorLoaded = jest.fn();
const mockAuthScreensLoaded = jest.fn();
const mockEventScreensLoaded = jest.fn();

jest.mock("expo-video", () => {
  mockExpoVideoLoaded();
  return {};
});

jest.mock("expo-image-picker", () => {
  mockImagePickerLoaded();
  return {};
});

jest.mock("expo-media-library", () => {
  mockMediaLibraryLoaded();
  return {};
});

jest.mock("expo-file-system/legacy", () => {
  mockFileSystemLoaded();
  return {};
});

jest.mock("../navigation/navigators/AuthNavigator", () => {
  mockAuthNavigatorLoaded();
  return {};
});

jest.mock("../navigation/navigators/MainTabsNavigator", () => {
  mockMainTabsNavigatorLoaded();
  return {};
});

jest.mock("../../features/auth/public/screens", () => {
  mockAuthScreensLoaded();
  return {};
});

jest.mock("../../features/events/public/screens", () => {
  mockEventScreensLoaded();
  return {};
});

describe("first-fold media dependency graph", () => {
  beforeEach(() => {
    jest.resetModules();
    mockExpoVideoLoaded.mockClear();
    mockFileSystemLoaded.mockClear();
    mockAuthNavigatorLoaded.mockClear();
    mockMainTabsNavigatorLoaded.mockClear();
    mockAuthScreensLoaded.mockClear();
    mockEventScreensLoaded.mockClear();
    mockImagePickerLoaded.mockClear();
    mockMediaLibraryLoaded.mockClear();
  });

  it("loads Home feed card modules without evaluating picker, player, or gallery natives", () => {
    require("../../features/content-cards/ui/feed/DeferredAlbumFeedCard");
    require("../../features/content-cards/ui/homeEventCard/DeferredHomeEventCard");

    expect(mockExpoVideoLoaded).not.toHaveBeenCalled();
    expect(mockImagePickerLoaded).not.toHaveBeenCalled();
    expect(mockMediaLibraryLoaded).not.toHaveBeenCalled();
    expect(mockFileSystemLoaded).not.toHaveBeenCalled();
  });

  it("builds the root route registry without evaluating either shell or secondary screens", () => {
    require("../navigation/rootNavigationScreens");

    expect(mockAuthNavigatorLoaded).not.toHaveBeenCalled();
    expect(mockMainTabsNavigatorLoaded).not.toHaveBeenCalled();
    expect(mockAuthScreensLoaded).not.toHaveBeenCalled();
    expect(mockEventScreensLoaded).not.toHaveBeenCalled();
  });
});
