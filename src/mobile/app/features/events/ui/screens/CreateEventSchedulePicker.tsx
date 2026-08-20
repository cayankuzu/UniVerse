import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Platform, Pressable, View } from "react-native";

import { t } from "../../../../shared/i18n";
import { tokens } from "../../../../shared/theme";

interface Props {
  active: boolean;
  minimumDate?: Date;
  mode: "date" | "time";
  value: Date;
  onChange: (event: DateTimePickerEvent, selectedDate?: Date) => void;
  onClose: () => void;
}

export function CreateEventSchedulePicker({
  active,
  minimumDate,
  mode,
  onChange,
  onClose,
  value,
}: Props) {
  if (!active) return null;

  return (
    <View
      style={{
        marginTop: tokens.spacing.xxs,
        borderRadius: tokens.radius.control,
        borderWidth: 1,
        borderColor: tokens.colors.border,
        backgroundColor: tokens.colors.surface,
        overflow: "hidden",
      }}
    >
      {Platform.OS === "ios" ? (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingHorizontal: tokens.spacing.sm,
            paddingTop: tokens.spacing.compact,
          }}
        >
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("events.schedule.cancel")}
            hitSlop={tokens.hitSlop.sm}
          >
            <Text
              style={{
                color: tokens.colors.muted,
                fontSize: tokens.typography.label,
                fontWeight: tokens.fontWeight.bold,
              }}
            >
              {t("events.schedule.cancel")}
            </Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("events.schedule.confirm")}
            hitSlop={tokens.hitSlop.sm}
          >
            <Text
              style={{
                color: tokens.colors.primary,
                fontSize: tokens.typography.label,
                fontWeight: tokens.fontWeight.bold,
              }}
            >
              {t("events.schedule.confirm")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <DateTimePicker
        value={value}
        mode={mode}
        display={Platform.OS === "ios" ? "spinner" : "default"}
        onChange={onChange}
        is24Hour
        minimumDate={mode === "date" ? minimumDate : undefined}
      />
    </View>
  );
}
