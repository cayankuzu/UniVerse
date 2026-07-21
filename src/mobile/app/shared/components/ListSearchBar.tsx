import { memo, useState } from "react";
import { TextInput, View } from "react-native";
import { Search, X } from "lucide-react-native";
import { t } from "../../shared/i18n";
import { tokens } from "../../shared/theme";
import { InstantPressable } from "./InstantPressable";

type Props = {
  accessibilityLabel?: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
};

export const ListSearchBar = memo(function ListSearchBar({
  accessibilityLabel = t("common.listSearchA11y"),
  onChangeText,
  placeholder,
  value,
}: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: tokens.colors.surface,
        borderColor: focused ? tokens.colors.ring : tokens.colors.border,
        borderRadius: tokens.radius.lg,
        borderWidth: 1,
        flexDirection: "row",
        gap: tokens.spacing.xs,
        minHeight: tokens.minHeight.inputLg,
        paddingHorizontal: tokens.spacing.sm,
      }}
    >
      <Search size={tokens.iconSize.lg} color={tokens.colors.mutedFg} strokeWidth={1.8} />
      <TextInput
        accessibilityLabel={accessibilityLabel}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="never"
        onChangeText={onChangeText}
        onBlur={() => setFocused(false)}
        onFocus={() => setFocused(true)}
        placeholder={placeholder}
        placeholderTextColor={tokens.colors.mutedFg}
        returnKeyType="search"
        style={{
          color: tokens.colors.foreground,
          flex: 1,
          fontFamily: tokens.fontFamily.semibold,
          fontSize: tokens.typography.body,
          fontWeight: tokens.fontWeight.semibold,
          minHeight: tokens.minHeight.inputLg,
          paddingVertical: 0,
        }}
        value={value}
      />
      {value ? (
        <InstantPressable
          accessibilityLabel={t("common.clearSearch")}
          accessibilityRole="button"
          haptic="selection"
          hitSlop={tokens.hitSlop.sm}
          onPress={() => onChangeText("")}
          style={{
            alignItems: "center",
            justifyContent: "center",
            minHeight: tokens.minHeight.inputLg,
            minWidth: tokens.minHeight.inputLg,
          }}
        >
          <View
            style={{
              alignItems: "center",
              backgroundColor: tokens.colors.surfaceVariant,
              borderRadius: tokens.radius.pill,
              height: tokens.iconSize["2xl"],
              justifyContent: "center",
              width: tokens.iconSize["2xl"],
            }}
          >
            <X size={tokens.iconSize.sm} color={tokens.colors.muted} strokeWidth={2} />
          </View>
        </InstantPressable>
      ) : null}
    </View>
  );
});
