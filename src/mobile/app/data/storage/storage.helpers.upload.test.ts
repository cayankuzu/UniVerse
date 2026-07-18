jest.mock("expo-file-system/legacy", () => ({
  FileSystemUploadType: {
    BINARY_CONTENT: 0,
  },
  cacheDirectory: "file:///cache/",
  copyAsync: jest.fn(),
  createUploadTask: jest.fn(),
  deleteAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
}));

jest.mock("../../platform/api/core", () => ({
  BASE_URL: "https://functions.example",
  getToken: jest.fn(),
}));

jest.mock("../../platform/config/publicEnv", () => ({
  SUPABASE_PUBLIC_ANON_KEY: "anon-key",
  SUPABASE_PUBLIC_URL: "https://project.supabase.co",
}));

jest.mock("../../platform/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
      refreshSession: jest.fn(),
    },
  },
}));

import { createUploadTask } from "expo-file-system/legacy";
import { getToken } from "../../platform/api/core";
import { supabase } from "../../platform/supabase";
import { directUploadWithRest } from "./storage.helpers.upload";

const mockCreateUploadTask = createUploadTask as jest.Mock;
const mockUploadTask = {
  cancelAsync: jest.fn(),
  uploadAsync: jest.fn(),
};
const mockFetch = global.fetch as jest.Mock | undefined;
const mockGetToken = getToken as jest.Mock;
const mockRefreshSession = supabase.auth.refreshSession as jest.Mock;

function createJsonResponse(status: number, payload: unknown) {
  return {
    json: async () => payload,
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  } as Response;
}

