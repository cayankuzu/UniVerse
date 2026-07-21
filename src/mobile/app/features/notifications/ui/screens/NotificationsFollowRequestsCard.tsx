import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Pressable, View } from "react-native";
import { UserPlus } from "lucide-react-native";
import { Avatar } from "../../../../shared/components";
import { tokens } from "../../../../shared/theme";
import {
  resolveRequestActionDisplayState,
  resolveVisibleFollowRequestStateKey,
} from "../../domain/followRequestState";
import type { UIFollowRequest } from "../../model/types";
import { FollowRequestActionButtons } from "./FollowRequestActionButtons";

type Props = {
  requests: UIFollowRequest[];
  pendingActions: Record<string, "accept" | "reject">;
  processedActions: Record<string, "accept" | "reject">;
  onOpenProfile: (username: string) => void;
  onAction: (request: UIFollowRequest, action: "accept" | "reject") => void;
};

export function NotificationsFollowRequestsCard({
  requests,
  pendingActions,
  processedActions,
  onOpenProfile,
  onAction,
}: Props) {
  if (requests.length === 0) return null;

  return (
    <View
      style={{
        marginBottom: tokens.spacing.compact,
        borderRadius: tokens.radius.control,
        borderWidth: 1,
        borderColor: tokens.colors.primaryBorder,
        backgroundColor: tokens.colors.primarySofter,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.xsMinus,
          paddingHorizontal: tokens.spacing.sm,
          paddingVertical: tokens.spacing.compact,
        }}
      >
        <UserPlus size={15} color={tokens.colors.primary} />
        <Text
          style={{
            flex: 1,
            color: tokens.colors.primaryDeep,
            fontSize: tokens.typography.label,
            fontWeight: "700",
          }}
        >
          Takip istekleri
        </Text>
        <View
          style={{
            borderRadius: tokens.radius.pill,
            backgroundColor: tokens.colors.primarySoft,
            paddingHorizontal: tokens.spacing.xs,
            paddingVertical: tokens.spacing.micro,
          }}
        >
          <Text
            style={{
              color: tokens.colors.primaryDark,
              fontSize: tokens.typography.tiny,
              fontWeight: "800",
            }}
          >
            {requests.length > 99 ? "99+" : requests.length}
          </Text>
        </View>
      </View>

      {requests.map((request, index) => {
        const requestStateKey = resolveVisibleFollowRequestStateKey(request);
        const pendingAction = pendingActions[requestStateKey];
        const processedAction = processedActions[requestStateKey];
        const { acceptSelected, rejectSelected, statusLabel } = resolveRequestActionDisplayState({
          pendingAction,
          processedAction,
          requestStatus: request.requestStatus,
        });
        const canTakeAction =
          request.requestStatus !== "accepted" && request.requestStatus !== "rejected";
        const actionsLocked = Boolean(pendingAction || processedAction || !canTakeAction);

        return (
          <View
            key={requestStateKey}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.compact,
              paddingHorizontal: tokens.spacing.sm,
              paddingVertical: tokens.spacing.compact,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: tokens.colors.primarySoft,
              backgroundColor: tokens.colors.onMedia,
            }}
          >
            <Pressable
              accessibilityLabel={`${request.name} profilini aç`}
              accessibilityRole="button"
              onPress={() => onOpenProfile(request.username)}
              style={{
                minHeight: tokens.minHeight.row,
                minWidth: tokens.minHeight.row,
              }}
            >
              <Avatar uri={request.image} name={request.name} size={34} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Pressable accessibilityRole="button" onPress={() => onOpenProfile(request.username)}>
                <Text
                  style={{
                    color: tokens.colors.foreground,
                    fontSize: tokens.typography.label,
                    fontWeight: "700",
                  }}
                  numberOfLines={1}
                >
                  {request.name}
                </Text>
              </Pressable>
              <Text style={{ color: tokens.colors.muted, fontSize: tokens.typography.caption }}>
                seni takip etmek istiyor
              </Text>
              <Text
                style={{
                  color: tokens.colors.muted,
                  fontSize: tokens.typography.caption,
                  marginTop: tokens.spacing.hairline,
                }}
              >
                {request.time}
              </Text>
            </View>
            <FollowRequestActionButtons
              acceptSelected={acceptSelected}
              disabled={actionsLocked}
              onAccept={() => {
                onAction(request, "accept");
              }}
              onReject={() => {
                onAction(request, "reject");
              }}
              rejectSelected={rejectSelected}
              statusLabel={statusLabel}
              variant="card"
            />
          </View>
        );
      })}
    </View>
  );
}
