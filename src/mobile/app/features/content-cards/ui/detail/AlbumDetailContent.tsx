import { View } from "react-native";
import { AppText as Text } from "../../../../shared/components/AppText";
import { buildPreparedAlbumVisibility } from "../../application/feedCardPresentation";
import type { AlbumPhotoWithMeta } from "../../data";
import { ExpandableCardText } from "../shared/ExpandableCardText";
import { tokens } from "../../../../shared/theme";

function AlbumMetaChip(props: { border: string; color: string; label: string; surface: string }) {
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
      <Text style={{ color: props.color, fontSize: tokens.typography.caption, fontWeight: "700" }}>
        {props.label}
      </Text>
    </View>
  );
}

interface AlbumDetailContentProps {
  context: "feed" | "search" | "profile" | "event_album";
  photo: AlbumPhotoWithMeta;
  showSecondaryContent: boolean;
}

export function AlbumDetailContent({
  context,
  photo,
  showSecondaryContent,
}: AlbumDetailContentProps) {
  if (!showSecondaryContent) {
    return (
      <View
        style={{
          paddingHorizontal: tokens.spacing.smPlus,
          paddingTop: tokens.spacing.sm,
          paddingBottom: tokens.spacing.sm,
          gap: tokens.spacing.xs,
        }}
      >
        <Text
          style={{
            color: tokens.colors.foreground,
            fontSize: tokens.typography.control,
            fontWeight: "700",
          }}
          numberOfLines={2}
        >
          {photo.title || photo.eventTitle || "Album"}
        </Text>
        <View
          style={{
            height: 11,
            width: "64%",
            borderRadius: tokens.radius.pill,
            backgroundColor: tokens.colors.border,
          }}
        />
        <View
          style={{
            height: 11,
            width: "42%",
            borderRadius: tokens.radius.pill,
            backgroundColor: tokens.colors.border,
          }}
        />
      </View>
    );
  }

  const visibility = buildPreparedAlbumVisibility(photo, context);

  return (
    <View
      style={{
        paddingHorizontal: tokens.spacing.smPlus,
        paddingTop: tokens.spacing.compact,
        paddingBottom: tokens.spacing.sm,
      }}
    >
      <Text
        style={{
          color: tokens.colors.foreground,
          fontSize: tokens.typography.control,
          fontWeight: "700",
        }}
        numberOfLines={2}
      >
        {photo.title || photo.eventTitle || "Album"}
      </Text>
      {photo.caption ? (
        <ExpandableCardText
          containerStyle={{ marginTop: tokens.spacing.xxs }}
          text={photo.caption}
          textStyle={{
            color: tokens.colors.muted,
            fontSize: tokens.typography.caption,
            lineHeight: tokens.lineHeight.label,
          }}
          toggleTextStyle={{
            color: tokens.colors.primary,
            fontSize: tokens.typography.caption,
            fontWeight: "700",
          }}
        />
      ) : null}
      <AlbumMetaChip
        label={`Görünürlük: ${visibility.text}`}
        color={visibility.type === "club" ? tokens.colors.successText : tokens.colors.warning}
        surface={
          visibility.type === "club" ? tokens.colors.successSoft : tokens.colors.warningSurface
        }
        border={
          visibility.type === "club" ? tokens.colors.successBorderSoft : tokens.colors.orangeBorder
        }
      />
    </View>
  );
}
