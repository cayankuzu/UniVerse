import type { ReactNode } from "react";
import { memo, useCallback } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { HomeEventCard } from "../../../features/content-cards/public/cards";
import type {
  AuthUserData,
  EventWithMeta,
  RelationSnapshot,
} from "../../../features/content-cards/public/types";
import type { HomeFeedItem } from "../data/homeFeedAdapters";
import { getHomeRowSignature, getRelationSignature } from "./homeRow.shared";

type HomeTourAnchorRenderer = (props: {
  children: ReactNode;
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
  tourId: string;
}) => ReactNode;

type EventOverlayPanel = "attendees" | "comments" | "likes" | "location";

type HomeEventRowProps = {
  accountType: "club" | "student";
  isTourTarget: boolean;
  item: HomeFeedItem & { kind: "event" };
  mediaReady: boolean;
  onOpenAlbum: (eventId: string) => void;
  onOpenCard: (eventId: string) => void;
  onOpenClub: (username: string) => void;
  onOpenOverlay: (
    panel: EventOverlayPanel,
    event: EventWithMeta,
    relations?: RelationSnapshot,
  ) => void;
  onShowWarning: (message: string) => void;
  renderTourAnchor?: HomeTourAnchorRenderer;
  relations?: RelationSnapshot;
  viewer: AuthUserData;
};

function HomeEventRowComponent(props: HomeEventRowProps) {
  const { item, onOpenOverlay, relations } = props;
  const presentation =
    item.kind === "event" && item.homePresentation && "accessChip" in item.homePresentation
      ? item.homePresentation
      : undefined;
  const handleOpenAttendees = useCallback(() => {
    onOpenOverlay("attendees", item.event, relations);
  }, [item.event, onOpenOverlay, relations]);
  const handleOpenComments = useCallback(() => {
    onOpenOverlay("comments", item.event, relations);
  }, [item.event, onOpenOverlay, relations]);
  const handleOpenLikes = useCallback(() => {
    onOpenOverlay("likes", item.event, relations);
  }, [item.event, onOpenOverlay, relations]);
  const handleOpenLocation = useCallback(() => {
    onOpenOverlay("location", item.event, relations);
  }, [item.event, onOpenOverlay, relations]);

  return (
    <HomeEventCard
      accountType={props.accountType}
      deferModalActions
      event={item.event}
      highPriority={props.mediaReady}
      imageVariant={props.mediaReady ? "medium" : item.firstFoldVariant || "thumbnail"}
      isTourTarget={props.isTourTarget}
      onOpenAlbum={props.onOpenAlbum}
      onOpenAttendees={handleOpenAttendees}
      onOpenCard={props.onOpenCard}
      onOpenClub={props.onOpenClub}
      onOpenComments={handleOpenComments}
      onOpenLikes={handleOpenLikes}
      onOpenLocation={handleOpenLocation}
      onShowWarning={props.onShowWarning}
      presentation={presentation}
      renderTourAnchor={props.renderTourAnchor}
      relations={relations}
      viewer={props.viewer}
    />
  );
}

export const HomeEventRow = memo(
  HomeEventRowComponent,
  (previous, next) =>
    previous.accountType === next.accountType &&
    previous.isTourTarget === next.isTourTarget &&
    previous.mediaReady === next.mediaReady &&
    previous.viewer.id === next.viewer.id &&
    previous.viewer.username === next.viewer.username &&
    previous.onOpenAlbum === next.onOpenAlbum &&
    previous.onOpenCard === next.onOpenCard &&
    previous.onOpenClub === next.onOpenClub &&
    previous.onOpenOverlay === next.onOpenOverlay &&
    previous.onShowWarning === next.onShowWarning &&
    previous.renderTourAnchor === next.renderTourAnchor &&
    getHomeRowSignature(previous.item) === getHomeRowSignature(next.item) &&
    getRelationSignature(previous.relations) === getRelationSignature(next.relations),
);
