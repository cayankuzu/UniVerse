import React from "react";
import { AppText as Text } from "../../../shared/components/AppText";
import { ActivityIndicator, View } from "react-native";
import { tokens, withAlpha } from "../../../shared/theme";

type Props = {
  status: "failed" | "pending" | "uploading";
};

export function EventPendingActions({ status }: Props) {
  const isFailed = status === "failed";
  const backgroundColor = isFailed
    ? withAlpha(tokens.colors.dangerDeep, 0.9)
    : withAlpha(tokens.colors.foreground, 0.78);
  const label = isFailed ? "Yükleme Hatasi" : "Yükleniyor";

  return (
    <View
      style={{
        position: "absolute",
        right: 10,
        bottom: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.xsMinus,
      }}
    >
      <View
        style={{
          borderRadius: tokens.radius.compact,
          backgroundColor,
          paddingHorizontal: tokens.spacing.compact,
          paddingVertical: tokens.spacing.xsMinus,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.xsMinus }}>
          {isFailed ? null : <ActivityIndicator size="small" color={tokens.colors.onMedia} />}
          <Text
            style={{
              color: tokens.colors.onMedia,
              fontSize: tokens.typography.tiny,
              fontWeight: "700",
            }}
          >
            {label}
          </Text>
        </View>
      </View>
    </View>
  );
}