describe("directUploadWithRest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    mockGetToken.mockResolvedValue("direct-token");
    mockRefreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: "fresh-token",
        },
      },
    });
    mockCreateUploadTask.mockReturnValue(mockUploadTask);
    mockUploadTask.cancelAsync.mockResolvedValue(undefined);
    mockUploadTask.uploadAsync.mockResolvedValue({
      body: "",
      status: 200,
    });
  });

  afterAll(() => {
    global.fetch = mockFetch as typeof global.fetch;
  });

  it("requests a signed upload ticket and uploads video with PUT", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          path: "albums/viewer-id/clip-video-key.mp4",
          uploadUrl: "https://signed.example/upload",
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          path: "albums/viewer-id/clip-video-key.mp4",
        }),
      );

    await expect(
      directUploadWithRest(
        {
          name: "clip.mp4",
          type: "video/mp4",
          uri: "file:///clip.mp4",
        },
        "albums",
        "test/direct-upload",
        "direct-token",
        "video-key",
      ),
    ).resolves.toBe("albums/viewer-id/clip-video-key.mp4");

    expect(mockGetToken).toHaveBeenCalledWith({
      context: "test/direct-upload:upload-ticket",
      directToken: "direct-token",
      requireAuth: true,
    });
    expect(mockGetToken).toHaveBeenCalledWith({
      context: "test/direct-upload:upload-confirm",
      directToken: "direct-token",
      requireAuth: true,
    });
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "https://functions.example/storage/upload-ticket",
      expect.objectContaining({
        body: JSON.stringify({
          contentType: "video/mp4",
          folder: "albums",
          sourceName: "clip.mp4",
          uploadKey: "video-key",
        }),
        headers: expect.objectContaining({
          Authorization: "Bearer direct-token",
          "Content-Type": "application/json",
          "x-client-info": "ogrencisosyalagi-mobile/functions",
          apikey: "anon-key",
        }),
        method: "POST",
      }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "https://functions.example/storage/upload-confirm",
      expect.objectContaining({
        body: JSON.stringify({
          contentType: "video/mp4",
          path: "albums/viewer-id/clip-video-key.mp4",
        }),
        headers: expect.objectContaining({
          Authorization: "Bearer direct-token",
          "Content-Type": "application/json",
          "x-client-info": "ogrencisosyalagi-mobile/functions",
          apikey: "anon-key",
        }),
        method: "POST",
      }),
    );
    expect(mockCreateUploadTask).toHaveBeenCalledWith(
      "https://signed.example/upload",
      "file:///clip.mp4",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "video/mp4",
        }),
        httpMethod: "PUT",
      }),
    );
    expect(mockUploadTask.uploadAsync).toHaveBeenCalledTimes(1);
  });

  it("retries the upload ticket request once after a 401 response", async () => {
    mockGetToken.mockResolvedValueOnce("stale-token");
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        createJsonResponse(401, {
          message: "Unauthorized",
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          path: "albums/viewer-id/clip-retry-key.mp4",
          uploadUrl: "https://signed.example/retry-upload",
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          path: "albums/viewer-id/clip-retry-key.mp4",
        }),
      );

    await expect(
      directUploadWithRest(
        {
          name: "clip.mp4",
          type: "video/mp4",
          uri: "file:///clip.mp4",
        },
        "albums",
        "test/direct-retry",
        "stale-token",
        "retry-key",
      ),
    ).resolves.toBe("albums/viewer-id/clip-retry-key.mp4");

    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect((global.fetch as jest.Mock).mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer stale-token",
        }),
      }),
    );
    expect((global.fetch as jest.Mock).mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer fresh-token",
        }),
      }),
    );
    expect(mockCreateUploadTask).toHaveBeenCalledWith(
      "https://signed.example/retry-upload",
      "file:///clip.mp4",
      expect.objectContaining({
        httpMethod: "PUT",
      }),
    );
    expect(mockUploadTask.uploadAsync).toHaveBeenCalledTimes(1);
  });

  it("fails closed when uploaded storage object cannot be confirmed", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          path: "albums/viewer-id/clip-confirm-key.mp4",
          uploadUrl: "https://signed.example/confirm-upload",
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse(422, {
          error: "Upload object not found.",
        }),
      );

    await expect(
      directUploadWithRest(
        {
          name: "clip.mp4",
          type: "video/mp4",
          uri: "file:///clip.mp4",
        },
        "albums",
        "test/direct-confirm",
        "direct-token",
        "confirm-key",
      ),
    ).rejects.toThrow("Upload object not found.");

    expect(mockCreateUploadTask).toHaveBeenCalledWith(
      "https://signed.example/confirm-upload",
      "file:///clip.mp4",
      expect.objectContaining({
        httpMethod: "PUT",
      }),
    );
    expect(mockUploadTask.uploadAsync).toHaveBeenCalledTimes(1);
    expect((global.fetch as jest.Mock).mock.calls[1]?.[0]).toBe(
      "https://functions.example/storage/upload-confirm",
    );
  });

  it("normalizes a provided relative signed upload URL before confirming", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      createJsonResponse(200, {
        path: "albums/viewer-id/session-photo-0.jpg",
      }),
    );

    await expect(
      directUploadWithRest(
        {
          name: "photo.jpg",
          type: "image/jpeg",
          uri: "file:///photo.jpg",
        },
        "albums",
        "test/session-ticket",
        "direct-token",
        "session-key",
        {
          signedUpload: {
            objectPath: "albums/viewer-id/session-photo-0.jpg",
            signedUploadUrl: "/object/upload/sign/media/albums/viewer-id/session-photo-0.jpg",
          },
        },
      ),
    ).resolves.toBe("albums/viewer-id/session-photo-0.jpg");

    expect(mockCreateUploadTask).toHaveBeenCalledWith(
      "https://project.supabase.co/storage/v1/object/upload/sign/media/albums/viewer-id/session-photo-0.jpg",
      "file:///photo.jpg",
      expect.objectContaining({
        httpMethod: "PUT",
      }),
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as jest.Mock).mock.calls[0]?.[0]).toBe(
      "https://functions.example/storage/upload-confirm",
    );
  });

  it("fails closed when the upload-ticket broker route is missing", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      createJsonResponse(404, {
        error: "Not Found",
      }),
    );

    await expect(
      directUploadWithRest(
        {
          name: "clip.mp4",
          type: "video/mp4",
          uri: "file:///clip.mp4",
        },
        "albums",
        "test/direct-fallback",
        "direct-token",
        "fallback-key",
      ),
    ).rejects.toThrow("Upload broker kullanilamiyor.");

    expect((global.fetch as jest.Mock).mock.calls[0]?.[0]).toBe(
      "https://functions.example/storage/upload-ticket",
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockUploadTask.uploadAsync).not.toHaveBeenCalled();
  });

  it("does not bypass the upload-ticket broker after a missing route with stale auth", async () => {
    mockGetToken.mockResolvedValueOnce("stale-token");
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      createJsonResponse(404, {
        error: "Not Found",
      }),
    );

    await expect(
      directUploadWithRest(
        {
          name: "clip.mp4",
          type: "video/mp4",
          uri: "file:///clip.mp4",
        },
        "albums",
        "test/direct-fallback-refresh",
        "stale-token",
        "refresh-key",
      ),
    ).rejects.toThrow("Upload broker kullanilamiyor.");

    expect(mockRefreshSession).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockUploadTask.uploadAsync).not.toHaveBeenCalled();
  });

  it("cancels the native upload task when the caller aborts", async () => {
    const abortController = new AbortController();
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      createJsonResponse(200, {
        path: "albums/viewer-id/clip-cancel-key.mp4",
        uploadUrl: "https://signed.example/cancel-upload",
      }),
    );
    mockUploadTask.uploadAsync.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          abortController.signal.addEventListener("abort", () => {
            reject(new Error("native upload cancelled"));
          });
          setTimeout(() => abortController.abort(), 0);
        }),
    );

    await expect(
      directUploadWithRest(
        {
          name: "clip.mp4",
          type: "video/mp4",
          uri: "file:///clip.mp4",
        },
        "albums",
        "test/direct-cancel",
        "direct-token",
        "cancel-key",
        { signal: abortController.signal },
      ),
    ).rejects.toThrow("Upload cancelled.");

    expect(mockUploadTask.cancelAsync).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
