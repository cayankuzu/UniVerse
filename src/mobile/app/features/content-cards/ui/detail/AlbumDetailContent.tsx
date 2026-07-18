import { Text, View } from "react-native";
import { buildPreparedAlbumVisibility } from "../../application/feedCardPresentation";
import type { AlbumPhotoWithMeta } from "../../data";
import { ExpandableCardText } from "../shared/ExpandableCardText";

function AlbumMetaChip(props: { border: string; color: string; label: string; surface: string }) {
  return (
    <View
      style={{
        marginTop: 8,
        alignSelf: "flex-start",
        borderRadius: 999,
        borderWidth: 1,
        borderColor: props.border,
        backgroundColor: props.surface,
        paddingHorizontal: 8,
        paddingVertical: 4,
      }}
    >
      <Text style={{ color: props.color, fontSize: 10, fontWeight: "700" }}>{props.label}</Text>
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
      <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, gap: 8 }}>
        <Text style={{ color: "#0f172a", fontSize: 15, fontWeight: "700" }} numberOfLines={2}>
          {photo.title || photo.eventTitle || "Album"}
        </Text>
        <View style={{ height: 11, width: "64%", borderRadius: 999, backgroundColor: "#e2e8f0" }} />
        <View style={{ height: 11, width: "42%", borderRadius: 999, backgroundColor: "#e2e8f0" }} />
      </View>
    );
  }

  const visibility = buildPreparedAlbumVisibility(photo, context);

  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 }}>
      <Text style={{ color: "#0f172a", fontSize: 15, fontWeight: "700" }} numberOfLines={2}>
        {photo.title || photo.eventTitle || "Album"}
      </Text>
      {photo.caption ? (
        <ExpandableCardText
          containerStyle={{ marginTop: 4 }}
          text={photo.caption}
          textStyle={{ color: "#64748b", fontSize: 12, lineHeight: 18 }}
          toggleTextStyle={{ color: "#2563eb", fontSize: 12, fontWeight: "700" }}
        />
      ) : null}
      <AlbumMetaChip
        label={`Görünürlük: ${visibility.text}`}
        color={visibility.type === "club" ? "#047857" : "#c2410c"}
        surface={visibility.type === "club" ? "#ecfdf5" : "#fff7ed"}
        border={visibility.type === "club" ? "#bbf7d0" : "#fed7aa"}
      />
    </View>
  );
}
