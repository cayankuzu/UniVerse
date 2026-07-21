import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { AppModalHost, Avatar } from "../../../../shared/components";
import type { SearchUserResult } from "../../data";
import { tokens, withAlpha } from "../../../../shared/theme";

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
          backgroundColor: withAlpha(tokens.colors.dark950, 0.45),
          justifyContent: "flex-end",
          paddingHorizontal: tokens.spacing.sm,
          paddingTop: tokens.spacing.sm,
          paddingBottom: modalBottomPadding,
        }}
      >
        <Pressable
          onPress={(eventPress) => eventPress.stopPropagation()}
          style={{
            borderRadius: tokens.radius.lg,
            backgroundColor: tokens.colors.onMedia,
            borderWidth: 1,
            borderColor: tokens.colors.border,
            height: "70%",
            overflow: "hidden",
          }}
        >
          <View
            style={{
              minHeight: tokens.minHeight.row,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: tokens.spacing.smPlus,
              borderBottomWidth: 1,
              borderBottomColor: tokens.colors.border,
            }}
          >
            <Text
              style={{
                color: tokens.colors.foreground,
                fontSize: tokens.typography.control,
                fontWeight: "700",
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                color: tokens.colors.muted,
                fontSize: tokens.typography.caption,
                fontWeight: "700",
              }}
            >
              {resolvedCount}
            </Text>
          </View>
          {loading ? (
            <View style={{ padding: tokens.spacing.md }}>
              <Text style={{ color: tokens.colors.muted, fontSize: tokens.typography.label }}>
                Yükleniyor...
              </Text>
            </View>
          ) : (
            <FlatList
              data={data}
              keyExtractor={(item) => item.id}
              alwaysBounceVertical
              overScrollMode="always"
              contentContainerStyle={{
                flexGrow: 1,
                padding: tokens.spacing.sm,
                gap: tokens.spacing.xs,
              }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={tokens.colors.primary}
                />
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onOpenUser(item.username)}
                  style={{
                    minHeight: 44,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: tokens.spacing.compact,
                  }}
                >
                  <Avatar uri={item.image} name={item.name} size={32} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: tokens.colors.foreground,
                        fontSize: tokens.typography.label,
                        fontWeight: "700",
                      }}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={{ color: tokens.colors.muted, fontSize: tokens.typography.caption }}
                      numberOfLines={1}
                    >
                      {item.university || "Üniversite bilgisi yok"}
                    </Text>
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={{ color: tokens.colors.muted, fontSize: tokens.typography.caption }}>
                  {emptyText}
                </Text>
              }
            />
          )}
        </Pressable>
      </Pressable>
    </AppModalHost>
  );
}
