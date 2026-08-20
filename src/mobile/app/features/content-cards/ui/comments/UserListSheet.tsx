import { Pressable, View } from "react-native";
import { AppText as Text } from "../../../../shared/components/AppText";
import type { SearchUserResult } from "../../data";
import { AppFlatList, AppModalHost, Avatar } from "../../../../shared/components";
import { tokens, withAlpha } from "../../../../shared/theme";

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
          accessible={false}
          onPress={onClose}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: withAlpha(tokens.colors.textStrong, 0.22),
          }}
        />
        <View
          style={{
            height: "62%",
            marginBottom: bottomInset,
            marginHorizontal: tokens.spacing.sm,
            borderRadius: tokens.radius["2xl"],
            backgroundColor: tokens.colors.onMedia,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              minHeight: tokens.minHeight.row,
              paddingHorizontal: tokens.spacing.md,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottomWidth: 1,
              borderBottomColor: tokens.colors.neutralSurface,
            }}
          >
            <Text
              style={{
                color: tokens.colors.textStrong,
                fontSize: tokens.typography.subtitle,
                fontWeight: "800",
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                color: tokens.colors.neutralText,
                fontSize: tokens.typography.caption,
                fontWeight: "700",
              }}
            >
              {resolvedCount}
            </Text>
          </View>

          {loading ? (
            <View style={{ padding: tokens.spacing.md }}>
              <Text style={{ color: tokens.colors.neutralText, fontSize: tokens.typography.label }}>
                Yükleniyor...
              </Text>
            </View>
          ) : (
            <AppFlatList
              data={users}
              estimatedItemSize={64}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{
                flexGrow: 1,
                padding: tokens.spacing.smPlus,
                gap: tokens.spacing.compact,
              }}
              onRefresh={onRefresh}
              refreshing={refreshing}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onOpenUser?.(item.username)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name || item.username} profilini aç`}
                  style={{
                    minHeight: 46,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: tokens.spacing.compact,
                  }}
                >
                  <Avatar
                    uri={item.image}
                    variants={item.imageVariants}
                    name={item.name}
                    size={34}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: tokens.colors.textStrong,
                        fontSize: tokens.typography.body,
                        fontWeight: "700",
                      }}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={{
                        color: tokens.colors.neutralText,
                        fontSize: tokens.typography.caption,
                      }}
                      numberOfLines={1}
                    >
                      @{item.username}
                    </Text>
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text
                  style={{ color: tokens.colors.neutralText, fontSize: tokens.typography.label }}
                >
                  {emptyText}
                </Text>
              }
            />
          )}
        </View>
      </View>
    </AppModalHost>
  );
}
