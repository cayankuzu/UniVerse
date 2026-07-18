import { getUiScreenState, resetUiViewStateStore, useUiViewStateStore } from "./uiViewState";

describe("uiViewState", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    resetUiViewStateStore();
  });

  it("avoids redundant updates after content is already rendered", () => {
    const screenKey = "projection:profile";
    const nowSpy = jest.spyOn(Date, "now");

    nowSpy.mockReturnValue(100);
    useUiViewStateStore.getState().markContentRendered(screenKey);
    const firstRenderState = getUiScreenState(screenKey);

    nowSpy.mockReturnValue(200);
    useUiViewStateStore.getState().markContentRendered(screenKey);
    const secondRenderState = getUiScreenState(screenKey);

    expect(secondRenderState).toBe(firstRenderState);
    expect(secondRenderState.lastContentAt).toBe(100);
  });

  it("refreshes the render timestamp when new content is acknowledged", () => {
    const screenKey = "projection:home";
    const nowSpy = jest.spyOn(Date, "now");

    nowSpy.mockReturnValue(100);
    useUiViewStateStore.getState().markContentRendered(screenKey);
    const firstRenderState = getUiScreenState(screenKey);

    useUiViewStateStore.getState().markNewContentAvailable(screenKey);
    nowSpy.mockReturnValue(250);
    useUiViewStateStore.getState().markContentRendered(screenKey);
    const refreshedState = getUiScreenState(screenKey);

    expect(refreshedState).not.toBe(firstRenderState);
    expect(refreshedState.lastContentAt).toBe(250);
    expect(refreshedState.newContentAvailable).toBe(true);
  });

  it("acknowledges rendered content and clears pending new-content state in one update", () => {
    const screenKey = "projection:notifications";
    const nowSpy = jest.spyOn(Date, "now");

    nowSpy.mockReturnValue(100);
    useUiViewStateStore.getState().markContentRendered(screenKey);
    useUiViewStateStore.getState().markNewContentAvailable(screenKey);

    nowSpy.mockReturnValue(220);
    useUiViewStateStore.getState().acknowledgeContentRendered(screenKey);
    const acknowledgedState = getUiScreenState(screenKey);

    expect(acknowledgedState.lastContentAt).toBe(220);
    expect(acknowledgedState.newContentAvailable).toBe(false);
  });
});
