import React from "react";
import { fireEvent } from "@testing-library/react-native";
import { renderWithProviders, TEST_VIEWER } from "./homeFeedCardsRenderSmoke.test.helpers";
import { useDeferredAlbumFeedCardState } from "../application/useDeferredAlbumFeedCardState";
import { useDeferredEventFeedCardState } from "../application/useDeferredEventFeedCardState";
import { AlbumFeedCard } from "./feed/AlbumFeedCard";
import { HomeEventCard } from "./homeEventCard";
import { useAlbumFeedCardState } from "./feed/useAlbumFeedCardState";
import { useEventCardState } from "./homeEventCard/useEventCardState";

jest.mock("./homeEventCard/useEventCardState", () => ({
  useEventCardState: jest.fn(),
}));

jest.mock("./feed/useAlbumFeedCardState", () => ({
  useAlbumFeedCardState: jest.fn(),
}));

jest.mock("../application/useDeferredEventFeedCardState", () => ({
  useDeferredEventFeedCardState: jest.fn(),
}));

jest.mock("../application/useDeferredAlbumFeedCardState", () => ({
  useDeferredAlbumFeedCardState: jest.fn(),
}));

const mockedUseEventCardState = useEventCardState as jest.MockedFunction<typeof useEventCardState>;
const mockedUseAlbumFeedCardState = useAlbumFeedCardState as jest.MockedFunction<
  typeof useAlbumFeedCardState
>;
const mockedUseDeferredEventFeedCardState = useDeferredEventFeedCardState as jest.MockedFunction<
  typeof useDeferredEventFeedCardState
>;
const mockedUseDeferredAlbumFeedCardState = useDeferredAlbumFeedCardState as jest.MockedFunction<
  typeof useDeferredAlbumFeedCardState
>;

