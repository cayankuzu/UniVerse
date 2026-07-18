import type { ReactNode } from "react";
import { memo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { AlbumFeedCard } from "../../../features/content-cards/public/cards";
import type { AuthUserData, RelationSnapshot } from "../../../features/content-cards/public/types";
import type { HomeFeedItem } from "../data/homeFeedAdapters";
import { getHomeRowSignature, getRelationSignature } from "./homeRow.shared";

type HomeTourAnchorRenderer = (props: {
  children: ReactNode;
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
  tourId: string;
}) => ReactNode;

type HomeAlbumRowProps = {
  currentUsername: string;
  isTourTarget: boolean;
  item: HomeFeedItem & { kind: "album" };
  mediaReady: boolean;
  onOpenClub: (username: string) => void;
  onOpenEvent: (eventId: string) => void;
  onShowWarning: (message: string) => void;
  onOpenProfile: (username: string) => void;
  relations?: RelationSnapshot;
  renderTourAnchor?: HomeTourAnchorRenderer;
  viewer: AuthUserData;
};

function HomeAlbumRowComponent(props: HomeAlbumRowProps) {
  const { item, relations } = props;
  const presentation =
    item.kind === "album" && item.homePresentation && "visibility" in item.homePresentation
      ? item.homePresentation
      : undefined;

  return (
    <AlbumFeedCard
      context="feed"
      currentUsername={props.currentUsername}
      highPriority={props.mediaReady}
      imageVariant={props.mediaReady ? "medium" : item.firstFoldVariant || "thumbnail"}
      isTourTarget={props.isTourTarget}
      onOpenClub={props.onOpenClub}
      onOpenEvent={props.onOpenEvent}
      onOpenProfile={props.onOpenProfile}
      onShowWarning={props.onShowWarning}
      photo={item.album}
      presentation={presentation}
      renderTourAnchor={props.renderTourAnchor}
      relations={relations}
      viewer={props.viewer}
    />
  );
}

export const HomeAlbumRow = memo(
  HomeAlbumRowComponent,
  (previous, next) =>
    previous.currentUsername === next.currentUsername &&
    previous.isTourTarget === next.isTourTarget &&
    previous.mediaReady === next.mediaReady &&
    previous.viewer.id === next.viewer.id &&
    previous.viewer.username === next.viewer.username &&
    previous.onOpenClub === next.onOpenClub &&
    previous.onOpenEvent === next.onOpenEvent &&
    previous.onOpenProfile === next.onOpenProfile &&
    previous.onShowWarning === next.onShowWarning &&
    previous.renderTourAnchor === next.renderTourAnchor &&
    getHomeRowSignature(previous.item) === getHomeRowSignature(next.item) &&
    getRelationSignature(previous.relations) === getRelationSignature(next.relations),
);
