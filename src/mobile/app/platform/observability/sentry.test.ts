const mockInit = jest.fn();
const mockMobileReplayIntegration = jest.fn();
const mockReactNavigationIntegration = jest.fn();
const mockReactNativeTracingIntegration = jest.fn();
const mockSetTags = jest.fn();

describe("sentry replay setup", () => {
  beforeEach(() => {
    jest.resetModules();
    mockInit.mockReset();
    mockMobileReplayIntegration.mockReset();
    mockReactNavigationIntegration.mockReset();
    mockReactNativeTracingIntegration.mockReset();
    mockSetTags.mockReset();
  });

  it("enables privacy-safe mobile replay with env-driven sampling", () => {
    jest.doMock("react-native", () => ({
      Platform: { OS: "android" },
    }));

    jest.doMock("@sentry/react-native", () => ({
      __esModule: true,
      captureMessage: jest.fn(),
      init: (...args: unknown[]) => mockInit(...args),
      mobileReplayIntegration: (...args: unknown[]) => {
        mockMobileReplayIntegration(...args);
        return {
          getReplayId: () => null,
          name: "MobileReplay",
          options: args[0],
        };
      },
      reactNativeTracingIntegration: (...args: unknown[]) => {
        mockReactNativeTracingIntegration(...args);
        return { name: "ReactNativeTracing" };
      },
      reactNavigationIntegration: (...args: unknown[]) => {
        mockReactNavigationIntegration(...args);
        return {
          name: "ReactNavigation",
          registerNavigationContainer: jest.fn(),
        };
      },
      setContext: jest.fn(),
      setTag: jest.fn(),
      setTags: (...args: unknown[]) => mockSetTags(...args),
      setUser: jest.fn(),
      wrap: <T>(Component: T) => Component,
    }));

    jest.doMock("./config", () => ({
      appReleaseMeta: {
        appEnv: "preview",
        appVersion: "1.0.0",
        releaseChannel: "preview",
        releaseName: "ogrencisosyalagi@1.0.0:preview",
        runtimeVersion: "1.0.0",
        sentryDsn: "https://dsn.example/123",
      },
      crashReporterConfig: {
        dist: "1.0.0",
        dsn: "https://dsn.example/123",
        enabled: true,
        environment: "preview",
        profilesSampleRate: 1,
        release: "ogrencisosyalagi@1.0.0:preview",
        replaysOnErrorSampleRate: 1,
        replaysSessionQuality: "high",
        replaysSessionSampleRate: 1,
        tracesSampleRate: 1,
      },
    }));

    const { initializeCrashReporter } = require("./sentry");
    initializeCrashReporter();

    expect(mockMobileReplayIntegration).toHaveBeenCalledWith({
      enableViewRendererV2: true,
      maskAllImages: true,
      maskAllText: true,
      maskAllVectors: true,
      screenshotStrategy: "pixelCopy",
    });
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        replaysOnErrorSampleRate: 1,
        replaysSessionQuality: "high",
        replaysSessionSampleRate: 1,
      }),
    );
    expect(mockInit.mock.calls[0][0].integrations).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "MobileReplay" })]),
    );
    expect(mockSetTags).toHaveBeenCalledWith(
      expect.objectContaining({
        app_env: "preview",
        release_channel: "preview",
        runtime_version: "1.0.0",
      }),
    );
  });

  it("disables mobile replay in development even when sampling is configured", () => {
    jest.doMock("react-native", () => ({
      Platform: { OS: "android" },
    }));

    jest.doMock("@sentry/react-native", () => ({
      __esModule: true,
      captureMessage: jest.fn(),
      init: (...args: unknown[]) => mockInit(...args),
      mobileReplayIntegration: (...args: unknown[]) => {
        mockMobileReplayIntegration(...args);
        return {
          getReplayId: () => null,
          name: "MobileReplay",
          options: args[0],
        };
      },
      reactNativeTracingIntegration: (...args: unknown[]) => {
        mockReactNativeTracingIntegration(...args);
        return { name: "ReactNativeTracing" };
      },
      reactNavigationIntegration: (...args: unknown[]) => {
        mockReactNavigationIntegration(...args);
        return {
          name: "ReactNavigation",
          registerNavigationContainer: jest.fn(),
        };
      },
      setContext: jest.fn(),
      setTag: jest.fn(),
      setTags: (...args: unknown[]) => mockSetTags(...args),
      setUser: jest.fn(),
      wrap: <T>(Component: T) => Component,
    }));

    jest.doMock("./config", () => ({
      appReleaseMeta: {
        appEnv: "development",
        appVersion: "1.0.0",
        releaseChannel: "development",
        releaseName: "ogrencisosyalagi@1.0.0:development",
        runtimeVersion: "1.0.0",
        sentryDsn: "https://dsn.example/123",
      },
      crashReporterConfig: {
        dist: "1.0.0",
        dsn: "https://dsn.example/123",
        enabled: true,
        environment: "development",
        profilesSampleRate: 1,
        release: "ogrencisosyalagi@1.0.0:development",
        replaysOnErrorSampleRate: 1,
        replaysSessionQuality: "high",
        replaysSessionSampleRate: 1,
        tracesSampleRate: 1,
      },
    }));

    const { initializeCrashReporter } = require("./sentry");
    initializeCrashReporter();

    expect(mockMobileReplayIntegration).not.toHaveBeenCalled();
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        replaysOnErrorSampleRate: 0,
        replaysSessionSampleRate: 0,
      }),
    );
    expect(mockInit.mock.calls[0][0].integrations).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "MobileReplay" })]),
    );
  });
});
