import React, { memo, useDeferredValue, useMemo, useState } from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Pressable, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Lock, UserCheck } from "lucide-react-native";
import { tokens } from "../../../../shared/theme";
import { t } from "../../../../shared/i18n";
import {
  AppFlatList,
  Avatar,
  BackHeader,
  GradientButton,
  ListSearchBar,
} from "../../../../shared/components";
import { useBottomNavPadding } from "../../../../shared/layout/bottomNavSpacing";
import { filterUserListItems } from "../../../../shared/search/userListSearch";
import { useAuth } from "../../../../app-shell/auth";
import type { RootStackParamList } from "../../../../app-shell/navigation/types";
import { useOpenProfile } from "../../../../app-shell/navigation/hooks/useIntentNavigation";
import type { RelationshipProjectionItem } from "../../data";
import { useRelationshipList } from "../../application/useRelationshipList";
import { useRelationshipUserRowState } from "../../application/useRelationshipUserRowState";

type Props = NativeStackScreenProps<RootStackParamList, "UserList">;

interface UserRowProps {
  item: RelationshipProjectionItem;
  isOwnFollowingList: boolean;
  listKey: readonly unknown[];
  onPress: () => void;
  viewerId?: string;
  viewerKey: string;
  viewerUsername: string;
}

function UserRow({
  item,
  isOwnFollowingList,
  listKey,
  onPress,
  viewerId,
  viewerKey,
  viewerUsername,
}: UserRowProps) {
  const { followStatus, handlePressIn, handleToggleFollow, isPending, isPrivate } =
    useRelationshipUserRowState({
      isOwnFollowingList,
      item,
      listKey,
      viewerId,
      viewerKey,
      viewerUsername,
    });

  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: tokens.colors.surface,
        borderColor: tokens.colors.border,
        borderRadius: tokens.radius.control,
        borderWidth: 1,
        flexDirection: "row",
        gap: tokens.spacing.sm,
        paddingHorizontal: tokens.spacing.smPlus,
        paddingVertical: tokens.spacing.compact,
      }}
    >
      <Pressable
        accessibilityLabel={t("relationships.a11y.openProfile", { username: item.username })}
        accessibilityRole="button"
        onPressIn={handlePressIn}
        onPress={onPress}
        style={{ alignItems: "center", flex: 1, flexDirection: "row", gap: tokens.spacing.compact }}
      >
        <Avatar uri={item.image} name={item.name} size={38} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: tokens.colors.foreground,
              fontSize: tokens.typography.body,
              fontWeight: tokens.fontWeight.bold,
            }}
            numberOfLines={1}
          >
            {item.name || item.username}
          </Text>
          <Text
            style={{
              color: tokens.colors.muted,
              fontSize: tokens.typography.caption,
              marginTop: tokens.spacing.micro,
            }}
            numberOfLines={1}
          >
            {item.university || t("common.university.missing")}
          </Text>
          {isPrivate ? (
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                gap: tokens.spacing.xxs,
                marginTop: tokens.spacing.micro,
              }}
            >
              <Lock size={tokens.typography.tiny} color={tokens.colors.warningIcon} />
              <Text
                style={{
                  color: tokens.colors.warningIcon,
                  fontSize: tokens.typography.tiny,
                  fontWeight: tokens.fontWeight.bold,
                }}
              >
                {t("relationships.private")}
              </Text>
            </View>
          ) : null}
          {item.time ? (
            <Text
              style={{
                color: tokens.colors.muted,
                fontSize: tokens.typography.tiny,
                marginTop: tokens.spacing.hairline,
              }}
            >
              {item.time}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <GradientButton
        accessibilityLabel={t("relationships.a11y.followToggle", { username: item.username })}
        icon={
          followStatus === "following" ? (
            <UserCheck size={14} color={tokens.colors.dark700} />
          ) : isPrivate ? (
            <Lock size={13} color={tokens.colors.warningText} />
          ) : undefined
        }
        label={
          followStatus === "following"
            ? t("relationships.follow.status.following")
            : followStatus === "requested"
              ? t("relationships.follow.status.requested")
              : isPrivate
                ? t("relationships.follow.status.private")
                : t("relationships.follow.status.none")
        }
        loading={isPending}
        onPress={handleToggleFollow}
        size="sm"
        variant={
          followStatus === "following"
            ? "secondary"
            : followStatus === "requested"
              ? "ghost"
              : isPrivate
                ? "ghost"
                : "primary"
        }
      />
    </View>
  );
}

const MemoUserRow = memo(UserRow);

export function UserListScreen({ route, navigation }: Props) {
  const { isBlocked, userData } = useAuth();
  const bottomPadding = useBottomNavPadding(10, 20);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const openProfile = useOpenProfile(navigation, userData);
  const type = route.params?.type === "following" ? "following" : "followers";
  const targetUsername = route.params?.username || userData.username;
  const { data, listKey, projection, viewerKey, viewerUsername } = useRelationshipList({
    isBlocked,
    targetUsername,
    type,
    viewer: {
      id: userData.id,
      username: userData.username,
    },
  });
  const title =
    type === "followers" ? t("relationships.title.followers") : t("relationships.title.following");
  const filteredData = useMemo(
    () => filterUserListItems(data, deferredSearchQuery),
    [data, deferredSearchQuery],
  );
  const isSearching = searchQuery.trim().length > 0;
  const visibleCountLabel = isSearching
    ? `${filteredData.length}/${data.length}`
    : String(data.length);

  return (
    <View style={{ backgroundColor: tokens.colors.background, flex: 1 }}>
      <BackHeader
        onBack={() => navigation.goBack()}
        right={
          data.length > 0 ? (
            <Text
              style={{
                color: tokens.colors.muted,
                fontSize: tokens.typography.label,
                fontWeight: tokens.fontWeight.semibold,
              }}
            >
              {visibleCountLabel}
            </Text>
          ) : undefined
        }
        title={title}
      />
      <View style={{ paddingHorizontal: tokens.spacing.md, paddingTop: tokens.spacing.sm }}>
        <ListSearchBar
          accessibilityLabel={t("relationships.search.a11y")}
          onChangeText={setSearchQuery}
          placeholder={t("relationships.search.placeholder")}
          value={searchQuery}
        />
      </View>

      <AppFlatList<RelationshipProjectionItem>
        contentContainerStyle={{
          gap: tokens.spacing.xs,
          paddingHorizontal: tokens.spacing.md,
          paddingBottom: bottomPadding,
          paddingTop: tokens.spacing.compact,
        }}
        data={filteredData}
        emptyText={
          isSearching
            ? t("relationships.empty.search")
            : type === "followers"
              ? t("relationships.empty.followers")
              : t("relationships.empty.following")
        }
        estimatedItemSize={96}
        error={projection.query.error ? t("relationships.error.load") : null}
        hasMore={projection.hasMore}
        keyExtractor={(item) => item.id}
        loading={projection.shouldShowInitialSkeleton}
        loadingMore={projection.loadingMore}
        onEndReached={() => void projection.loadMore()}
        onEndReachedThreshold={0.65}
        onRefresh={projection.onRefresh}
        performanceTier="tier2"
        refreshing={projection.refreshing}
        getItemType={() => "relationship-row"}
        renderItem={({ item }) => (
          <MemoUserRow
            isOwnFollowingList={type === "following" && targetUsername === viewerUsername}
            item={item}
            listKey={listKey}
            onPress={() => openProfile(item.username)}
            viewerId={userData.id}
            viewerKey={viewerKey}
            viewerUsername={viewerUsername}
          />
        )}
      />
    </View>
  );
}
