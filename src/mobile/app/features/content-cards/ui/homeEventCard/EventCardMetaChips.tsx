import { View } from "react-native";
import { AppText as Text } from "../../../../shared/components/AppText";

import { resolveMetaChipIcon, type EventMetaChip } from "./EventCardBody.shared";
import { tokens } from "../../../../shared/theme";
import { formatTurkishDisplayText } from "../../../../shared/i18n/turkishDisplay";

interface EventCardMetaChipsProps {
  chips: EventMetaChip[];
}

export function EventCardMetaChips({ chips }: EventCardMetaChipsProps) {
  const visibleChips = chips.slice(0, 3);
  const remainingCount = Math.max(0, chips.length - visibleChips.length);

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: tokens.spacing.xxsPlus,
        marginTop: tokens.spacing.xs,
      }}
    >
      {visibleChips.map((chip, index) => {
        const Icon = resolveMetaChipIcon(chip);
        const isTypeChip = chip.kind === "type";

        return (
          <View
            key={`chip-${index}-${chip.kind}-${chip.label}`}
            style={{
              borderRadius: tokens.radius.pill,
              backgroundColor: isTypeChip
                ? tokens.colors.surfaceVariant
                : tokens.colors.primarySofter,
              paddingHorizontal: tokens.spacing.xs,
              paddingVertical: tokens.spacing.microPlus,
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.xxs,
              minWidth: 44,
            }}
          >
            <Icon
              size={tokens.iconSize.xs}
              color={isTypeChip ? tokens.colors.textSecondary : tokens.colors.primary}
            />
            <Text
              style={{
                fontSize: tokens.typography.caption,
                fontWeight: "700",
                color: isTypeChip ? tokens.colors.textSecondary : tokens.colors.primaryDark,
                lineHeight: tokens.lineHeight.compact,
              }}
            >
              {formatTurkishDisplayText(chip.label)}
            </Text>
          </View>
        );
      })}
      {remainingCount > 0 ? (
        <View
          style={{
            alignItems: "center",
            alignSelf: "flex-start",
            backgroundColor: tokens.colors.surfaceVariant,
            borderRadius: tokens.radius.pill,
            justifyContent: "center",
            minHeight: 29,
            paddingHorizontal: tokens.spacing.xs,
          }}
        >
          <Text
            style={{
              color: tokens.colors.textSecondary,
              fontSize: tokens.typography.caption,
              fontWeight: tokens.fontWeight.bold,
            }}
          >
            +{remainingCount}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
