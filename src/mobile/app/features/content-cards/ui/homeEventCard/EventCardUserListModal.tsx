import React from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { AppModalHost, Avatar } from "../../../../shared/components";
import type { SearchUserResult } from "../../data";

type Props = {
  count: number;
  data: SearchUserResult[];
  emptyText: string;
  loading: boolean;
  modalBottomPadding: number;
  onClose: () => void;
  onOpenUser: (username: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  title: string;
  visible: boolean;
};

export function EventCardUserListModal({
  count,
  data,
  emptyText,
  loading,
  modalBottomPadding,
  onClose,
  onOpenUser,
  onRefresh,
  refreshing,
  title,
  visible,
}: Props) {
  const resolvedCount = Math.max(Number(count || 0), data.length);
  return (
    <AppModalHost
      accessibilityAnnouncement={title}
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(2,6,23,0.45)",
          justifyContent: "flex-end",
          paddingHorizontal: 12,
          paddingTop: 12,
          paddingBottom: modalBottomPadding,
        }}
      >
        <Pressable
          onPress={(eventPress) => eventPress.stopPropagation()}
          style={{
            borderRadius: 16,
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: "#e2e8f0",
            height: "70%",
            overflow: "hidden",
          }}
        >
          <View
            style={{
              minHeight: 50,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 14,
              borderBottomWidth: 1,
              borderBottomColor: "#e2e8f0",
            }}
          >
            <Text style={{ color: "#0f172a", fontSize: 15, fontWeight: "700" }}>{title}</Text>
            <Text style={{ color: "#64748b", fontSize: 12, fontWeight: "700" }}>
              {resolvedCount}
            </Text>
          </View>
          {loading ? (
            <View style={{ padding: 16 }}>
              <Text style={{ color: "#64748b", fontSize: 13 }}>Yukleniyor...</Text>
            </View>
          ) : (
            <FlatList
              data={data}
              keyExtractor={(item) => item.id}
              alwaysBounceVertical
              overScrollMode="always"
              contentContainerStyle={{ flexGrow: 1, padding: 12, gap: 8 }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onOpenUser(item.username)}
                  style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10 }}
                >
                  <Avatar uri={item.image} name={item.name} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ color: "#0f172a", fontSize: 13, fontWeight: "700" }}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text style={{ color: "#64748b", fontSize: 11 }} numberOfLines={1}>
                      {item.university || "Üniversite bilgisi yok"}
                    </Text>
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={{ color: "#64748b", fontSize: 12 }}>{emptyText}</Text>
              }
            />
          )}
        </Pressable>
      </Pressable>
    </AppModalHost>
  );
}
