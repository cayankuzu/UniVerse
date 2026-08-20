import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar } from "../../../../shared/components";
import type { OverflowActionItem } from "../../../../shared/components";
import {
  buildPreparedAlbumVisibility,
  formatContentAgeLabel,
  resolveAlbumUniversityLabel,
  type PreparedAlbumVisibility,
} from "../../application/feedCardPresentation";
import type { RelationSnapshot } from "../../application/eventPresentation";
import type { AlbumPhotoWithMeta, ContentViewer } from "../../data";
import { renderTourAnchor, type TourAnchorRenderer } from "../tourAnchorRenderer";
import { ExpandableCardText } from "../shared/ExpandableCardText";
import { tokens, withAlpha } from "../../../../shared/theme";
import { t } from "../../../../shared/i18n";

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
  borderRadius: tokens.radius.card,
  overflow: "hidden" as const,
  backgroundColor: tokens.colors.surface,
  borderWidth: 1,
  borderColor: withAlpha(tokens.colors.foreground, 0.07),
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
          fontSize: tokens.typography.caption,
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
  const ageLabel = formatContentAgeLabel(props.photo.createdAt);

  return (
    <View style={styles.header}>
      <Pressable
        onPress={() => props.onOpenProfile(props.photo.username)}
        accessibilityRole="button"
        accessibilityLabel={`${props.photo.name || props.photo.username} profilini aç`}
      >
        <Avatar
          uri={props.photo.userImage}
          name={props.photo.name}
          size={32}
          fallbackInitials={props.presentation?.avatarInitials}
        />
      </Pressable>
      <Pressable
        onPress={() => props.onOpenProfile(props.photo.username)}
        accessibilityRole="button"
        accessibilityLabel={`${props.photo.name || props.photo.username} profilini aç`}
        style={styles.copy}
      >
        <Text style={styles.name} numberOfLines={1}>
          {props.photo.name}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {props.presentation?.universityLabel || resolveAlbumUniversityLabel(props.photo)}
        </Text>
      </Pressable>
      {ageLabel ? (
        <View style={styles.timeCopy}>
          <Text style={styles.timeLabel}>{ageLabel}</Text>
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
      <Text style={styles.contentType}>{t("content.type.album")}</Text>
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
  contentType: {
    color: tokens.colors.primary,
    fontSize: tokens.typography.caption,
    fontWeight: tokens.fontWeight.bold,
    letterSpacing: tokens.letterSpacing.section,
    lineHeight: tokens.lineHeight.caption,
    marginBottom: tokens.spacing.xxs,
  },
  details: {
    paddingBottom: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.smPlus,
    paddingTop: tokens.spacing.compact,
  },
  detailsTitle: {
    color: tokens.colors.foreground,
    fontSize: tokens.typography.control,
    fontWeight: tokens.fontWeight.bold,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.compact,
    paddingBottom: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.smPlus,
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
    fontSize: tokens.typography.caption,
  },
  timeCopy: {
    alignItems: "flex-end",
    gap: tokens.spacing.hairline,
    marginRight: tokens.spacing.micro,
  },
  timeLabel: {
    color: tokens.colors.mutedFg,
    fontSize: tokens.typography.caption,
    fontWeight: tokens.fontWeight.semibold,
  },
});
