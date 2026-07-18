import { memo } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Search, X } from "lucide-react-native";
import { t } from "../../shared/i18n";
import { tokens } from "../../shared/theme";

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
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: tokens.colors.surface,
        borderColor: tokens.colors.border,
        borderRadius: tokens.radius.lg,
        borderWidth: 1,
        flexDirection: "row",
        gap: tokens.spacing.xs,
        minHeight: tokens.minHeight.inputLg,
        paddingHorizontal: tokens.spacing.sm,
      }}
    >
      <Search size={18} color={tokens.colors.mutedFg} strokeWidth={1.8} />
      <TextInput
        accessibilityLabel={accessibilityLabel}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="never"
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.colors.mutedFg}
        returnKeyType="search"
        style={{
          color: tokens.colors.foreground,
          flex: 1,
          fontSize: tokens.typography.body,
          fontWeight: "600",
          minHeight: tokens.minHeight.touchTarget,
          paddingVertical: 0,
        }}
        value={value}
      />
      {value ? (
        <Pressable
          accessibilityLabel={t("common.clearSearch")}
          accessibilityRole="button"
          onPress={() => onChangeText("")}
          style={{
            alignItems: "center",
            justifyContent: "center",
            minHeight: tokens.minHeight.touchTarget,
            minWidth: tokens.minHeight.touchTarget,
          }}
        >
          <View
            style={{
              alignItems: "center",
              backgroundColor: tokens.colors.surfaceVariant,
              borderRadius: tokens.radius.pill,
              height: 28,
              justifyContent: "center",
              width: 28,
            }}
          >
            <X size={15} color={tokens.colors.muted} strokeWidth={2} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
});
