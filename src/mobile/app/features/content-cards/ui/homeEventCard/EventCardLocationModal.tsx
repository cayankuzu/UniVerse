import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Pressable, View } from "react-native";
import { Check, Copy } from "lucide-react-native";
import type { EventWithMeta } from "../../data";
import { AppModalHost } from "../../../../shared/components";
import { tokens, withAlpha } from "../../../../shared/theme";

type Props = {
  copiedField: "location" | "address" | null;
  event: EventWithMeta;
  modalBottomPadding: number;
  onClose: () => void;
  onCopyText: (value: string, field: "location" | "address") => Promise<void>;
  visible: boolean;
};

export function EventCardLocationModal({
  copiedField,
  event,
  modalBottomPadding,
  onClose,
  onCopyText,
  visible,
}: Props) {
  return (
    <AppModalHost
      accessibilityAnnouncement="Konum bilgisi"
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
            padding: tokens.spacing.smPlus,
            gap: tokens.spacing.xs,
          }}
        >
          <View
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <Text
              style={{
                color: tokens.colors.foreground,
                fontSize: tokens.typography.control,
                fontWeight: "700",
              }}
            >
              Konum
            </Text>
            <CopyIconButton
              copied={copiedField === "location"}
              disabled={!String(event.location || "").trim()}
              onPress={() => void onCopyText(event.location || "", "location")}
            />
          </View>
          <Text
            style={{
              color: tokens.colors.dark700,
              fontSize: tokens.typography.body,
              fontWeight: "700",
            }}
          >
            {event.location || "-"}
          </Text>
          <Text style={{ color: tokens.colors.muted, fontSize: tokens.typography.caption }}>
            {event.university || ""}
          </Text>
          <View style={{ marginTop: tokens.spacing.micro, gap: tokens.spacing.xsMinus }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  color: tokens.colors.muted,
                  fontSize: tokens.typography.caption,
                  fontWeight: "700",
                }}
              >
                Adres
              </Text>
              <CopyIconButton
                copied={copiedField === "address"}
                disabled={!String(event.address || event.location || "").trim()}
                onPress={() => void onCopyText(event.address || event.location || "", "address")}
              />
            </View>
            <Text
              style={{
                color: tokens.colors.dark600,
                fontSize: tokens.typography.caption,
                lineHeight: tokens.lineHeight.label,
              }}
            >
              {event.address || event.location || "-"}
            </Text>
          </View>
        </Pressable>
      </Pressable>
    </AppModalHost>
  );
}

type CopyIconButtonProps = {
  copied: boolean;
  disabled: boolean;
  onPress: () => void;
};

function CopyIconButton({ copied, disabled, onPress }: CopyIconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        width: 28,
        height: 28,
        borderRadius: tokens.radius.sm,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tokens.colors.background,
        borderWidth: 1,
        borderColor: tokens.colors.border,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {copied ? (
        <Check size={14} color={tokens.colors.successIcon} />
      ) : (
        <Copy size={14} color={tokens.colors.muted} />
      )}
    </Pressable>
  );
}
