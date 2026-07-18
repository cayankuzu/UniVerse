import React from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { tokens } from "../../../../shared/theme";

type Props = {
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  loading?: boolean;
  onPress: () => void;
};

export function EventAlbumActionButton({ disabled, icon, label, loading, onPress }: Props) {
  const blocked = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      style={{
        flex: 1,
        minHeight: tokens.minHeight.inputLg,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: blocked ? tokens.colors.border : tokens.colors.primaryBorder,
        backgroundColor: blocked ? tokens.colors.background : tokens.colors.primarySofter,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: tokens.spacing.xs,
        opacity: blocked ? 0.55 : 1,
        shadowColor: tokens.colors.shadow,
        shadowOpacity: blocked ? 0 : 0.04,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: blocked ? 0 : 1,
      }}
    >
      {loading ? <ActivityIndicator size="small" color={tokens.colors.primary} /> : icon}
      <Text
        style={{
          color: blocked ? tokens.colors.muted : tokens.colors.primary,
          fontSize: tokens.typography.caption,
          fontWeight: tokens.fontWeight.bold,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
