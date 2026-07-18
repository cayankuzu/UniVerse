import React, { useCallback, type ReactNode, type RefObject } from "react";
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../i18n";
import { tokens } from "../theme";
import { AppModalHost } from "./AppModalHost";

export type AppModalSheetHeightMode = "content" | "medium" | "full";
export type AppModalSheetVariant = "dialog" | "menu" | "alert" | "form";

export interface AppModalSheetProps {
  busy?: boolean;
  busyCloseMessage?: string;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  description?: string;
  dirty?: boolean;
  dirtyCloseMessage?: string;
  dismissible?: boolean;
  heightMode?: AppModalSheetHeightMode;
  initialFocusRef?: RefObject<unknown>;
  keyboardMode?: "none" | "avoid";
  onRequestClose: () => void;
  onRequestDiscard?: () => void;
  restoreFocusRef?: RefObject<unknown>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  title: string;
  variant?: AppModalSheetVariant;
  visible: boolean;
}

export function AppModalSheet({
  busy = false,
  busyCloseMessage = "İşlem sürüyor. Lütfen bekle.",
  children,
  contentStyle,
  description,
  dirty = false,
  dirtyCloseMessage = "Kapatmadan önce değişiklikleri kaydet veya vazgeç.",
  dismissible = true,
  heightMode = "medium",
  initialFocusRef,
  keyboardMode = "avoid",
  onRequestClose,
  onRequestDiscard,
  restoreFocusRef,
  style,
  testID,
  title,
  variant = "dialog",
  visible,
}: AppModalSheetProps) {
  const insets = useSafeAreaInsets();
  const { fontScale, height } = useWindowDimensions();
  const canRequestClose = dismissible && !busy;
  const maxHeightRatio = heightMode === "full" ? 0.92 : heightMode === "content" ? 0.7 : 0.84;
  const availableHeight = Math.max(
    120,
    height - insets.top - Math.max(insets.bottom, 0) - tokens.spacing.lg,
  );
  const maxHeight = Math.min(availableHeight, Math.max(220, height * maxHeightRatio));
  const sheetRole = variant === "menu" ? "menu" : variant === "alert" ? "alert" : undefined;
  const closeTargetSize = Platform.OS === "android" ? 48 : 44;

  const announce = useCallback((message: string) => {
    AccessibilityInfo.announceForAccessibility(message);
  }, []);

  const handleCloseRequest = useCallback(() => {
    if (!dismissible) return;
    if (busy) {
      announce(busyCloseMessage);
      return;
    }
    if (dirty) {
      if (onRequestDiscard) {
        onRequestDiscard();
        return;
      }
      announce(dirtyCloseMessage);
      return;
    }
    onRequestClose();
  }, [
    announce,
    busy,
    busyCloseMessage,
    dirty,
    dirtyCloseMessage,
    dismissible,
    onRequestClose,
    onRequestDiscard,
  ]);

  return (
    <AppModalHost
      accessibilityAnnouncement={description ? `${title}. ${description}` : title}
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      initialFocusRef={initialFocusRef}
      onRequestClose={handleCloseRequest}
      restoreFocusRef={restoreFocusRef}
    >
      <KeyboardAvoidingView
        behavior={keyboardMode === "avoid" && Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: tokens.colors.overlayLight,
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onPress={handleCloseRequest}
            style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
          />
          <View
            accessibilityLabel={description ? `${title}. ${description}` : title}
            accessibilityRole={sheetRole}
            accessibilityViewIsModal
            style={[
              {
                backgroundColor: tokens.colors.surface,
                borderTopLeftRadius: tokens.radius.xl,
                borderTopRightRadius: tokens.radius.xl,
                maxHeight,
                paddingBottom: Math.max(insets.bottom + 12, 26),
                paddingHorizontal: tokens.spacing.md,
                paddingTop: 14,
              },
              style,
            ]}
            testID={testID}
          >
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                gap: tokens.spacing.sm,
                justifyContent: "space-between",
                marginBottom: tokens.spacing.sm,
                minHeight: Math.max(tokens.minHeight.touchTarget, 44 * fontScale),
              }}
            >
              <Text
                accessibilityRole="header"
                numberOfLines={2}
                style={{
                  color: tokens.colors.foreground,
                  flex: 1,
                  fontSize: 17,
                  fontWeight: "700",
                }}
              >
                {title}
              </Text>
              {dismissible ? (
                <Pressable
                  accessibilityLabel={t("common.close")}
                  accessibilityRole="button"
                  accessibilityState={{ busy, disabled: !canRequestClose }}
                  disabled={!canRequestClose}
                  hitSlop={tokens.hitSlop.sm}
                  onPress={handleCloseRequest}
                  style={{
                    alignItems: "center",
                    height: closeTargetSize,
                    justifyContent: "center",
                    opacity: canRequestClose ? 1 : 0.45,
                    width: closeTargetSize,
                  }}
                >
                  <X size={20} color={tokens.colors.iconMuted} />
                </Pressable>
              ) : null}
            </View>
            <View style={contentStyle}>{children}</View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </AppModalHost>
  );
}