describe("home feed card render smoke", () => {
  beforeEach(() => {
    mockedUseEventCardState.mockReturnValue({
      accountType: "student",
      albumDisabled: false,
      attendees: 3,
      attendeesList: [],
      attendeesLoading: false,
      attendeesRefreshing: false,
      bodyActionsEnabled: true,
      canDeleteComment: () => false,
      commentCount: 2,
      comments: [],
      commentsRefreshing: false,
      copiedField: null,
      currentUser: null,
      eventActionAccess: {
        albumReason: null,
        canOpenAlbum: true,
        isEnded: false,
        reason: null,
      },
      eventMenuActions: [],
      handleAddComment: async () => undefined,
      handleCopyText: async () => undefined,
      handleDeleteComment: () => undefined,
      handleJoin: () => undefined,
      handleLike: () => undefined,
      handleOpenAttendees: async () => undefined,
      handleOpenComments: async () => undefined,
      handleOpenLikes: async () => undefined,
      handleReport: async () => undefined,
      handleReportComment: () => undefined,
      handleToggleCommentLike: async () => undefined,
      hasLocation: true,
      imagePreviewHeight: 320,
      joinDisabled: false,
      joinWarningMessage: "",
      joined: false,
      liked: false,
      loadAlbumOpenWarning: async () => null,
      likes: 4,
      likesLoading: false,
      likesRefreshing: false,
      likers: [],
      loadAttendees: async () => undefined,
      loadCommentLikers: async () => [],
      loadLikers: async () => undefined,
      locationDisabled: false,
      modalBottomPadding: 24,
      pendingStatus: null,
      refreshComments: async () => undefined,
      reportSubmitted: false,
      setShowAttendeesModal: () => undefined,
      setShowComments: () => undefined,
      setShowImagePreview: () => undefined,
      setShowLikesModal: () => undefined,
      setShowLocationModal: () => undefined,
      setShowReportModal: () => undefined,
      showAttendeesModal: false,
      showComments: false,
      showImagePreview: false,
      showLikesModal: false,
      showLocationModal: false,
      showReportModal: false,
      userData: {
        id: "viewer-1",
        name: "Viewer",
        profileImage: null,
        university: "Uni",
        username: "viewer",
      },
    } as any);

    mockedUseAlbumFeedCardState.mockReturnValue({
      buttonAction: {
        action: "open",
        label: "Etkinlige git",
      },
      canDeleteComment: () => false,
      commentCount: 1,
      comments: [],
      commentsRefreshing: false,
      handleActionPress: () => undefined,
      handleAddComment: async () => undefined,
      handleDeleteComment: () => undefined,
      handleLike: async () => undefined,
      handleOpenComments: async () => undefined,
      handleOpenLikes: async () => undefined,
      handleReportComment: () => undefined,
      handleToggleCommentLike: async () => undefined,
      liked: false,
      likes: 7,
      likesLoading: false,
      likesRefreshing: false,
      likers: [],
      loadCommentLikers: async () => [],
      loadLikers: async () => undefined,
      menuActions: [],
      previewImages: ["https://example.com/album-1.jpg"],
      previewIndex: 0,
      refreshComments: async () => undefined,
      setPreviewIndex: () => undefined,
      setShowComments: () => undefined,
      setShowImagePreview: () => undefined,
      setShowLikesModal: () => undefined,
      showComments: false,
      showImagePreview: false,
      showLikesModal: false,
      userData: {
        id: "viewer-1",
        name: "Viewer",
        profileImage: null,
        university: "Uni",
        username: "viewer",
      },
    } as any);

    mockedUseDeferredEventFeedCardState.mockReturnValue({
      accountType: "student",
      albumDisabled: false,
      attendees: 3,
      commentCount: 2,
      eventActionAccess: {
        albumReason: null,
        canOpenAlbum: true,
        isEnded: false,
        isMembersOnly: false,
        isOwnClub: false,
        reason: null,
      },
      handleJoin: async () => undefined,
      handleLike: async () => undefined,
      hasLocation: true,
      joinDisabled: false,
      joinWarningMessage: "",
      joined: false,
      liked: false,
      loadAlbumOpenWarning: async () => null,
      likes: 4,
      locationDisabled: false,
      pendingStatus: null,
    } as any);

    mockedUseDeferredAlbumFeedCardState.mockReturnValue({
      buttonAction: {
        action: "view_event",
        label: "Etkinlige git",
      },
      commentCount: 1,
      handleActionPress: () => undefined,
      handleLike: async () => undefined,
      liked: false,
      likes: 7,
    } as any);
  });

  it("renders a home event card without crashing", () => {
    const screen = renderWithProviders(
      <HomeEventCard
        accountType="student"
        event={
          {
            id: "event-1",
            albumCount: 2,
            attendees: 3,
            capacity: 20,
            category: "Music",
            club: "Uni Club",
            clubImage: "https://example.com/club.jpg",
            clubUsername: "uniclub",
            comments: 2,
            createdAt: "2026-03-24T10:00:00.000Z",
            date: "2026-03-24",
            description: "Etkinlik açıklaması",
            endTime: "20:00",
            fee: "Ücretsiz",
            idempotencyKey: "event-1",
            image: "https://example.com/event.jpg",
            joined: false,
            likes: 4,
            liked: false,
            location: "Kampus",
            startDate: "2026-03-24",
            startTime: "18:00",
            title: "Spring Jam",
            type: "Concert",
            university: "Uni",
          } as any
        }
        onOpenAlbum={() => undefined}
        onOpenClub={() => undefined}
        viewer={TEST_VIEWER}
      />,
    );

    expect(screen.getByText("Spring Jam")).toBeTruthy();
    expect(screen.getByText("Uni Club")).toBeTruthy();
  });

  it("renders an album feed card without crashing", () => {
    const screen = renderWithProviders(
      <AlbumFeedCard
        photo={
          {
            id: "album-1",
            caption: "Albüm açıklaması",
            clubUsername: "uniclub",
            createdAt: "2026-03-24T11:00:00.000Z",
            eventId: "event-1",
            eventTitle: "Spring Jam",
            image: "https://example.com/album-1.jpg",
            images: ["https://example.com/album-1.jpg"],
            name: "Uni Club",
            photoCount: 1,
            title: "Album",
            userImage: "https://example.com/club.jpg",
            userUniversity: "Uni",
            username: "uniclub",
          } as any
        }
        currentUsername="viewer"
        onOpenClub={() => undefined}
        onOpenEvent={() => undefined}
        onOpenProfile={() => undefined}
        viewer={TEST_VIEWER}
      />,
    );

    expect(screen.getByText("Album")).toBeTruthy();
    expect(screen.getByText("Uni Club")).toBeTruthy();
  });

  it("renders deferred feed cards without crashing", () => {
    const eventScreen = renderWithProviders(
      <HomeEventCard
        accountType="student"
        deferModalActions
        event={
          {
            id: "event-2",
            albumCount: 1,
            attendees: 5,
            category: "Music",
            club: "Uni Club",
            clubUsername: "uniclub",
            comments: 2,
            date: "2026-03-24",
            description: "Etkinlik açıklaması",
            image: "https://example.com/event-2.jpg",
            likes: 4,
            location: "Kampus",
            title: "Late Night Jam",
          } as any
        }
        onOpenAlbum={() => undefined}
        onOpenCard={() => undefined}
        onOpenClub={() => undefined}
        viewer={TEST_VIEWER}
      />,
    );

    const albumScreen = renderWithProviders(
      <AlbumFeedCard
        deferModalActions
        photo={
          {
            id: "album-2",
            clubUsername: "uniclub",
            createdAt: "2026-03-24T11:00:00.000Z",
            eventId: "event-2",
            eventTitle: "Late Night Jam",
            image: "https://example.com/album-2.jpg",
            images: ["https://example.com/album-2.jpg"],
            name: "Uni Club",
            photoCount: 1,
            title: "After Movie",
            userImage: "https://example.com/club.jpg",
            userUniversity: "Uni",
            username: "uniclub",
          } as any
        }
        currentUsername="viewer"
        onOpenCard={() => undefined}
        onOpenClub={() => undefined}
        onOpenEvent={() => undefined}
        onOpenProfile={() => undefined}
        viewer={TEST_VIEWER}
      />,
    );

    expect(eventScreen.getByText("Late Night Jam")).toBeTruthy();
    expect(albumScreen.getByText("After Movie")).toBeTruthy();
  });

  it("opens home event overlays before falling back to card focus", () => {
    const onOpenCard = jest.fn();
    const onOpenComments = jest.fn();
    const onOpenLikes = jest.fn();
    const onOpenAttendees = jest.fn();
    const onOpenLocation = jest.fn();

    mockedUseDeferredEventFeedCardState.mockReturnValue({
      accountType: "student",
      albumDisabled: false,
      attendees: 9,
      commentCount: 27,
      eventActionAccess: {
        albumReason: null,
        canOpenAlbum: true,
        isEnded: false,
        isMembersOnly: false,
        isOwnClub: false,
        reason: null,
      },
      handleJoin: async () => undefined,
      handleLike: async () => undefined,
      hasLocation: true,
      joinDisabled: false,
      joinWarningMessage: "",
      joined: false,
      liked: false,
      loadAlbumOpenWarning: async () => null,
      likes: 17,
      locationDisabled: false,
      pendingStatus: null,
    } as any);

    const screen = renderWithProviders(
      <HomeEventCard
        accountType="student"
        deferModalActions
        event={
          {
            id: "event-overlay",
            albumCount: 3,
            attendees: 9,
            capacity: 50,
            club: "Uni Club",
            clubUsername: "uniclub",
            comments: 27,
            image: "https://example.com/event-overlay.jpg",
            likes: 17,
            location: "Kampus",
            title: "Overlay Event",
          } as any
        }
        onOpenAttendees={onOpenAttendees}
        onOpenCard={onOpenCard}
        onOpenComments={onOpenComments}
        onOpenLikes={onOpenLikes}
        onOpenLocation={onOpenLocation}
        onOpenClub={() => undefined}
        viewer={TEST_VIEWER}
      />,
    );

    fireEvent.press(screen.getByLabelText("Etkinlik yorumlarını aç"));
    fireEvent(screen.getByLabelText("Etkinlik beğenilerini aç"), "onLongPress");
    fireEvent.press(screen.getByLabelText("Etkinlik katılımcılarını aç"));
    fireEvent.press(screen.getByLabelText("Etkinlik konumunu aç"));

    expect(onOpenComments).toHaveBeenCalledTimes(1);
    expect(onOpenLikes).toHaveBeenCalledTimes(1);
    expect(onOpenAttendees).toHaveBeenCalledTimes(1);
    expect(onOpenLocation).toHaveBeenCalledTimes(1);
    expect(onOpenCard).not.toHaveBeenCalled();
  });

  it("opens home album overlays before falling back to card focus", () => {
    const onOpenCard = jest.fn();
    const onOpenComments = jest.fn();
    const onOpenLikes = jest.fn();

    mockedUseDeferredAlbumFeedCardState.mockReturnValue({
      buttonAction: {
        action: "view_event",
        label: "Etkinlige git",
      },
      commentCount: 31,
      handleActionPress: () => undefined,
      handleLike: async () => undefined,
      liked: false,
      likes: 19,
    } as any);

    const screen = renderWithProviders(
      <AlbumFeedCard
        deferModalActions
        photo={
          {
            id: "album-overlay",
            clubUsername: "uniclub",
            createdAt: "2026-03-24T11:00:00.000Z",
            eventId: "event-overlay",
            eventTitle: "Overlay Event",
            image: "https://example.com/album-overlay.jpg",
            images: ["https://example.com/album-overlay.jpg"],
            name: "Uni Club",
            photoCount: 1,
            title: "Overlay Album",
            userImage: "https://example.com/club.jpg",
            userUniversity: "Uni",
            username: "uniclub",
          } as any
        }
        currentUsername="viewer"
        onOpenCard={onOpenCard}
        onOpenClub={() => undefined}
        onOpenComments={onOpenComments}
        onOpenEvent={() => undefined}
        onOpenLikes={onOpenLikes}
        onOpenProfile={() => undefined}
        viewer={TEST_VIEWER}
      />,
    );

    fireEvent.press(screen.getByLabelText("Albüm yorumlarını aç"));
    fireEvent(screen.getByLabelText("Albüm beğenilerini aç"), "onLongPress");

    expect(onOpenComments).toHaveBeenCalledTimes(1);
    expect(onOpenLikes).toHaveBeenCalledTimes(1);
    expect(onOpenCard).not.toHaveBeenCalled();
  });
});
