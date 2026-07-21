import { memo, useMemo, useState } from "react";
import { View } from "react-native";
import { AppText as Text } from "./AppText";
import { tokens } from "../theme";
import { AppImage } from "./AppImage";

type AvatarImageVariants = {
  full?: string | null;
  medium?: string | null;
  thumbnail?: string | null;
};

interface Props {
  uri?: string | null;
  variants?: AvatarImageVariants | null;
  name?: string;
  fallbackInitials?: string;
  size?: number;
  borderColor?: string;
  borderWidth?: number;
}

function resolveAvatarInitials(name?: string, fallbackInitials?: string) {
  if (fallbackInitials) return fallbackInitials;
  if (!name) return "?";
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function resolveAvatarSourceKey(params: {
  uri?: string | null;
  variants?: AvatarImageVariants | null;
}) {
  return [
    String(params.uri || "").trim(),
    String(params.variants?.thumbnail || "").trim(),
    String(params.variants?.medium || "").trim(),
    String(params.variants?.full || "").trim(),
  ].join("|");
}

const AvatarContent = memo(function AvatarContent(props: {
  initials: string;
  size: number;
  sourceKey: string;
  uri?: string | null;
  variants?: AvatarImageVariants | null;
}) {
  const [failedSourceKey, setFailedSourceKey] = useState<string | null>(null);
  const fontSize = Math.max(10, props.size * 0.38);
  const hasImage = Boolean(
    props.uri || props.variants?.thumbnail || props.variants?.medium || props.variants?.full,
  );
  const imageFailed = failedSourceKey === props.sourceKey;

  if (hasImage && !imageFailed) {
    return (
      <AppImage
        uri={props.uri}
        variants={props.variants || undefined}
        variant="thumbnail"
        style={{ width: props.size, height: props.size, borderRadius: props.size / 2 }}
        contentFit="cover"
        onError={() => setFailedSourceKey(props.sourceKey)}
      />
    );
  }

  return (
    <Text style={{ fontSize, fontWeight: tokens.fontWeight.bold, color: tokens.colors.muted }}>
      {props.initials}
    </Text>
  );
});

export function Avatar({
  uri,
  variants,
  name,
  fallbackInitials,
  size = 34,
  borderColor,
  borderWidth = 0,
}: Props) {
  const initials = useMemo(
    () => resolveAvatarInitials(name, fallbackInitials),
    [fallbackInitials, name],
  );
  const avatarSourceKey = useMemo(() => resolveAvatarSourceKey({ uri, variants }), [uri, variants]);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: tokens.colors.border,
        alignItems: "center",
        justifyContent: "center",
        borderWidth,
        borderColor: borderColor ?? "transparent",
      }}
    >
      <AvatarContent
        initials={initials}
        size={size}
        sourceKey={avatarSourceKey}
        uri={uri}
        variants={variants}
      />
    </View>
  );
}
