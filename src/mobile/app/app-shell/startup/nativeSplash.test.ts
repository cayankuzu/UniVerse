describe("nativeSplash", () => {
  it("pins the native splash until the app is ready", () => {
    const splashModule = jest.requireMock("expo-splash-screen") as {
      preventAutoHideAsync: jest.Mock;
      setOptions: jest.Mock;
    };

    splashModule.preventAutoHideAsync.mockClear();
    splashModule.setOptions.mockClear();

    jest.isolateModules(() => {
      require("./nativeSplash");
    });

    expect(splashModule.setOptions).toHaveBeenCalledWith({
      duration: 180,
      fade: true,
    });
    expect(splashModule.preventAutoHideAsync).toHaveBeenCalledTimes(1);
  });
});
