import React, { useState } from "react";
import { AccessibilityInfo, Alert, Pressable, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Text } from "react-native-paper";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ban, Lock } from "lucide-react-native";
import { useAuth } from "../../../../app-shell/auth";
import { useOpenProfile } from "../../../../app-shell/navigation/hooks/useIntentNavigation";
import { tokens } from "../../../../shared/theme";
import { t } from "../../../../shared/i18n";
import {
  AppButton,
  AppFlatList,
  AppImage,
  BackHeader,
  EmptyState,
} from "../../../../shared/components";
import { useBottomNavPadding } from "../../../../shared/layout/bottomNavSpacing";
import type { RootStackParamList } from "../../../../app-shell/navigation/types";
import { useBlockedUsersScreenState } from "../../application/useBlockedUsersScreenState";

type Props = NativeStackScreenProps<RootStackParamList, "BlockedUsers">;

function getInitials(name: string) {
  return (
    String(name || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toLocaleUpperCase("tr-TR") || "")
      .join("") || "?"
  );
}

export function BlockedUsersScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const bottomPadding = useBottomNavPadding(10, 26);
  const { blockedUsers, unblockUser, userData } = useAuth();
  const openProfile = useOpenProfile(navigation, userData);
  const { blockedData, blockedProjection, handleBack, handleUnblock, shouldShowInitialSkeleton } =
    useBlockedUsersScreenState({
      blockedUsernames: blockedUsers,
      goBack: () => {
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
      },
      openProfile,
      unblockUser: async (username) => {
        await unblockUser(username);
      },
      userData,
    });
  const [busyUsername, setBusyUsername] = useState<string | null>(null);

  const confirmUnblock = (username: string) => {
    Alert.alert(
      t("settings.blockedUsers.unblock.confirmTitle"),
      t("settings.blockedUsers.unblock.confirmMessage", { username: `@${username}` }),
      [
        {
          style: "cancel",
          text: t("common.cancel"),
        },
        {
          style: "destructive",
          text: t("settings.blockedUsers.unblock.action"),
          onPress: async () => {
            setBusyUsername(username);
            try {
              const didUnblock = await handleUnblock(username);
              if (didUnblock) {
                AccessibilityInfo.announceForAccessibility(
                  t("settings.blockedUsers.unblock.success", { username: `@${username}` }),
                );
              }
            } finally {
              setBusyUsername((current) => (current === username ? null : current));
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.colors.background }} edges={["bottom"]}>
      <BackHeader title={t("settings.blockedUsers.title")} onBack={handleBack} />

      <View
        style={{
          paddingHorizontal: tokens.spacing.md,
          paddingVertical: tokens.spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: tokens.colors.divider,
        }}
      >
        <Text style={{ color: tokens.colors.muted, fontSize: tokens.typography.caption }}>
          {t("settings.blockedUsers.count", { count: blockedData.length })}
        </Text>
      </View>

      <AppFlatList
        data={blockedData}
        estimatedItemSize={96}
        keyExtractor={(user) => user.userId || user.username}
        ListEmptyComponent={
          !shouldShowInitialSkeleton ? (
            <EmptyState
              icon={<Ban size={42} color={tokens.colors.iconMuted} strokeWidth={1.7} />}
              subtitle={t("settings.blockedUsers.empty.subtitle")}
              title={t("settings.blockedUsers.empty.title")}
            />
          ) : undefined
        }
        contentContainerStyle={{
          paddingBottom: Math.max(bottomPadding, insets.bottom + tokens.spacing.md),
        }}
        loading={shouldShowInitialSkeleton}
        onRefresh={blockedProjection.onRefresh}
        performanceTier="tier2"
        refreshing={blockedProjection.refreshing}
        renderItem={({ item: user }) => (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.sm,
              backgroundColor: tokens.colors.surface,
              borderBottomWidth: 1,
              borderBottomColor: tokens.colors.divider,
              paddingHorizontal: tokens.spacing.md,
              paddingVertical: tokens.spacing.sm,
            }}
          >
            <Pressable
              accessibilityLabel={t("settings.blockedUsers.openProfile", {
                username: user.username,
              })}
              accessibilityRole="link"
              hitSlop={8}
              onPress={() => openProfile(user.username)}
            >
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: tokens.colors.surfaceVariant,
                  borderRadius: tokens.radius.pill,
                  height: 48,
                  justifyContent: "center",
                  overflow: "hidden",
                  width: 48,
                }}
              >
                {user.image ? (
                  <AppImage
                    uri={user.image}
                    style={{ width: 48, height: 48, borderRadius: tokens.radius.pill }}
                  />
                ) : (
                  <Text
                    style={{
                      color: tokens.colors.muted,
                      fontSize: tokens.typography.caption,
                      fontWeight: tokens.fontWeight.extrabold,
                    }}
                  >
                    {getInitials(user.name || user.username)}
                  </Text>
                )}
              </View>
            </Pressable>

            <Pressable
              accessibilityLabel={t("settings.blockedUsers.openProfile", {
                username: user.username,
              })}
              accessibilityRole="link"
              style={{ flex: 1 }}
              onPress={() => openProfile(user.username)}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text
                  style={{
                    flex: 1,
                    color: tokens.colors.text,
                    fontSize: tokens.typography.body,
                    fontWeight: tokens.fontWeight.bold,
                  }}
                  numberOfLines={1}
                >
                  {user.name || user.username}
                </Text>
                <View
                  style={{
                    borderRadius: tokens.radius.pill,
                    backgroundColor: tokens.colors.dangerSurface,
                    paddingHorizontal: tokens.spacing.xs,
                    paddingVertical: 3,
                  }}
                >
                  <Text
                    style={{
                      color: tokens.colors.danger,
                      fontSize: tokens.typography.micro,
                      fontWeight: tokens.fontWeight.extrabold,
                    }}
                  >
                    {t("settings.blockedUsers.badge")}
                  </Text>
                </View>
              </View>
              <Text
                style={{
                  marginTop: 2,
                  color: tokens.colors.muted,
                  fontSize: tokens.typography.caption,
                }}
                numberOfLines={1}
              >
                @{user.username}
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  color: tokens.colors.muted,
                  fontSize: tokens.typography.caption,
                }}
                numberOfLines={1}
              >
                {user.university || t("common.university.missing")}
              </Text>
              {user.isPrivate ? (
                <View
                  style={{
                    marginTop: 5,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: tokens.spacing.xxs,
                  }}
                >
                  <Lock size={tokens.iconSize.xs} color={tokens.colors.warning} strokeWidth={2} />
                  <Text
                    style={{
                      color: tokens.colors.warning,
                      fontSize: tokens.typography.tiny,
                      fontWeight: tokens.fontWeight.bold,
                    }}
                  >
                    {t("settings.blockedUsers.privateAccount")}
                  </Text>
                </View>
              ) : null}
            </Pressable>

            <AppButton
              accessibilityLabel={t("settings.blockedUsers.unblock.accessibilityLabel", {
                username: user.username,
              })}
              disabled={busyUsername === user.username}
              fullWidth={false}
              label={t("settings.blockedUsers.unblock.action")}
              loading={busyUsername === user.username}
              onPress={() => confirmUnblock(user.username)}
              size="sm"
              testID={`blocked-user-unblock-${user.username}`}
              variant="ghost"
            />
          </View>
        )}
      />
    </SafeAreaView>
  );
}
