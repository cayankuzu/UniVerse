import React from "react";
import { ActivityIndicator, Text, View } from "react-native";

type Props = {
  status: "failed" | "pending" | "uploading";
};

export function EventPendingActions({ status }: Props) {
  const isFailed = status === "failed";
  const backgroundColor = isFailed ? "rgba(127,29,29,0.9)" : "rgba(15,23,42,0.78)";
  const label = isFailed ? "Yükleme Hatasi" : "Yükleniyor";

  return (
    <View
      style={{
        position: "absolute",
        right: 10,
        bottom: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      <View
        style={{
          borderRadius: 10,
          backgroundColor,
          paddingHorizontal: 10,
          paddingVertical: 6,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {isFailed ? null : <ActivityIndicator size="small" color="#fff" />}
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{label}</Text>
        </View>
      </View>
    </View>
  );
}
