import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../../../../shared/components";
import type { OverflowActionItem } from "../../../../shared/components";
import {
  buildPreparedAlbumVisibility,
  formatEventHeaderDate,
  formatEventHeaderTime,
  resolveAlbumUniversityLabel,
  type PreparedAlbumVisibility,
} from "../../application/feedCardPresentation";
import type { RelationSnapshot } from "../../application/eventPresentation";
import type { AlbumPhotoWithMeta, ContentViewer } from "../../data";
import { renderTourAnchor, type TourAnchorRenderer } from "../tourAnchorRenderer";
import { ExpandableCardText } from "../shared/ExpandableCardText";
import { tokens } from "../../../../shared/theme";

export type AlbumFeedCardPresentation = {
  avatarInitials: string;
  createdAtDateLabel?: string;
  createdAtLabel?: string;
  createdAtTimeLabel?: string;
  photoCount: number;
  universityLabel: string;
  visibility: PreparedAlbumVisibility;
};

export interface AlbumFeedCardProps {
  photo: AlbumPhotoWithMeta;
  currentUsername: string;
  viewer: ContentViewer;
  highPriority?: boolean;
  presentation?: AlbumFeedCardPresentation;
  imageVariant?: "thumbnail" | "medium" | "full";
  relations?: RelationSnapshot;
  onOpenEvent: (eventId: string) => void;
  onOpenClub: (clubUsername: string) => void;
  onOpenProfile: (username: string) => void;
  onOpenComments?: () => void;
  onOpenLikes?: () => void;
  onShowWarning?: (message: string) => void;
  context?: "feed" | "search" | "profile" | "event_album";
  hideEventAction?: boolean;
  isTourTarget?: boolean;
  deferModalActions?: boolean;
  onOpenCard?: (id: string) => void;
  renderTourAnchor?: TourAnchorRenderer;
}

const ALBUM_CARD_CONTAINER_STYLE = {
  borderRadius: 18,
  overflow: "hidden" as const,
  backgroundColor: tokens.colors.surface,
  borderWidth: 1,
  borderColor: "rgba(15,23,42,0.07)",
  marginBottom: tokens.spacing.sm,
};

function AlbumMetaChip(props: { color: string; label: string; surface: string; border: string }) {
  return (
    <View
      style={{
        marginTop: tokens.spacing.xs,
        alignSelf: "flex-start",
        borderRadius: tokens.radius.pill,
        borderWidth: 1,
        borderColor: props.border,
        backgroundColor: props.surface,
        paddingHorizontal: tokens.spacing.xs,
        paddingVertical: tokens.spacing.xxs,
      }}
    >
      <Text
        style={{
          color: props.color,
          fontSize: tokens.typography.micro,
          fontWeight: tokens.fontWeight.bold,
        }}
      >
        {props.label}
      </Text>
    </View>
  );
}

export function AlbumCardSurface(props: {
  children: React.ReactNode;
  isTourTarget: boolean;
  renderTourAnchor?: TourAnchorRenderer;
}) {
  return renderTourAnchor(props.renderTourAnchor, {
    children: <View style={ALBUM_CARD_CONTAINER_STYLE}>{props.children}</View>,
    enabled: props.isTourTarget,
    tourId: "album-card",
  });
}

export function AlbumCardHeaderSection(props: {
  photo: AlbumPhotoWithMeta;
  presentation?: AlbumFeedCardPresentation;
  menuActions?: OverflowActionItem[] | null;
  onOpenProfile: (username: string) => void;
}) {
  const dateLabel =
    props.presentation?.createdAtDateLabel || formatEventHeaderDate(props.photo.createdAt);
  const timeLabel =
    props.presentation?.createdAtTimeLabel || formatEventHeaderTime(props.photo.createdAt);

  return (
    <View style={styles.header}>
      <Pressable onPress={() => props.onOpenProfile(props.photo.username)}>
        <Avatar
          uri={props.photo.userImage}
          name={props.photo.name}
          size={38}
          fallbackInitials={props.presentation?.avatarInitials}
        />
      </Pressable>
      <Pressable onPress={() => props.onOpenProfile(props.photo.username)} style={styles.copy}>
        <Text style={styles.name} numberOfLines={1}>
          {props.photo.name}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {props.presentation?.universityLabel || resolveAlbumUniversityLabel(props.photo)}
        </Text>
      </Pressable>
      {dateLabel || timeLabel ? (
        <View style={styles.timeCopy}>
          {dateLabel ? <Text style={styles.timeLabel}>{dateLabel}</Text> : null}
          {timeLabel ? <Text style={styles.timeLabel}>{timeLabel}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

export function AlbumCardDetails(props: {
  context: "feed" | "search" | "profile" | "event_album";
  photo: AlbumPhotoWithMeta;
  presentation?: AlbumFeedCardPresentation;
}) {
  const visibility =
    props.presentation?.visibility || buildPreparedAlbumVisibility(props.photo, props.context);

  return (
    <View style={styles.details}>
      <Text style={styles.detailsTitle} numberOfLines={2}>
        {props.photo.title || props.photo.eventTitle || "Album"}
      </Text>
      {props.photo.caption ? (
        <ExpandableCardText
          containerStyle={{ marginTop: tokens.spacing.xxs }}
          text={props.photo.caption}
          textStyle={styles.caption}
          toggleTextStyle={styles.expandToggle}
        />
      ) : null}
      <AlbumMetaChip
        label={`Görünürlük: ${visibility.text}`}
        color={visibility.type === "club" ? tokens.colors.success : tokens.colors.warning}
        surface={
          visibility.type === "club" ? tokens.colors.successSoft : tokens.colors.warningSurface
        }
        border={
          visibility.type === "club" ? tokens.colors.successBorder : tokens.colors.warningBorder
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  caption: {
    color: tokens.colors.muted,
    fontSize: tokens.typography.caption,
    marginTop: tokens.spacing.xxs,
  },
  copy: {
    flex: 1,
  },
  details: {
    paddingBottom: tokens.spacing.sm,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  detailsTitle: {
    color: tokens.colors.foreground,
    fontSize: 15,
    fontWeight: tokens.fontWeight.bold,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingBottom: tokens.spacing.xs,
    paddingHorizontal: 14,
    paddingTop: tokens.spacing.sm,
  },
  name: {
    color: tokens.colors.foreground,
    fontSize: tokens.typography.body,
    fontWeight: tokens.fontWeight.bold,
  },
  expandToggle: {
    color: tokens.colors.primary,
    fontSize: tokens.typography.caption,
    fontWeight: tokens.fontWeight.bold,
  },
  subtitle: {
    color: tokens.colors.muted,
    fontSize: tokens.typography.tiny,
  },
  timeCopy: {
    alignItems: "flex-end",
    gap: 1,
    marginRight: 2,
  },
  timeLabel: {
    color: tokens.colors.mutedFg,
    fontSize: tokens.typography.micro,
    fontWeight: tokens.fontWeight.semibold,
  },
});
