import React from "react";
import { Pressable, Text, View } from "react-native";
import { Calendar, ChevronRight } from "lucide-react-native";
import { Avatar } from "../../../../shared/components";
import { tokens } from "../../../../shared/theme";
import type { NotificationItem } from "../../data";
import {
  getNotificationIconBg,
  mapNotificationIcon,
} from "../../application/notificationsPresentation";
import { buildNotificationCardContent } from "../../application/notificationCardContent";
import { resolveRequestActionDisplayState } from "../../domain/followRequestState";
import { FollowRequestActionButtons } from "./FollowRequestActionButtons";

type Props = {
  item: NotificationItem;
  pendingFollowRequestSet: Set<string>;
  processedFollowAction?: "accept" | "reject";
  followPending: boolean;
  followPendingAction?: "accept" | "reject";
  onOpenProfile: (username: string) => void;
  onPress: () => void;
  onFollowAction: (item: NotificationItem, action: "accept" | "reject") => void;
};

export const NotificationListItem = React.memo(function NotificationListItem({
  item,
  pendingFollowRequestSet,
  processedFollowAction,
  followPending,
  followPendingAction,
  onOpenProfile,
  onPress,
  onFollowAction,
}: Props) {
  const Icon = mapNotificationIcon(item.type);
  const cardContent = buildNotificationCardContent(item);
  const requesterUsername = String(item.fromUsername || "")
    .trim()
    .toLowerCase();
  const isFollowRequest = item.type === "follow_request";
  const {
    acceptSelected: followAcceptSelected,
    rejectSelected: followRejectSelected,
    selectedAction: followSelectedAction,
    statusLabel: followStatusLabel,
  } = resolveRequestActionDisplayState({
    pendingAction: followPendingAction,
    processedAction: processedFollowAction,
    requestStatus: item.requestStatus,
  });
  const canShowFollowActions =
    isFollowRequest &&
    item.requestStatus !== "accepted" &&
    item.requestStatus !== "rejected" &&
    pendingFollowRequestSet.has(requesterUsername) &&
    Boolean(requesterUsername);
  const showFollowActions = canShowFollowActions || Boolean(followSelectedAction);
  const followActionsLocked =
    followPending ||
    Boolean(processedFollowAction) ||
    item.requestStatus === "accepted" ||
    item.requestStatus === "rejected";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        borderRadius: 14,
        borderWidth: 1,
        borderColor: item.read ? "rgba(15,23,42,0.08)" : "rgba(37,99,235,0.35)",
        backgroundColor: item.read ? tokens.colors.surface : tokens.colors.surfaceTint,
        paddingHorizontal: 12,
        paddingVertical: 11,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <Pressable
        accessibilityLabel={`${item.fromName} profilini ac`}
        accessibilityRole="button"
        onPress={() => onOpenProfile(item.fromUsername)}
        style={{ minHeight: tokens.minHeight.touchTarget, minWidth: tokens.minHeight.touchTarget }}
      >
        <Avatar
          uri={item.fromImage}
          variants={item.fromImageVariants}
          name={item.fromName}
          size={42}
        />
      </Pressable>

      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          backgroundColor: getNotificationIconBg(item.type),
          alignItems: "center",
          justifyContent: "center",
          marginTop: 10,
          marginLeft: -20,
          borderWidth: 1.5,
          borderColor: tokens.colors.surface,
        }}
      >
        <Icon size={11} color={tokens.colors.dark700} />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: tokens.colors.foreground,
            fontSize: 13,
            fontWeight: "700",
            lineHeight: 18,
          }}
        >
          {cardContent.actorName}{" "}
          <Text style={{ color: tokens.colors.dark600, fontWeight: "500" }}>
            {cardContent.actionText}
          </Text>
        </Text>
        {cardContent.contextTitle ? (
          <Text
            style={{
              marginTop: 2,
              color: tokens.colors.muted,
              fontSize: tokens.typography.caption,
              lineHeight: 17,
            }}
            numberOfLines={2}
          >
            <Text style={{ color: tokens.colors.dark600, fontWeight: "700" }}>
              {cardContent.contextLabel}:
            </Text>{" "}
            {cardContent.contextTitle}
          </Text>
        ) : null}
        {cardContent.previewText ? (
          <Text
            style={{
              marginTop: 3,
              color: tokens.colors.muted,
              fontSize: tokens.typography.caption,
              lineHeight: 17,
            }}
            numberOfLines={2}
          >
            {`“${cardContent.previewText}”`}
          </Text>
        ) : null}
        {cardContent.contextSubtitle ? (
          <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Calendar size={12} color={tokens.colors.muted} />
            <Text
              style={{ color: tokens.colors.muted, fontSize: tokens.typography.caption }}
              numberOfLines={1}
            >
              {cardContent.contextSubtitle}
            </Text>
          </View>
        ) : null}
        <Text
          style={{
            marginTop: 6,
            color: tokens.colors.muted,
            fontSize: tokens.typography.caption,
            fontWeight: "600",
          }}
        >
          {item.time}
        </Text>

        {showFollowActions ? (
          <View style={{ marginTop: 7, gap: 6 }}>
            <FollowRequestActionButtons
              acceptSelected={followAcceptSelected}
              disabled={!canShowFollowActions || followActionsLocked}
              onAccept={(event) => {
                event.stopPropagation();
                onFollowAction(item, "accept");
              }}
              onReject={(event) => {
                event.stopPropagation();
                onFollowAction(item, "reject");
              }}
              rejectSelected={followRejectSelected}
              statusLabel={followStatusLabel}
              variant="list"
            />
          </View>
        ) : null}
      </View>

      <View style={{ alignItems: "center", justifyContent: "center", gap: 6 }}>
        {!item.read ? (
          <View
            accessibilityLabel="Okunmamis"
            style={{
              width: 7,
              height: 7,
              borderRadius: 99,
              backgroundColor: tokens.colors.primary,
            }}
          />
        ) : null}
        <ChevronRight size={15} color={tokens.colors.borderLight} />
      </View>
    </Pressable>
  );
});
