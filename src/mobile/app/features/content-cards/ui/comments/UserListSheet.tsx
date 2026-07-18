import { Pressable, Text, View } from "react-native";
import type { SearchUserResult } from "../../data";
import { AppFlatList, AppModalHost, Avatar } from "../../../../shared/components";

type Props = {
  visible: boolean;
  title: string;
  count?: number;
  users: SearchUserResult[];
  loading?: boolean;
  refreshing?: boolean;
  emptyText?: string;
  bottomInset?: number;
  onClose: () => void;
  onOpenUser?: (username: string) => void;
  onRefresh?: () => void;
};

export function UserListSheet({
  visible,
  title,
  count,
  users,
  loading = false,
  refreshing = false,
  emptyText = "Liste bos.",
  bottomInset = 12,
  onClose,
  onOpenUser,
  onRefresh,
}: Props) {
  const resolvedCount = Math.max(Number(count || 0), users.length);
  return (
    <AppModalHost
      accessibilityAnnouncement={title}
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          onPress={onClose}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: "rgba(17,24,39,0.22)",
          }}
        />
        <View
          style={{
            height: "62%",
            marginBottom: bottomInset,
            marginHorizontal: 12,
            borderRadius: 24,
            backgroundColor: "#ffffff",
            overflow: "hidden",
          }}
        >
          <View
            style={{
              minHeight: 56,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottomWidth: 1,
              borderBottomColor: "#f3f4f6",
            }}
          >
            <Text style={{ color: "#111827", fontSize: 16, fontWeight: "800" }}>{title}</Text>
            <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "700" }}>
              {resolvedCount}
            </Text>
          </View>

          {loading ? (
            <View style={{ padding: 16 }}>
              <Text style={{ color: "#6b7280", fontSize: 13 }}>Yukleniyor...</Text>
            </View>
          ) : (
            <AppFlatList
              data={users}
              estimatedItemSize={64}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ flexGrow: 1, padding: 14, gap: 10 }}
              onRefresh={onRefresh}
              refreshing={refreshing}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onOpenUser?.(item.username)}
                  style={{
                    minHeight: 46,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Avatar
                    uri={item.image}
                    variants={item.imageVariants}
                    name={item.name}
                    size={40}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ color: "#111827", fontSize: 14, fontWeight: "700" }}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text style={{ color: "#6b7280", fontSize: 12 }} numberOfLines={1}>
                      @{item.username}
                    </Text>
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={{ color: "#9ca3af", fontSize: 13 }}>{emptyText}</Text>
              }
            />
          )}
        </View>
      </View>
    </AppModalHost>
  );
}
