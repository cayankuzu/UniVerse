import React from "react";
import { act, render } from "@testing-library/react-native";

let mockCardProps: Record<string, any> = {};

jest.mock("../../../features/content-cards/public/cards", () => ({
  HomeEventCard: (props: Record<string, unknown>) => {
    mockCardProps = props;
    return null;
  },
}));

import { HomeEventRow } from "./HomeEventRow";

describe("HomeEventRow", () => {
  it("routes every overlay intent through the stable row callback", () => {
    const onOpenOverlay = jest.fn();
    const event = { id: "event-1" };
    const relations = { joined: true };

    render(
      <HomeEventRow
        accountType="student"
        isTourTarget={false}
        item={{ event, id: "event-1", kind: "event" } as never}
        mediaReady
        onOpenAlbum={jest.fn()}
        onOpenCard={jest.fn()}
        onOpenClub={jest.fn()}
        onOpenOverlay={onOpenOverlay}
        onShowWarning={jest.fn()}
        relations={relations as never}
        viewer={{ id: "viewer-id", username: "alice" } as never}
      />,
    );

    act(() => {
      mockCardProps.onOpenAttendees();
      mockCardProps.onOpenComments();
      mockCardProps.onOpenLikes();
      mockCardProps.onOpenLocation();
    });

    expect(onOpenOverlay.mock.calls.map((call) => call[0])).toEqual([
      "attendees",
      "comments",
      "likes",
      "location",
    ]);
    expect(onOpenOverlay).toHaveBeenLastCalledWith("location", event, relations);
  });
});
