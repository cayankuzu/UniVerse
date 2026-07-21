import React from "react";
import { AppText as Text } from "./AppText";
import { ActivityIndicator, Pressable, View, useWindowDimensions } from "react-native";
import { AlertTriangle, ChevronRight, Trash2 } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens, withAlpha } from "../../shared/theme";
import { t } from "../../shared/i18n";
import { AppModalHost } from "./AppModalHost";

type Props = {
  busy?: boolean;
  cancelLabel?: string;
  confirmLabel: string;
  description: string;
  note?: string;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  visible: boolean;
  warningItems?: string[];
};

export function DangerConfirmSheet({
  busy = false,
  cancelLabel = t("common.cancel"),
  confirmLabel,
  description,
  note = t("danger.confirm.irreversible"),
  onClose,
  onConfirm,
  title,
  visible,
  warningItems = [],
}: Props) {
  const insets = useSafeAreaInsets();
  const { fontScale, width } = useWindowDimensions();
  const stackActions = fontScale >= 1.4 || width < 340;
  const handleCloseRequest = () => {
    if (!busy) {
      onClose();
    }
  };

  return (
    <AppModalHost
      accessibilityAnnouncement={`${title}. ${description}`}
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleCloseRequest}
    >
      <Pressable
        onPress={handleCloseRequest}
        style={{
          flex: 1,
          backgroundColor: withAlpha(tokens.colors.dark950, 0.56),
          justifyContent: "flex-end",
          paddingHorizontal: tokens.spacing.sm,
          paddingTop: Math.max(insets.top + 12, 20),
          paddingBottom: Math.max(insets.bottom + 12, 20),
        }}
      >
        <Pressable
          accessibilityLabel={`${title}. ${description}`}
          accessibilityRole="alert"
          accessibilityViewIsModal
          onPress={(event) => event.stopPropagation()}
          style={{
            borderRadius: tokens.radius["3xl"],
            backgroundColor: tokens.colors.surface,
            borderWidth: 1,
            borderColor: tokens.colors.border,
            overflow: "hidden",
            shadowColor: tokens.colors.shadow,
            shadowOpacity: 0.18,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 18 },
            elevation: 18,
          }}
        >
          <View
            style={{
              paddingHorizontal: tokens.spacing.mdPlus,
              paddingTop: tokens.spacing.mdPlus,
              paddingBottom: tokens.spacing.md,
              gap: tokens.spacing.smPlus,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.smPlus }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: tokens.radius.card,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: tokens.colors.dangerSoft,
                }}
              >
                <Trash2 size={tokens.iconSize["2xl"]} color={tokens.colors.dangerDark} />
              </View>
              <View style={{ flex: 1, gap: tokens.spacing.xxs }}>
                <Text
                  style={{
                    color: tokens.colors.foreground,
                    fontSize: tokens.typography.sectionTitle,
                    fontWeight: "800",
                  }}
                >
                  {title}
                </Text>
                <Text
                  style={{
                    color: tokens.colors.muted,
                    fontSize: tokens.typography.label,
                    lineHeight: tokens.lineHeight.label,
                  }}
                >
                  {description}
                </Text>
              </View>
            </View>

            {warningItems.length ? (
              <View
                style={{
                  borderRadius: tokens.radius.sheet,
                  borderWidth: 1,
                  borderColor: tokens.colors.dangerBorder,
                  backgroundColor: tokens.colors.dangerSoft,
                  padding: tokens.spacing.smPlus,
                  gap: tokens.spacing.compact,
                }}
              >
                {warningItems.map((item, index) => (
                  <View
                    key={`${item}-${index}`}
                    style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.xs }}
                  >
                    <ChevronRight size={14} color={tokens.colors.dangerDark} />
                    <Text
                      style={{
                        flex: 1,
                        color: tokens.colors.dangerDeep,
                        fontSize: tokens.typography.caption,
                        fontWeight: "700",
                        lineHeight: tokens.lineHeight.caption,
                      }}
                    >
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View
              style={{
                borderRadius: tokens.radius.card,
                borderWidth: 1,
                borderColor: tokens.colors.warningBorder,
                backgroundColor: tokens.colors.warningSoft,
                paddingHorizontal: tokens.spacing.sm,
                paddingVertical: tokens.spacing.compact,
                flexDirection: "row",
                alignItems: "center",
                gap: tokens.spacing.xs,
              }}
            >
              <AlertTriangle size={16} color={tokens.colors.warningIcon} />
              <Text
                style={{
                  flex: 1,
                  color: tokens.colors.warningText,
                  fontSize: tokens.typography.caption,
                  fontWeight: "700",
                  lineHeight: tokens.lineHeight.caption,
                }}
              >
                {note}
              </Text>
            </View>

            <View
              style={{
                flexDirection: stackActions ? "column" : "row",
                gap: tokens.spacing.compact,
              }}
            >
              <Pressable
                accessibilityLabel={cancelLabel}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={onClose}
                style={{
                  flex: 1,
                  minHeight: tokens.minHeight.buttonLg,
                  borderRadius: tokens.radius.lg,
                  borderWidth: 1,
                  borderColor: tokens.colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: tokens.colors.background,
                  opacity: busy ? 0.5 : 1,
                }}
              >
                <Text
                  style={{
                    color: tokens.colors.muted,
                    fontSize: tokens.typography.body,
                    fontWeight: "800",
                  }}
                >
                  {cancelLabel}
                </Text>
              </Pressable>

              <Pressable
                accessibilityLabel={busy ? t("common.deleting") : confirmLabel}
                accessibilityRole="button"
                accessibilityState={{ busy, disabled: busy }}
                disabled={busy}
                onPress={onConfirm}
                style={{
                  flex: 1.15,
                  minHeight: tokens.minHeight.buttonLg,
                  borderRadius: tokens.radius.lg,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: tokens.colors.dangerDark,
                  flexDirection: "row",
                  gap: tokens.spacing.xs,
                  opacity: busy ? 0.78 : 1,
                }}
              >
                {busy ? (
                  <ActivityIndicator color={tokens.colors.surface} />
                ) : (
                  <Trash2 size={16} color={tokens.colors.surface} />
                )}
                <Text
                  style={{
                    color: tokens.colors.surface,
                    fontSize: tokens.typography.body,
                    fontWeight: "800",
                  }}
                >
                  {busy ? t("common.deleting") : confirmLabel}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </AppModalHost>
  );
}
