import {
  canViewAlbum,
  canViewEvent,
  getAlbumButtonAction,
  getEventActionAccess,
} from "./visibility.access";

describe("album button action", () => {
  it("keeps profile albums on the event detail even if stale cache still marks the club private", () => {
    expect(
      getAlbumButtonAction(
        "viewer",
        {
          clubIsPrivate: true,
          clubUsername: "fanzin",
          eventId: "event-1",
        },
        {},
        "profile",
      ),
    ).toEqual({
      action: "view_event",
      label: "Etkinliği Gör",
      navigateTo: "/album/event-1",
    });
  });

  it("keeps public profile albums on the event detail action", () => {
    expect(
      getAlbumButtonAction(
        "viewer",
        {
          clubIsPrivate: false,
          clubUsername: "açık-kulüp",
          eventId: "event-1",
        },
        {},
        "profile",
      ),
    ).toEqual({
      action: "view_event",
      label: "Etkinliği Gör",
      navigateTo: "/album/event-1",
    });
  });

  it("disables event navigation for albums whose source event was deleted", () => {
    expect(
      getAlbumButtonAction(
        "viewer",
        {
          canOpenAlbumEventDetail: false,
          clubUsername: "",
          eventId: "",
          lockedReasonCode: "EVENT_REMOVED",
          lockedReasonText: "Bu albümün bagli oldugu etkinlik artik mevcut degil.",
        },
        {},
        "profile",
      ),
    ).toEqual({
      action: "disabled",
      label: "Etkinliği Gör",
      message: "Bu albümün bagli oldugu etkinlik artik mevcut degil.",
    });
  });
});

describe("fallback visibility access", () => {
  it("hides private-club events when fallback data has no capability flags", () => {
    expect(
      canViewEvent(
        "viewer",
        {
          clubIsPrivate: true,
          clubUsername: "fanzin",
        },
        {},
      ),
    ).toEqual({
      canView: false,
      reason: "Bu kulübün içeriğini görmek için kulübü takip etmelisiniz.",
    });
  });

  it("hides private-club albums when fallback data has no capability flags", () => {
    expect(
      canViewAlbum(
        "viewer",
        {
          clubIsPrivate: true,
          clubUsername: "fanzin",
          eventId: "event-1",
          showOnClubProfile: true,
          username: "Öğrenci",
        },
        "feed",
        {},
      ),
    ).toEqual({
      canView: false,
      reason: "Bu kulübün albümünü görmek için kulübü takip etmelisiniz.",
    });
  });

  it("keeps own albums visible even when the blocked club capability says the album is locked", () => {
    expect(
      canViewAlbum(
        "Öğrenci",
        {
          canDiscoverAlbum: false,
          canOpenAlbum: false,
          clubIsPrivate: true,
          clubUsername: "fanzin",
          lockedReasonText: "Bu album sadece takipcilere açık.",
          username: "Öğrenci",
        },
        "event_album",
        {},
      ),
    ).toEqual({ canView: true });
  });

  it("locks private-club event actions behind follow state in fallback mode", () => {
    expect(
      getEventActionAccess(
        "viewer",
        {
          clubIsPrivate: true,
          clubUsername: "fanzin",
          endDate: "2099-03-14",
          endTime: "22:00",
          startDate: "2099-03-14",
        },
        {},
      ),
    ).toMatchObject({
      canJoin: false,
      canOpenAlbum: false,
      canOpenDetail: false,
      reasonCode: "FOLLOW_REQUIRED",
    });
  });

  it("keeps album upload open for joined viewers before the event ends in fallback mode", () => {
    expect(
      getEventActionAccess(
        "viewer",
        {
          clubIsPrivate: false,
          clubUsername: "fanzin",
          endDate: "2099-03-14",
          endTime: "22:00",
          joined: true,
          startDate: "2099-03-14",
        },
        {},
      ),
    ).toMatchObject({
      canOpenAlbum: true,
      canUploadAlbum: true,
    });
  });
});
