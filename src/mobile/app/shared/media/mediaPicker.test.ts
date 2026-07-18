describe("mapLibraryAssetSelection", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("prefers the Android MediaStore content uri for runtime and preview access", () => {
    jest.doMock("react-native", () => ({
      Alert: { alert: jest.fn() },
      PermissionsAndroid: {
        PERMISSIONS: { RECORD_AUDIO: "RECORD_AUDIO" },
        RESULTS: { GRANTED: "granted" },
        request: jest.fn(),
      },
      Platform: { OS: "android" },
    }));
    jest.doMock("expo-image-picker", () => ({
      requestCameraPermissionsAsync: jest.fn(),
      requestMediaLibraryPermissionsAsync: jest.fn(),
    }));
    jest.doMock("expo-media-library", () => ({}));

    jest.isolateModules(() => {
      const { mapLibraryAssetSelection } =
        require("./mediaPicker") as typeof import("./mediaPicker");

      const selection = mapLibraryAssetSelection({
        duration: null,
        filename: "picker-image.jpg",
        id: "42",
        localUri: "file:///storage/emulated/0/DCIM/picker-image.jpg",
        mediaType: "photo",
        uri: "file:///storage/emulated/0/DCIM/picker-image.jpg",
      } as never);

      expect(selection.previewCandidates).toEqual([
        "content://media/external/images/media/42",
        "file:///storage/emulated/0/DCIM/picker-image.jpg",
      ]);
      expect(selection.previewUri).toBe("content://media/external/images/media/42");
      expect(selection.uri).toBe("content://media/external/images/media/42");
    });
  });

  it("keeps using the resolved local uri on ios", () => {
    jest.doMock("react-native", () => ({
      Alert: { alert: jest.fn() },
      PermissionsAndroid: {
        PERMISSIONS: { RECORD_AUDIO: "RECORD_AUDIO" },
        RESULTS: { GRANTED: "granted" },
        request: jest.fn(),
      },
      Platform: { OS: "ios" },
    }));
    jest.doMock("expo-image-picker", () => ({
      requestCameraPermissionsAsync: jest.fn(),
      requestMediaLibraryPermissionsAsync: jest.fn(),
    }));
    jest.doMock("expo-media-library", () => ({}));

    jest.isolateModules(() => {
      const { mapLibraryAssetSelection } =
        require("./mediaPicker") as typeof import("./mediaPicker");

      const selection = mapLibraryAssetSelection({
        duration: null,
        filename: "picker-image.jpg",
        id: "picker-image",
        localUri: "file:///var/mobile/Media/DCIM/picker-image.jpg",
        mediaType: "photo",
        uri: "ph://picker-image",
      } as never);

      expect(selection.previewCandidates).toEqual([
        "file:///var/mobile/Media/DCIM/picker-image.jpg",
        "ph://picker-image",
      ]);
      expect(selection.previewUri).toBe("file:///var/mobile/Media/DCIM/picker-image.jpg");
      expect(selection.uri).toBe("file:///var/mobile/Media/DCIM/picker-image.jpg");
    });
  });

  it("prefers the PHAsset uri for ios video previews while keeping the local runtime uri", () => {
    jest.doMock("react-native", () => ({
      Alert: { alert: jest.fn() },
      PermissionsAndroid: {
        PERMISSIONS: { RECORD_AUDIO: "RECORD_AUDIO" },
        RESULTS: { GRANTED: "granted" },
        request: jest.fn(),
      },
      Platform: { OS: "ios" },
    }));
    jest.doMock("expo-image-picker", () => ({
      requestCameraPermissionsAsync: jest.fn(),
      requestMediaLibraryPermissionsAsync: jest.fn(),
    }));
    jest.doMock("expo-media-library", () => ({}));

    jest.isolateModules(() => {
      const { mapLibraryAssetSelection } =
        require("./mediaPicker") as typeof import("./mediaPicker");

      const selection = mapLibraryAssetSelection({
        duration: 12,
        filename: "picker-video.mov",
        id: "picker-video",
        localUri: "file:///var/mobile/Media/DCIM/picker-video.mov",
        mediaType: "video",
        uri: "ph://picker-video",
      } as never);

      expect(selection.previewCandidates).toEqual([
        "ph://picker-video",
        "file:///var/mobile/Media/DCIM/picker-video.mov",
      ]);
      expect(selection.previewUri).toBe("ph://picker-video");
      expect(selection.uri).toBe("file:///var/mobile/Media/DCIM/picker-video.mov");
    });
  });

  it("prefers Android content uris when full asset info resolves them", () => {
    jest.doMock("react-native", () => ({
      Alert: { alert: jest.fn() },
      PermissionsAndroid: {
        PERMISSIONS: { RECORD_AUDIO: "RECORD_AUDIO" },
        RESULTS: { GRANTED: "granted" },
        request: jest.fn(),
      },
      Platform: { OS: "android" },
    }));
    jest.doMock("expo-image-picker", () => ({
      requestCameraPermissionsAsync: jest.fn(),
      requestMediaLibraryPermissionsAsync: jest.fn(),
    }));
    jest.doMock("expo-media-library", () => ({}));

    jest.isolateModules(() => {
      const { resolveLibraryAssetPreviewUri } =
        require("./mediaPicker") as typeof import("./mediaPicker");

      const previewUri = resolveLibraryAssetPreviewUri({
        duration: null,
        filename: "picker-image.jpg",
        id: "picker-image",
        localUri: "content://media/picker/42",
        mediaType: "photo",
        uri: "file:///storage/emulated/0/DCIM/picker-image.jpg",
      } as never);

      expect(previewUri).toBe("content://media/picker/42");
    });
  });

  it("avoids Android file previews when no accessible content uri is available", () => {
    jest.doMock("react-native", () => ({
      Alert: { alert: jest.fn() },
      PermissionsAndroid: {
        PERMISSIONS: { RECORD_AUDIO: "RECORD_AUDIO" },
        RESULTS: { GRANTED: "granted" },
        request: jest.fn(),
      },
      Platform: { OS: "android" },
    }));
    jest.doMock("expo-image-picker", () => ({
      requestCameraPermissionsAsync: jest.fn(),
      requestMediaLibraryPermissionsAsync: jest.fn(),
    }));
    jest.doMock("expo-media-library", () => ({}));

    jest.isolateModules(() => {
      const { resolveLibraryAssetPreviewUri } =
        require("./mediaPicker") as typeof import("./mediaPicker");

      const previewUri = resolveLibraryAssetPreviewUri({
        duration: null,
        filename: "picker-image.jpg",
        id: "picker-image",
        localUri: "file:///storage/emulated/0/DCIM/picker-image.jpg",
        mediaType: "photo",
        uri: "file:///storage/emulated/0/DCIM/picker-image.jpg",
      } as never);

      expect(previewUri).toBe("");
    });
  });

  it("skips Android asset info hydration for picker tiles", async () => {
    const getAssetInfoAsync = jest.fn();
    jest.doMock("react-native", () => ({
      Alert: { alert: jest.fn() },
      PermissionsAndroid: {
        PERMISSIONS: { RECORD_AUDIO: "RECORD_AUDIO" },
        RESULTS: { GRANTED: "granted" },
        request: jest.fn(),
      },
      Platform: { OS: "android" },
    }));
    jest.doMock("expo-image-picker", () => ({
      requestCameraPermissionsAsync: jest.fn(),
      requestMediaLibraryPermissionsAsync: jest.fn(),
    }));
    jest.doMock("expo-media-library", () => ({
      getAssetInfoAsync,
    }));

    let hydrateLibraryAssetForPicker!: typeof import("./mediaPicker").hydrateLibraryAssetForPicker;
    jest.isolateModules(() => {
      ({ hydrateLibraryAssetForPicker } =
        require("./mediaPicker") as typeof import("./mediaPicker"));
    });

    const hydrated = await hydrateLibraryAssetForPicker({
      duration: null,
      filename: "picker-image.jpg",
      id: "42",
      mediaType: "photo",
      uri: "file:///storage/emulated/0/DCIM/picker-image.jpg",
    } as never);

    expect(getAssetInfoAsync).not.toHaveBeenCalled();
    expect(hydrated.previewUri).toBe("content://media/external/images/media/42");
    expect(hydrated.runtimeUri).toBe("content://media/external/images/media/42");
  });

  it("skips Android asset info lookup when a MediaStore runtime uri is already available", async () => {
    const getAssetInfoAsync = jest.fn();
    jest.doMock("react-native", () => ({
      Alert: { alert: jest.fn() },
      PermissionsAndroid: {
        PERMISSIONS: { RECORD_AUDIO: "RECORD_AUDIO" },
        RESULTS: { GRANTED: "granted" },
        request: jest.fn(),
      },
      Platform: { OS: "android" },
    }));
    jest.doMock("expo-image-picker", () => ({
      requestCameraPermissionsAsync: jest.fn(),
      requestMediaLibraryPermissionsAsync: jest.fn(),
    }));
    jest.doMock("expo-media-library", () => ({
      getAssetInfoAsync,
    }));

    let mapResolvedLibraryAssetSelection!: typeof import("./mediaPicker").mapResolvedLibraryAssetSelection;
    jest.isolateModules(() => {
      ({ mapResolvedLibraryAssetSelection } =
        require("./mediaPicker") as typeof import("./mediaPicker"));
    });

    const selection = await mapResolvedLibraryAssetSelection({
      duration: null,
      filename: "picker-image.jpg",
      id: "42",
      mediaType: "photo",
      uri: "file:///storage/emulated/0/DCIM/picker-image.jpg",
    } as never);

    expect(getAssetInfoAsync).not.toHaveBeenCalled();
    expect(selection.previewUri).toBe("content://media/external/images/media/42");
    expect(selection.uri).toBe("content://media/external/images/media/42");
  });

  it("accepts videos up to 3 minutes and rejects longer ones", () => {
    jest.doMock("react-native", () => ({
      Alert: { alert: jest.fn() },
      PermissionsAndroid: {
        PERMISSIONS: { RECORD_AUDIO: "RECORD_AUDIO" },
        RESULTS: { GRANTED: "granted" },
        request: jest.fn(),
      },
      Platform: { OS: "android" },
    }));
    jest.doMock("expo-image-picker", () => ({
      requestCameraPermissionsAsync: jest.fn(),
      requestMediaLibraryPermissionsAsync: jest.fn(),
    }));
    jest.doMock("expo-media-library", () => ({}));

    jest.isolateModules(() => {
      const { isSelectableVideoDuration } =
        require("./mediaPicker") as typeof import("./mediaPicker");

      expect(isSelectableVideoDuration(180_000)).toBe(true);
      expect(isSelectableVideoDuration(180_001)).toBe(false);
    });
  });
});
