import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";

import { useEventCardProjectionLoaders } from "./useEventCardProjectionLoaders";

jest.mock("../data", () => ({
  fetchEventAttendees: jest.fn(),
  fetchEventComments: jest.fn(),
  fetchEventLikers: jest.fn(),
}));

jest.mock("../../../platform/observability", () => ({
  startObservedTimer: jest.fn(() => jest.fn()),
}));

jest.mock("./projectionListCache", () => ({
  readProjectionListCache: jest.fn(() => ({
    hasSnapshot: false,
    items: [],
  })),
  writeProjectionListCache: jest.fn(),
}));

const { fetchEventAttendees } = jest.requireMock("../data") as {
  fetchEventAttendees: jest.Mock;
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function useHarness() {
  const [attendees, setAttendees] = useState(0);
  const [attendeesList, setAttendeesList] = useState<Array<{ id: string; username: string }>>([]);
  const loaders = useEventCardProjectionLoaders({
    bodyActionsEnabled: true,
    commentsLoaded: false,
    eventActionAccess: {
      canViewAttendees: true,
    },
    eventId: "event-1",
    interactive: true,
    setAttendeesCount: setAttendees,
    setAttendeesList: setAttendeesList as (rows: any[]) => void,
    setAttendeesLoading: () => undefined,
    setAttendeesRefreshing: () => undefined,
    setComments: () => undefined,
    setCommentsLoaded: () => undefined,
    setCommentsRefreshing: () => undefined,
    setLikers: () => undefined,
    setLikesLoading: () => undefined,
    setLikesRefreshing: () => undefined,
    viewerId: "viewer-1",
  });

  return {
    attendees,
    attendeesList,
    loadAttendees: loaders.loadAttendees,
  };
}

describe("useEventCardProjectionLoaders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("raises the attendee counter from the loaded attendee list when the event metric is stale", async () => {
    fetchEventAttendees.mockResolvedValue({
      items: [
        {
          id: "user-1",
          username: "cayan",
        },
      ],
    });

    const { result } = renderHook(() => useHarness(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.loadAttendees();
    });

    expect(result.current.attendees).toBe(1);
    expect(result.current.attendeesList).toEqual([
      expect.objectContaining({
        id: "user-1",
        username: "cayan",
      }),
    ]);
  });
});
