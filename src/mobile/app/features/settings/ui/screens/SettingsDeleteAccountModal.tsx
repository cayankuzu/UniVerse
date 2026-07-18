import { Trash2 } from "lucide-react-native";
import { ActivityIndicator, Pressable, Text, View, useWindowDimensions } from "react-native";

import { AppModalHost } from "../../../../shared/components";
import { t } from "../../../../shared/i18n";
import { tokens } from "../../../../shared/theme";

interface SettingsDeleteAccountModalProps {
  bottomInset: number;
  deletingAccount: boolean;
  errorMessage?: string;
  onCancel: () => void;
  onConfirm: () => void;
  visible: boolean;
}

export function SettingsDeleteAccountModal({
  bottomInset,
  deletingAccount,
  errorMessage,
  onCancel,
  onConfirm,
  visible,
}: SettingsDeleteAccountModalProps) {
  const { fontScale, width } = useWindowDimensions();
  const title = t("settings.deleteAccount.title");
  const warning = t("settings.deleteAccount.warning");
  const stackActions = fontScale >= 1.4 || width < 340;
  const handleCancel = () => {
    if (!deletingAccount) {
      onCancel();
    }
  };

  return (
    <AppModalHost
      accessibilityAnnouncement={t("settings.account.deleteTitle")}
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleCancel}
    >
      <Pressable
        onPress={handleCancel}
        style={{
          flex: 1,
          backgroundColor: "rgba(2,6,23,0.42)",
          justifyContent: "flex-end",
          paddingHorizontal: tokens.spacing.md,
          paddingTop: tokens.spacing.md,
          paddingBottom: bottomInset,
        }}
      >
        <Pressable
          accessibilityLabel={`${title}. ${warning}`}
          accessibilityRole="alert"
          accessibilityViewIsModal
          onPress={(event) => event.stopPropagation()}
          style={{
            borderRadius: tokens.radius.lg,
            borderWidth: 1,
            borderColor: tokens.colors.dangerBorder,
            backgroundColor: tokens.colors.surface,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              alignItems: "center",
              paddingHorizontal: tokens.spacing.lg,
              paddingTop: tokens.spacing.lg,
              paddingBottom: tokens.spacing.sm,
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: tokens.radius.lg,
                backgroundColor: tokens.colors.dangerSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Trash2 size={30} color={tokens.colors.danger} />
            </View>

            <Text
              style={{
                marginTop: tokens.spacing.md,
                color: tokens.colors.foreground,
                fontSize: 18,
                fontWeight: "800",
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                marginTop: tokens.spacing.xs,
                color: tokens.colors.muted,
                fontSize: 13,
                textAlign: "center",
                lineHeight: 19,
              }}
            >
              {warning}
            </Text>
          </View>

          <View
            style={{
              gap: tokens.spacing.sm,
              paddingHorizontal: tokens.spacing.md,
              paddingBottom: tokens.spacing.md,
            }}
          >
            {errorMessage ? (
              <View
                accessibilityLiveRegion="polite"
                style={{
                  borderColor: tokens.colors.dangerBorder,
                  borderRadius: tokens.radius.md,
                  borderWidth: 1,
                  backgroundColor: tokens.colors.dangerSoft,
                  paddingHorizontal: tokens.spacing.sm,
                  paddingVertical: 10,
                  width: "100%",
                }}
              >
                <Text style={{ color: tokens.colors.dangerDark, fontSize: 13, fontWeight: "600" }}>
                  {errorMessage}
                </Text>
              </View>
            ) : null}
            <View
              style={{ flexDirection: stackActions ? "column" : "row", gap: tokens.spacing.sm }}
            >
              <Pressable
                accessibilityLabel={t("common.cancel")}
                accessibilityRole="button"
                accessibilityState={{ disabled: deletingAccount }}
                disabled={deletingAccount}
                onPress={handleCancel}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: tokens.radius.md,
                  backgroundColor: tokens.colors.background,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: deletingAccount ? 0.5 : 1,
                }}
              >
                <Text style={{ color: tokens.colors.muted, fontSize: 14, fontWeight: "700" }}>
                  {t("common.cancel")}
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel={
                  deletingAccount
                    ? t("common.deleting")
                    : errorMessage
                      ? t("common.retryAction")
                      : t("common.delete")
                }
                accessibilityRole="button"
                accessibilityState={{ busy: deletingAccount, disabled: deletingAccount }}
                onPress={onConfirm}
                disabled={deletingAccount}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: tokens.radius.md,
                  backgroundColor: tokens.colors.danger,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: tokens.spacing.xs,
                  opacity: deletingAccount ? 0.7 : 1,
                }}
              >
                {deletingAccount ? (
                  <ActivityIndicator color={tokens.colors.surface} size="small" />
                ) : null}
                <Text style={{ color: tokens.colors.surface, fontSize: 14, fontWeight: "700" }}>
                  {deletingAccount
                    ? t("common.deleting")
                    : errorMessage
                      ? t("common.retryAction")
                      : t("common.delete")}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </AppModalHost>
  );
}
