import { Pressable, Text, View } from "react-native";
import { Avatar } from "../../../../shared/components";
import type { AlbumPhotoWithMeta } from "../../data";
import { tokens } from "../../../../shared/theme";

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

function formatTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function resolveAlbumUniversity(photo: AlbumPhotoWithMeta) {
  const value = String(
    photo.userUniversity ||
      (photo as AlbumPhotoWithMeta & { university?: string }).university ||
      "",
  ).trim();
  return value || "Üniversite bilgisi yok";
}

interface AlbumDetailHeaderProps {
  onOpenProfile: (username: string) => void;
  photo: AlbumPhotoWithMeta;
  showAvatar?: boolean;
}

export function AlbumDetailHeader({
  onOpenProfile,
  photo,
  showAvatar = true,
}: AlbumDetailHeaderProps) {
  const dateLabel = formatDate(photo.createdAt);
  const timeLabel = formatTime(photo.createdAt);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingTop: tokens.spacing.sm,
        paddingBottom: tokens.spacing.xs,
        gap: 10,
      }}
    >
      {showAvatar ? (
        <Pressable onPress={() => onOpenProfile(photo.username)}>
          <Avatar uri={photo.userImage} name={photo.name} size={38} />
        </Pressable>
      ) : null}
      <Pressable onPress={() => onOpenProfile(photo.username)} style={{ flex: 1 }}>
        <Text
          style={{
            color: tokens.colors.foreground,
            fontSize: tokens.typography.body,
            fontWeight: tokens.fontWeight.bold,
          }}
          numberOfLines={1}
        >
          {photo.name}
        </Text>
        <Text
          style={{ color: tokens.colors.muted, fontSize: tokens.typography.tiny }}
          numberOfLines={1}
        >
          {resolveAlbumUniversity(photo)}
        </Text>
      </Pressable>
      {dateLabel || timeLabel ? (
        <View style={{ alignItems: "flex-end", gap: 1, marginRight: 2 }}>
          {!!dateLabel && (
            <Text
              style={{
                fontSize: tokens.typography.micro,
                color: tokens.colors.mutedFg,
                fontWeight: tokens.fontWeight.semibold,
              }}
            >
              {dateLabel}
            </Text>
          )}
          {!!timeLabel && (
            <Text
              style={{
                fontSize: tokens.typography.micro,
                color: tokens.colors.mutedFg,
                fontWeight: tokens.fontWeight.semibold,
              }}
            >
              {timeLabel}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}
