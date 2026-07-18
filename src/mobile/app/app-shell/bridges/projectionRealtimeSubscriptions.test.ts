import { bindNotificationRealtime } from "./projectionRealtimeSubscriptions";

type RegisteredCallback = (payload: {
  eventType: string;
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
}) => void;

function createChannelRecorder() {
  const callbacks: RegisteredCallback[] = [];
  return {
    callbacks,
    channel: {
      on: jest.fn(
        (
          _event: "postgres_changes",
          _config: {
            event: "*";
            filter?: string;
            schema: "public";
            table: string;
          },
          callback: RegisteredCallback,
        ) => {
          callbacks.push(callback);
          return undefined as never;
        },
      ),
    },
  };
}

describe("bindNotificationRealtime", () => {
  it("treats inserted unread rows as unread when the payload uses is_read", () => {
    const dispatch = jest.fn();
    const { callbacks, channel } = createChannelRecorder();

    bindNotificationRealtime(channel as never, {
      dispatch,
      viewerId: "viewer-1",
      viewerKey: "viewer",
    });

    expect(callbacks).toHaveLength(1);

    callbacks[0]({
      eventType: "INSERT",
      new: { id: "notification-1", is_read: false },
      old: null,
    });

    expect(dispatch).toHaveBeenCalledWith({
      kind: "notifications-upsert",
      unreadDelta: 1,
      viewerKey: "viewer",
    });
  });
});
