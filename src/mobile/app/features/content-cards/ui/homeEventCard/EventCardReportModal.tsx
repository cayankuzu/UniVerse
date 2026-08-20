import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Pressable, View } from "react-native";
import { AppModalHost } from "../../../../shared/components";
import { tokens, withAlpha } from "../../../../shared/theme";

type Props = {
  modalBottomPadding: number;
  onClose: () => void;
  onReport: (reason: string) => Promise<void>;
  reportSubmitted: boolean;
  visible: boolean;
};

const REPORT_REASONS = [
  "Uygunsuz içerik",
  "Spam veya yanıltıcı",
  "Nefret söylemi",
  "Sahte etkinlik",
  "Diğer",
] as const;

export function EventCardReportModal({
  modalBottomPadding,
  onClose,
  onReport,
  reportSubmitted,
  visible,
}: Props) {
  return (
    <AppModalHost
      accessibilityAnnouncement="Etkinliği şikayet et"
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable
        accessible={false}
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
          accessible={false}
          onPress={(eventPress) => eventPress.stopPropagation()}
          style={{
            borderRadius: tokens.radius.lg,
            backgroundColor: tokens.colors.onMedia,
            borderWidth: 1,
            borderColor: tokens.colors.border,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              paddingHorizontal: tokens.spacing.smPlus,
              paddingTop: tokens.spacing.smPlus,
              paddingBottom: tokens.spacing.xs,
            }}
          >
            {reportSubmitted ? (
              <>
                <Text
                  style={{
                    color: tokens.colors.foreground,
                    fontSize: tokens.typography.subtitle,
                    fontWeight: "800",
                    textAlign: "center",
                  }}
                >
                  Bildirim gönderildi
                </Text>
                <Text
                  style={{
                    color: tokens.colors.muted,
                    fontSize: tokens.typography.caption,
                    textAlign: "center",
                    marginTop: tokens.spacing.xsMinus,
                    marginBottom: tokens.spacing.xs,
                  }}
                >
                  İnceleme için ekibe iletildi.
                </Text>
              </>
            ) : (
              <>
                <Text
                  style={{
                    color: tokens.colors.foreground,
                    fontSize: tokens.typography.subtitle,
                    fontWeight: "800",
                    textAlign: "center",
                    marginBottom: tokens.spacing.compact,
                  }}
                >
                  Şikâyet et
                </Text>
                {REPORT_REASONS.map((reason, index) => (
                  <Pressable
                    key={reason}
                    onPress={() => void onReport(reason)}
                    accessibilityRole="button"
                    accessibilityLabel={reason}
                    style={{
                      minHeight: 44,
                      paddingHorizontal: tokens.spacing.sm,
                      flexDirection: "row",
                      alignItems: "center",
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: tokens.colors.surfaceVariant,
                    }}
                  >
                    <Text
                      style={{
                        color: tokens.colors.dark700,
                        fontSize: tokens.typography.label,
                        fontWeight: "600",
                      }}
                    >
                      {reason}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Vazgeç"
                  style={{
                    minHeight: 44,
                    borderTopWidth: 1,
                    borderTopColor: tokens.colors.surfaceVariant,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: tokens.colors.muted,
                      fontSize: tokens.typography.label,
                      fontWeight: "700",
                    }}
                  >
                    Vazgeç
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </Pressable>
      </Pressable>
    </AppModalHost>
  );
}
