import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Pressable, View } from "react-native";
import { Calendar, ChevronRight } from "lucide-react-native";
import { Avatar } from "../../../../shared/components";
import { tokens, withAlpha } from "../../../../shared/theme";
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
      accessibilityLabel={`${cardContent.actorName} ${cardContent.actionText}`}
      accessibilityRole="button"
      accessibilityState={{ selected: !item.read }}
      onPress={onPress}
      style={{
        borderRadius: tokens.radius.control,
        borderWidth: 1,
        borderColor: withAlpha(tokens.colors.foreground, 0.08),
        backgroundColor: item.read ? tokens.colors.surface : tokens.colors.surfaceTint,
        paddingHorizontal: tokens.spacing.sm,
        paddingVertical: tokens.spacing.compactPlus,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: tokens.spacing.compact,
      }}
    >
      <Pressable
        accessibilityLabel={`${item.fromName} profilini aç`}
        accessibilityRole="button"
        onPress={() => onOpenProfile(item.fromUsername)}
        style={{ minHeight: tokens.minHeight.row, minWidth: tokens.minHeight.row }}
      >
        <Avatar
          uri={item.fromImage}
          variants={item.fromImageVariants}
          name={item.fromName}
          size={34}
        />
      </Pressable>

      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: tokens.radius.pill,
          backgroundColor: getNotificationIconBg(item.type),
          alignItems: "center",
          justifyContent: "center",
          marginTop: tokens.spacing.compact,
          marginLeft: -16,
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
            fontSize: tokens.typography.label,
            fontWeight: "700",
            lineHeight: tokens.lineHeight.label,
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
              marginTop: tokens.spacing.micro,
              color: tokens.colors.muted,
              fontSize: tokens.typography.caption,
              lineHeight: tokens.lineHeight.caption,
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
              marginTop: tokens.spacing.microPlus,
              color: tokens.colors.muted,
              fontSize: tokens.typography.caption,
              lineHeight: tokens.lineHeight.caption,
            }}
            numberOfLines={2}
          >
            {`“${cardContent.previewText}”`}
          </Text>
        ) : null}
        {cardContent.contextSubtitle ? (
          <View
            style={{
              marginTop: tokens.spacing.xxs,
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.xxs,
            }}
          >
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
            marginTop: tokens.spacing.xsMinus,
            color: tokens.colors.muted,
            fontSize: tokens.typography.caption,
            fontWeight: "600",
          }}
        >
          {item.time}
        </Text>

        {showFollowActions ? (
          <View style={{ marginTop: tokens.spacing.xs, gap: tokens.spacing.xsMinus }}>
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

      <View style={{ alignItems: "center", justifyContent: "center", gap: tokens.spacing.xsMinus }}>
        {!item.read ? (
          <View
            accessibilityLabel="Okunmamış"
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
