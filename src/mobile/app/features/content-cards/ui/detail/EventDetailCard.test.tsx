import React from "react";
import { act, render } from "@testing-library/react-native";

let mockContentProps: Record<string, any> = {};
let mockHeaderProps: Record<string, any> = {};
const mockLoadAlbumOpenWarning = jest.fn(async () => null);

jest.mock("../../../../shared/utils/useProgressiveHydration", () => ({
  useProgressiveHydration: () => true,
}));
jest.mock("../../application/eventDetailPresentation", () => ({
  TEMP_EVENT_WARNING: "temporary event",
  buildEventDetailInfoSlides: () => [],
  buildEventDetailMetaChips: () => [],
  getAlbumWarningMessage: () => "album blocked",
  getLocationWarningMessage: () => "location blocked",
  resolveEventDetailAccessChip: () => null,
}));
jest.mock("../../application/eventInteractionPresentation", () => ({
  getJoinButtonLabel: () => "Join",
}));
jest.mock("../../application/useEventDetailInteractionState", () => ({
  useEventDetailInteractionState: ({ userData }: { userData: unknown }) => ({
    eventActionAccess: { canOpenAlbum: true },
    loadAlbumOpenWarning: mockLoadAlbumOpenWarning,
    setShowImagePreview: jest.fn(),
    showAttendeesModal: false,
    showComments: false,
    showImagePreview: false,
    showLikesModal: false,
    showLocationModal: false,
    showReportModal: false,
    userData,
  }),
}));
jest.mock("./EventDetailContent", () => ({
  EventDetailContent: (props: Record<string, unknown>) => {
    mockContentProps = props;
    return null;
  },
}));
jest.mock("./EventDetailHeader", () => ({
  EventDetailHeader: (props: Record<string, unknown>) => {
    mockHeaderProps = props;
    return null;
  },
}));
jest.mock("./EventDetailDescription", () => ({ EventDetailDescription: () => null }));
jest.mock("./EventDetailImage", () => ({ EventDetailImage: () => null }));
jest.mock("./EventDetailInteractions", () => ({ EventDetailInteractions: () => null }));

import { EventDetailCard } from "./EventDetailCard";

describe("EventDetailCard", () => {
  it("opens club and album only after the asynchronous access check", async () => {
    const onOpenAlbum = jest.fn();
    const onOpenClub = jest.fn();
    const event = {
      clubUsername: "universe-club",
      date: "2026-07-18",
      id: "event-1",
      image: "event.jpg",
      startDate: "2026-07-18",
    };

    render(
      <EventDetailCard
        accountType="student"
        event={event as never}
        onOpenAlbum={onOpenAlbum}
        onOpenClub={onOpenClub}
        viewer={{ id: "viewer-id", username: "alice" } as never}
      />,
    );

    act(() => mockHeaderProps.onPress());
    await act(async () => {
      mockContentProps.onOpenAlbum();
      await Promise.resolve();
    });

    expect(onOpenClub).toHaveBeenCalledWith("universe-club");
    expect(mockLoadAlbumOpenWarning).toHaveBeenCalledTimes(1);
    expect(onOpenAlbum).toHaveBeenCalledWith("event-1");
  });
});
