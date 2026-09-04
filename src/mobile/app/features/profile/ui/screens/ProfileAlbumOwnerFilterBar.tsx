import { Pressable, View } from "react-native";
import { AppText as Text } from "../../../../shared/components/AppText";
import { tokens } from "../../../../shared/theme";
import type { AlbumOwnerFilter } from "../../domain/profileConstants";

interface Props {
  value: AlbumOwnerFilter;
  onChange: (value: AlbumOwnerFilter) => void;
}

const OPTIONS: Array<{ key: AlbumOwnerFilter; label: string }> = [
  { key: "all", label: "Tümü" },
  { key: "club", label: "Kulüp" },
  { key: "students", label: "Öğrenciler" },
];

export function ProfileAlbumOwnerFilterBar({ value, onChange }: Props) {
  return (
    <View
      style={{
        marginTop: tokens.spacing.xs,
        flexDirection: "row",
        gap: tokens.spacing.xs,
      }}
    >
      {OPTIONS.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              minHeight: tokens.minHeight.header,
              borderRadius: tokens.radius.pill,
              borderWidth: 1,
              borderColor: active ? tokens.colors.primaryBorder : tokens.colors.border,
              backgroundColor: active ? tokens.colors.primarySoft : tokens.colors.surface,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: active ? tokens.colors.primary : tokens.colors.muted,
                fontSize: tokens.typography.caption,
                fontWeight: tokens.fontWeight.bold,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
