import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { AppText as Text } from "../../../../shared/components/AppText";
import { formatTurkishDisplayText } from "../../../../shared/i18n/turkishDisplay";
import { tokens } from "../../../../shared/theme";

const COLLAPSED_CATEGORY_COUNT = 3;

interface ProfileCategoryChipsProps {
  accountType: "club" | "student";
  categories?: string[] | null;
}

export function ProfileCategoryChips({ accountType, categories }: ProfileCategoryChipsProps) {
  const normalizedCategories = useMemo(
    () =>
      (Array.isArray(categories) ? categories : [])
        .map((category) => String(category || "").trim())
        .filter(Boolean),
    [categories],
  );
  const categoryKey = normalizedCategories.join("\u001f");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [categoryKey]);

  if (normalizedCategories.length === 0) return null;

  const visibleCategories = expanded
    ? normalizedCategories
    : normalizedCategories.slice(0, COLLAPSED_CATEGORY_COUNT);
  const hiddenCategoryCount = normalizedCategories.length - COLLAPSED_CATEGORY_COUNT;

  return (
    <View
      style={{
        alignItems: "center",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: tokens.spacing.xsMinus,
        marginTop: tokens.spacing.compact,
      }}
    >
      {visibleCategories.map((category, index) => (
        <View
          key={`${category}:${index}`}
          style={{
            backgroundColor: tokens.colors.primarySofter,
            borderRadius: tokens.radius.sm,
            paddingHorizontal: tokens.spacing.xs,
            paddingVertical: tokens.spacing.xsMinus,
          }}
        >
          <Text
            style={{
              color: accountType === "club" ? tokens.colors.clubIdentity : tokens.colors.primary,
              fontSize: tokens.typography.caption,
              fontWeight: tokens.fontWeight.bold,
            }}
          >
            {formatTurkishDisplayText(category)}
          </Text>
        </View>
      ))}

      {hiddenCategoryCount > 0 ? (
        <Pressable
          accessibilityLabel={expanded ? "Kategorileri daralt" : "Tüm kategorileri göster"}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          hitSlop={tokens.hitSlop.sm}
          onPress={() => setExpanded((current) => !current)}
          style={{
            alignItems: "center",
            justifyContent: "center",
            minHeight: tokens.minHeight.chipSm,
          }}
          testID="profile-categories-toggle"
        >
          <View
            style={{
              backgroundColor: tokens.colors.surfaceVariant,
              borderRadius: tokens.radius.sm,
              paddingHorizontal: tokens.spacing.xs,
              paddingVertical: tokens.spacing.xsMinus,
            }}
          >
            <Text
              style={{
                color: tokens.colors.textSecondary,
                fontSize: tokens.typography.caption,
                fontWeight: tokens.fontWeight.bold,
              }}
            >
              {expanded ? "Daha az" : `+${hiddenCategoryCount}`}
            </Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}
