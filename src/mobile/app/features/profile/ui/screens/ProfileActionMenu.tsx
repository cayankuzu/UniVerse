import { memo } from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Pressable } from "react-native";
import { Ban, Flag } from "lucide-react-native";
import { tokens } from "../../../../shared/theme";
import { AppModalHost } from "../../../../shared/components";

type Props = {
  blockLabel: string;
  bottomPadding: number;
  onClose: () => void;
  onConfirmBlockToggle: () => void;
  onConfirmReport: () => void;
  visible: boolean;
};

const MENU_ACTIONS = [
  { key: "report", label: "Şikâyet Et", icon: <Flag size={16} color={tokens.colors.amber} /> },
  { key: "block", label: "", icon: <Ban size={16} color={tokens.colors.danger} /> },
] as const;

export const ProfileActionMenu = memo(function ProfileActionMenu({
  blockLabel,
  bottomPadding,
  onClose,
  onConfirmBlockToggle,
  onConfirmReport,
  visible,
}: Props) {
  const menuItems = [
    {
      ...MENU_ACTIONS[0],
      onPress: onConfirmReport,
    },
    {
      ...MENU_ACTIONS[1],
      label: blockLabel,
      onPress: onConfirmBlockToggle,
    },
  ];

  return (
    <AppModalHost
      accessibilityAnnouncement="Profil seçenekleri"
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
          paddingHorizontal: tokens.spacing.smPlus,
          paddingTop: tokens.spacing.smPlus,
          paddingBottom: Math.max(bottomPadding + 14, 14),
        }}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            borderRadius: tokens.radius.card,
            overflow: "hidden",
            backgroundColor: tokens.colors.surface,
            borderWidth: 1,
            borderColor: tokens.colors.border,
          }}
        >
          {menuItems.map((item, index) => (
            <Pressable
              key={item.key}
              onPress={() => {
                onClose();
                item.onPress();
              }}
              style={{
                minHeight: tokens.minHeight.buttonLg,
                paddingHorizontal: tokens.spacing.smPlus,
                flexDirection: "row",
                alignItems: "center",
                gap: tokens.spacing.compact,
                borderBottomWidth: index === menuItems.length - 1 ? 0 : 1,
                borderBottomColor: tokens.colors.border,
              }}
            >
              {item.icon}
              <Text
                style={{
                  flex: 1,
                  color: tokens.colors.foreground,
                  fontSize: tokens.typography.body,
                  fontWeight: tokens.fontWeight.bold,
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </AppModalHost>
  );
});
