import React from "react";
import { Pressable, Text, View } from "react-native";

import { AppModalHost } from "../../../../shared/components";
import { t } from "../../../../shared/i18n";
import { tokens } from "../../../../shared/theme";

type Props = {
  modalBottomPadding: number;
  onClose: () => void;
  onReport: (reason: string) => Promise<void>;
  reportSubmitted: boolean;
  visible: boolean;
};

const REPORT_REASON_KEYS = [
  "profile.report.reasons.fake",
  "profile.report.reasons.spam",
  "profile.report.reasons.harassment",
  "profile.report.reasons.inappropriate",
  "profile.report.reasons.other",
] as const;

export function ProfileReportModal({
  modalBottomPadding,
  onClose,
  onReport,
  reportSubmitted,
  visible,
}: Props) {
  return (
    <AppModalHost
      accessibilityAnnouncement={t("profile.report.title")}
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: tokens.colors.overlay,
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
            backgroundColor: tokens.colors.surface,
            borderWidth: 1,
            borderColor: tokens.colors.border,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              paddingHorizontal: tokens.spacing.sm + 2,
              paddingTop: tokens.spacing.sm + 2,
              paddingBottom: tokens.spacing.xs,
            }}
          >
            {reportSubmitted ? (
              <>
                <Text
                  style={{
                    color: tokens.colors.foreground,
                    fontSize: tokens.typography.subtitle,
                    fontWeight: tokens.fontWeight.extrabold,
                    textAlign: "center",
                  }}
                >
                  {t("profile.report.submitted")}
                </Text>
                <Text
                  style={{
                    color: tokens.colors.muted,
                    fontSize: tokens.typography.caption,
                    textAlign: "center",
                    marginTop: 6,
                    marginBottom: tokens.spacing.xs,
                  }}
                >
                  {t("profile.report.submittedHint")}
                </Text>
              </>
            ) : (
              <>
                <Text
                  style={{
                    color: tokens.colors.foreground,
                    fontSize: tokens.typography.subtitle,
                    fontWeight: tokens.fontWeight.extrabold,
                    textAlign: "center",
                    marginBottom: 10,
                  }}
                >
                  {t("profile.report.title")}
                </Text>
                {REPORT_REASON_KEYS.map((reasonKey, index) => (
                  <Pressable
                    key={reasonKey}
                    onPress={() => void onReport(t(reasonKey))}
                    style={{
                      minHeight: tokens.minHeight.touchTarget,
                      paddingHorizontal: tokens.spacing.sm,
                      flexDirection: "row",
                      alignItems: "center",
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: tokens.colors.divider,
                    }}
                  >
                    <Text
                      style={{
                        color: tokens.colors.dark700,
                        fontSize: tokens.typography.body - 1,
                        fontWeight: tokens.fontWeight.semibold,
                      }}
                    >
                      {t(reasonKey)}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={onClose}
                  style={{
                    minHeight: tokens.minHeight.touchTarget,
                    borderTopWidth: 1,
                    borderTopColor: tokens.colors.divider,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: tokens.colors.muted,
                      fontSize: tokens.typography.body - 1,
                      fontWeight: tokens.fontWeight.bold,
                    }}
                  >
                    {t("common.cancel")}
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
