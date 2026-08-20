import { MoreHorizontal } from "lucide-react-native";
import { useMemo, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Divider, Surface, TouchableRipple } from "react-native-paper";
import { AppText as Text } from "./AppText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "../../shared/theme";
import { t } from "../../shared/i18n";
import { AppIconButton } from "./AppIconButton";
import { AppModalHost } from "./AppModalHost";

export interface OverflowActionItem {
  key: string;
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  onPress: () => void;
}

interface Props {
  actions: OverflowActionItem[];
  title?: string;
  disabled?: boolean;
  buttonSize?: number;
}

export function OverflowActionMenu({
  actions,
  title = t("common.options"),
  disabled = false,
  buttonSize = tokens.spacing.xxl,
}: Props) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const visibleActions = useMemo(() => actions.filter((item) => item && !item.disabled), [actions]);

  if (!visibleActions.length) return null;

  return (
    <>
      <AppIconButton
        accessibilityLabel={title}
        disabled={disabled}
        icon={({ size }) => (
          <MoreHorizontal size={size} color={tokens.colors.iconMuted} strokeWidth={1.8} />
        )}
        iconSize={Math.max(tokens.iconSize.md, buttonSize - tokens.spacing.md)}
        onPress={() => setOpen(true)}
        outlineColor={tokens.colors.divider}
        size={buttonSize}
        surfaceColor={tokens.colors.background}
      />

      <AppModalHost
        accessibilityAnnouncement={title}
        visible={open}
        transparent
        animationType="none"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          accessible={false}
          onPress={() => setOpen(false)}
          style={{
            flex: 1,
            backgroundColor: tokens.colors.overlay,
            justifyContent: "flex-end",
            paddingHorizontal: tokens.spacing.sm,
            paddingTop: tokens.spacing.sm,
            paddingBottom: Math.max(insets.bottom + tokens.spacing.sm, tokens.spacing.sm),
          }}
        >
          <Pressable accessible={false} onPress={(event) => event.stopPropagation()}>
            <Surface
              accessibilityLabel={title}
              accessibilityRole="menu"
              accessibilityViewIsModal
              elevation={1}
              style={{
                borderRadius: tokens.radius.lg,
                overflow: "hidden",
                backgroundColor: tokens.colors.surface,
                borderWidth: 1,
                borderColor: tokens.colors.border,
              }}
            >
              <View
                style={{
                  paddingHorizontal: tokens.spacing.sm,
                  paddingTop: tokens.spacing.sm,
                  paddingBottom: tokens.spacing.xs,
                }}
              >
                <Text
                  style={{
                    color: tokens.colors.text,
                    fontSize: tokens.typography.subtitle,
                    fontWeight: tokens.fontWeight.extrabold,
                    textAlign: "center",
                  }}
                >
                  {title}
                </Text>
              </View>
              <Divider style={{ backgroundColor: tokens.colors.divider }} />

              {visibleActions.map((item, index) => (
                <View key={item.key}>
                  <TouchableRipple
                    accessibilityLabel={item.label}
                    accessibilityRole="menuitem"
                    accessibilityState={{ disabled: Boolean(item.disabled) }}
                    onPress={() => {
                      setOpen(false);
                      item.onPress();
                    }}
                  >
                    <View
                      style={{
                        minHeight: tokens.minHeight.row,
                        paddingHorizontal: tokens.spacing.sm,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: tokens.hitSlop.md,
                      }}
                    >
                      {item.icon}
                      <Text
                        style={{
                          flex: 1,
                          color: item.destructive ? tokens.colors.danger : tokens.colors.dark700,
                          fontSize: tokens.typography.caption,
                          fontWeight: tokens.fontWeight.bold,
                        }}
                      >
                        {item.label}
                      </Text>
                    </View>
                  </TouchableRipple>
                  {index < visibleActions.length - 1 ? (
                    <Divider style={{ backgroundColor: tokens.colors.border }} />
                  ) : null}
                </View>
              ))}

              <Divider style={{ backgroundColor: tokens.colors.border }} />
              <TouchableRipple
                accessibilityLabel={t("common.cancel")}
                accessibilityRole="button"
                onPress={() => setOpen(false)}
              >
                <View
                  style={{
                    minHeight: tokens.minHeight.row,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: tokens.colors.muted,
                      fontSize: tokens.typography.caption,
                      fontWeight: tokens.fontWeight.bold,
                    }}
                  >
                    {t("common.cancel")}
                  </Text>
                </View>
              </TouchableRipple>
            </Surface>
          </Pressable>
        </Pressable>
      </AppModalHost>
    </>
  );
}
