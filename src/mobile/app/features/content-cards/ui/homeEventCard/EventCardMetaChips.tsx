import { Text, View } from "react-native";
import { AppScrollView as ScrollView } from "../../../../shared/components";

import { resolveMetaChipIcon, type EventMetaChip } from "./EventCardBody.shared";

interface EventCardMetaChipsProps {
  chips: EventMetaChip[];
}

export function EventCardMetaChips({ chips }: EventCardMetaChipsProps) {
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      directionalLockEnabled
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 5, marginTop: 8, paddingRight: 8 }}
    >
      {chips.map((chip, index) => {
        const Icon = resolveMetaChipIcon(chip);
        const isTypeChip = chip.kind === "type";

        return (
          <View
            key={`chip-${index}-${chip.kind}-${chip.label}`}
            style={{
              borderRadius: 999,
              backgroundColor: isTypeChip ? "#fffbeb" : "#f5f3ff",
              paddingHorizontal: 8,
              paddingVertical: 3,
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              minWidth: 52,
            }}
          >
            <Icon size={10} color={isTypeChip ? "#d97706" : "#7c3aed"} />
            <Text
              style={{
                fontSize: 9,
                fontWeight: "700",
                color: isTypeChip ? "#b45309" : "#6d28d9",
                lineHeight: 12,
              }}
            >
              {chip.label}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}
