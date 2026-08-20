import React from "react";
import { Alert } from "react-native";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { AppUploadActivityBar } from "./AppUploadActivityBar";
import { getUploadQueue, removeUploadEntry } from "../../data/queues/uploadQueue";
import {
  removePendingAlbumUpload,
  removeQueuedEventCreate,
} from "../../features/events/public/queues";

let mockBannerProps: Record<string, any> = {};

jest.mock("@tanstack/react-query", () => ({ useQueryClient: jest.fn(() => ({})) }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: jest.fn(() => ({ bottom: 0, left: 0, right: 0, top: 0 })),
}));
jest.mock("../../shared/feedback/AppTransientActivityContext", () => ({
  useAppTransientActivity: jest.fn(() => ({ activity: null })),
}));
jest.mock("../auth", () => ({ useAuth: jest.fn(() => ({ userData: { id: "viewer-id" } })) }));
jest.mock("../../data/queues/runtimeSignals", () => ({
  subscribeQueueResumeSignal: jest.fn(() => jest.fn()),
}));
jest.mock("../../data/queues/uploadQueue", () => ({
  getUploadQueue: jest.fn(),
  removeUploadEntry: jest.fn(async () => undefined),
}));
jest.mock("../../data/queues/uploadProgress", () => ({ readUploadProgress: jest.fn(() => null) }));
jest.mock("../../features/events/public/queues", () => ({
  removePendingAlbumUpload: jest.fn(async () => undefined),
  removeQueuedEventCreate: jest.fn(async () => undefined),
  retryPendingAlbumUpload: jest.fn(async () => undefined),
  retryQueuedEventCreate: jest.fn(async () => undefined),
}));
jest.mock("./AppActivityBanner", () => ({
  AppActivityBanner: (props: Record<string, any>) => {
    const { Text } = require("react-native");
    mockBannerProps = props;
    return <Text>{props.title}</Text>;
  },
}));

const mockGetUploadQueue = getUploadQueue as jest.Mock;
const mockRemovePendingAlbumUpload = removePendingAlbumUpload as jest.Mock;
const mockRemoveQueuedEventCreate = removeQueuedEventCreate as jest.Mock;

function queueEntry(kind: string, status = "pending", errorMessage?: string) {
  return {
    createdAt: "2026-07-21T00:00:00.000Z",
    errorMessage,
    id: `${kind}-id`,
    kind,
    payload: kind === "album-photo" ? { eventId: "event-id" } : {},
    status,
    updatedAt: "2026-07-21T01:00:00.000Z",
    userId: "viewer-id",
  };
}

async function renderEntry(entry: ReturnType<typeof queueEntry>) {
  mockGetUploadQueue.mockResolvedValue([entry]);
  render(
    <AppUploadActivityBar navigationRef={{ isReady: () => true, navigate: jest.fn() } as never} />,
  );
  await waitFor(() => expect(screen.getByText(/yor|yor$/i)).toBeOnTheScreen());
}

describe("AppUploadActivityBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBannerProps = {};
  });

  it.each(["album-photo", "event-create", "unknown"])(
    "provides a fallback title for %s queue entries",
    async (kind) => {
      await renderEntry(queueEntry(kind));
      expect(mockBannerProps.title).toEqual(expect.any(String));
    },
  );

  it("truncates long failures and confirms cancellation", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    await renderEntry(queueEntry("album-photo", "failed", "x".repeat(200)));

    expect(mockBannerProps.stage).toHaveLength(140);
    const cancelAction = mockBannerProps.actions.find(
      (action: { key: string }) => action.key === "cancel",
    );
    act(() => cancelAction.onPress());
    expect(alertSpy).toHaveBeenCalledTimes(1);

    const buttons = alertSpy.mock.calls[0]?.[2] || [];
    await act(async () => {
      buttons[1]?.onPress?.();
      await Promise.resolve();
    });
    expect(mockRemovePendingAlbumUpload).toHaveBeenCalledWith("album-photo-id");
    expect(removeUploadEntry).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it.each(["event-create", "profile-update"])("cancels a %s queue entry", async (kind) => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    await renderEntry(queueEntry(kind));

    const cancelAction = mockBannerProps.actions.find(
      (action: { key: string }) => action.key === "cancel",
    );
    act(() => cancelAction.onPress());
    const buttons = alertSpy.mock.calls[0]?.[2] || [];
    await act(async () => {
      buttons[1]?.onPress?.();
      await Promise.resolve();
    });

    if (kind === "event-create") {
      expect(mockRemoveQueuedEventCreate).toHaveBeenCalledWith(
        expect.objectContaining({ entryId: "event-create-id" }),
      );
    } else {
      expect(removeUploadEntry).toHaveBeenCalledWith("profile-update-id");
    }
    alertSpy.mockRestore();
  });
});
