import React from "react";
import { ActivityIndicator, Pressable, Text, View, useWindowDimensions } from "react-native";
import { AlertTriangle, ChevronRight, Trash2 } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "../../shared/theme";
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
          backgroundColor: "rgba(2,6,23,0.56)",
          justifyContent: "flex-end",
          paddingHorizontal: 12,
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
            borderRadius: 28,
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
              paddingHorizontal: 18,
              paddingTop: 18,
              paddingBottom: 16,
              gap: 14,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: tokens.colors.dangerSoft,
                }}
              >
                <Trash2 size={24} color={tokens.colors.dangerDark} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: tokens.colors.foreground, fontSize: 20, fontWeight: "800" }}>
                  {title}
                </Text>
                <Text style={{ color: tokens.colors.muted, fontSize: 13, lineHeight: 18 }}>
                  {description}
                </Text>
              </View>
            </View>

            {warningItems.length ? (
              <View
                style={{
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: tokens.colors.dangerBorder,
                  backgroundColor: tokens.colors.dangerSoft,
                  padding: 14,
                  gap: 10,
                }}
              >
                {warningItems.map((item, index) => (
                  <View
                    key={`${item}-${index}`}
                    style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                  >
                    <ChevronRight size={14} color={tokens.colors.dangerDark} />
                    <Text
                      style={{
                        flex: 1,
                        color: tokens.colors.dangerDeep,
                        fontSize: 12,
                        fontWeight: "700",
                        lineHeight: 17,
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
                borderRadius: 18,
                borderWidth: 1,
                borderColor: tokens.colors.warningBorder,
                backgroundColor: tokens.colors.warningSoft,
                paddingHorizontal: 12,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <AlertTriangle size={16} color={tokens.colors.warningIcon} />
              <Text
                style={{
                  flex: 1,
                  color: tokens.colors.warningText,
                  fontSize: 12,
                  fontWeight: "700",
                  lineHeight: 17,
                }}
              >
                {note}
              </Text>
            </View>

            <View style={{ flexDirection: stackActions ? "column" : "row", gap: 10 }}>
              <Pressable
                accessibilityLabel={cancelLabel}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={onClose}
                style={{
                  flex: 1,
                  minHeight: 50,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: tokens.colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: tokens.colors.background,
                  opacity: busy ? 0.5 : 1,
                }}
              >
                <Text style={{ color: tokens.colors.muted, fontSize: 14, fontWeight: "800" }}>
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
                  minHeight: 50,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: tokens.colors.dangerDark,
                  flexDirection: "row",
                  gap: 8,
                  opacity: busy ? 0.78 : 1,
                }}
              >
                {busy ? (
                  <ActivityIndicator color={tokens.colors.surface} />
                ) : (
                  <Trash2 size={16} color={tokens.colors.surface} />
                )}
                <Text style={{ color: tokens.colors.surface, fontSize: 14, fontWeight: "800" }}>
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
