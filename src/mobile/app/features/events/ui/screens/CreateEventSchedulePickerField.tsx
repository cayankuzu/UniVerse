import { Calendar, Clock } from "lucide-react-native";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Pressable, View } from "react-native";
import { tokens } from "../../../../shared/theme";
import { useKeyboardSafeField, useKeyboardSafeFormActions } from "../../../../shared/components";
import { useEffect, useRef } from "react";

interface Props {
  errorText?: string;
  fieldName?: string;
  icon: "date" | "time";
  label: string;
  placeholder: string;
  value: string;
  onPress: () => void;
}

export function CreateEventSchedulePickerField({
  errorText,
  fieldName,
  icon,
  label,
  onPress,
  placeholder,
  value,
}: Props) {
  const triggerRef = useRef<View>(null);
  const keyboardField = useKeyboardSafeField(fieldName);
  const keyboardActions = useKeyboardSafeFormActions();
  const isInvalid = Boolean(errorText);

  useEffect(() => {
    if (!fieldName) return undefined;
    return keyboardActions?.registerFieldFocus(fieldName, onPress, triggerRef.current);
  }, [fieldName, keyboardActions, onPress]);

  return (
    <View
      ref={keyboardField.ref}
      collapsable={false}
      onLayout={keyboardField.onLayout}
      style={{ gap: tokens.spacing.xsMinus }}
    >
      <Text
        style={{
          fontSize: tokens.typography.label,
          fontWeight: tokens.fontWeight.semibold,
          color: tokens.colors.dark700,
        }}
      >
        {label}
      </Text>
      <Pressable
        ref={triggerRef}
        accessibilityHint={errorText || undefined}
        onPress={onPress}
        style={{
          height: tokens.minHeight.buttonXl,
          borderRadius: tokens.radius.control,
          borderWidth: 1,
          borderColor: isInvalid ? tokens.colors.danger : tokens.colors.border,
          backgroundColor: tokens.colors.surface,
          paddingHorizontal: tokens.spacing.smPlus,
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.xs,
        }}
      >
        {icon === "date" ? (
          <Calendar size={tokens.iconSize.md} color={tokens.colors.mutedFg} />
        ) : (
          <Clock size={tokens.iconSize.md} color={tokens.colors.mutedFg} />
        )}
        <Text
          style={{
            flex: 1,
            fontSize: tokens.typography.body,
            color: value ? tokens.colors.foreground : tokens.colors.mutedFg,
          }}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
      </Pressable>
      <Text
        accessibilityLiveRegion={isInvalid ? "polite" : undefined}
        style={{
          color: isInvalid ? tokens.colors.danger : tokens.colors.mutedFg,
          fontSize: tokens.typography.caption,
          minHeight: 16,
        }}
      >
        {errorText || ""}
      </Text>
    </View>
  );
}
