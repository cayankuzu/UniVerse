import React from "react";
import { Pressable, Text, View } from "react-native";
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
        marginBottom: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#ddd6fe",
        backgroundColor: "#faf5ff",
        overflow: "hidden",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        <UserPlus size={15} color="#7c3aed" />
        <Text style={{ flex: 1, color: "#581c87", fontSize: 13, fontWeight: "700" }}>
          Takip istekleri
        </Text>
        <View
          style={{
            borderRadius: 999,
            backgroundColor: "#ede9fe",
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
        >
          <Text style={{ color: "#6d28d9", fontSize: tokens.typography.tiny, fontWeight: "800" }}>
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
              gap: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: "#ede9fe",
              backgroundColor: "#ffffff",
            }}
          >
            <Pressable
              accessibilityLabel={`${request.name} profilini ac`}
              accessibilityRole="button"
              onPress={() => onOpenProfile(request.username)}
              style={{
                minHeight: tokens.minHeight.touchTarget,
                minWidth: tokens.minHeight.touchTarget,
              }}
            >
              <Avatar uri={request.image} name={request.name} size={42} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Pressable accessibilityRole="button" onPress={() => onOpenProfile(request.username)}>
                <Text
                  style={{ color: "#0f172a", fontSize: 13, fontWeight: "700" }}
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
                  marginTop: 1,
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
