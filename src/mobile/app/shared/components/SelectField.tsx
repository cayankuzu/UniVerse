import React, { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
import { CheckCircle, ChevronDown, Circle, Search, SearchX } from "lucide-react-native";
import { tokens } from "../../shared/theme";
import { t } from "../../shared/i18n";
import { AppModalSheet } from "./AppModalSheet";
import { useKeyboardSafeField, useKeyboardSafeFormActions } from "./KeyboardSafeForm";

interface SelectFieldProps {
  disabled?: boolean;
  emptyText?: string;
  errorText?: string;
  fieldName?: string;
  label: string;
  onSelect: (value: string) => void;
  options: string[];
  placeholder: string;
  searchPlaceholder?: string;
  supportingText?: string;
  value: string;
}

const sortAndUniq = (items: readonly string[]) =>
  Array.from(new Set(items)).sort((a, b) => a.localeCompare(b, "tr", { sensitivity: "base" }));

const normalizeText = (value: string) => value.trim().toLocaleLowerCase("tr");

export const SelectField = React.memo(function SelectField({
  disabled = false,
  emptyText = t("common.noResults"),
  errorText,
  fieldName,
  label,
  onSelect,
  options,
  placeholder,
  searchPlaceholder = t("common.listSearch"),
  supportingText,
  value,
}: SelectFieldProps) {
  const { fontScale, height } = useWindowDimensions();
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<View>(null);
  const searchInputRef = useRef<TextInput>(null);
  const keyboardField = useKeyboardSafeField(fieldName);
  const keyboardActions = useKeyboardSafeFormActions();

  const uniqueOptions = useMemo(() => sortAndUniq(options), [options]);

  const filteredOptions = useMemo(() => {
    const normalized = normalizeText(query);
    if (!normalized) return uniqueOptions;
    return uniqueOptions.filter((option) => normalizeText(option).includes(normalized));
  }, [query, uniqueOptions]);

  const selected = value.trim();
  const isInvalid = Boolean(errorText);
  const helperText = errorText || supportingText || "";
  const borderColor = isInvalid ? tokens.colors.danger : tokens.colors.border;
  const listMaxHeight = Math.max(180, Math.min(420, height * (fontScale >= 1.4 ? 0.34 : 0.42)));
  const closeSheet = useCallback(() => {
    setVisible(false);
    setQuery("");
  }, []);
  const openSheet = useCallback(() => {
    if (!disabled) {
      setVisible(true);
    }
  }, [disabled]);
  const handleSelect = useCallback(
    (nextValue: string) => {
      onSelect(nextValue);
      closeSheet();
    },
    [closeSheet, onSelect],
  );
  React.useEffect(() => {
    if (!fieldName) return undefined;
    return keyboardActions?.registerFieldFocus(fieldName, openSheet, triggerRef.current);
  }, [fieldName, keyboardActions, openSheet]);
  const emptyState = useMemo(
    () => (
      <View style={{ minHeight: 64, alignItems: "center", justifyContent: "center", gap: 6 }}>
        <SearchX size={18} color={tokens.colors.mutedFg} />
        <Text style={{ color: tokens.colors.mutedFg, fontSize: 13 }}>{emptyText}</Text>
      </View>
    ),
    [emptyText],
  );

  return (
    <View
      ref={keyboardField.ref}
      collapsable={false}
      onLayout={keyboardField.onLayout}
      style={{ gap: tokens.spacing.xs }}
    >
      <Text
        style={{
          color: tokens.colors.dark700,
          fontSize: tokens.typography.body,
          fontWeight: "500",
        }}
      >
        {label}
      </Text>

      <Pressable
        ref={triggerRef}
        accessibilityHint={helperText || undefined}
        accessibilityLabel={`${label}. ${selected || placeholder}`}
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: visible }}
        onPress={() => {
          keyboardField.onFocus();
          openSheet();
        }}
        style={{
          minHeight: tokens.minHeight.buttonXl,
          borderRadius: tokens.radius.md,
          borderWidth: 1,
          borderColor,
          backgroundColor: tokens.colors.background,
          paddingHorizontal: tokens.spacing.sm,
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.xs,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Text
          style={{
            flex: 1,
            color: selected ? tokens.colors.foreground : tokens.colors.mutedFg,
            fontSize: tokens.typography.body,
            fontWeight: selected ? "500" : "400",
            lineHeight: 19,
          }}
          numberOfLines={2}
        >
          {selected || placeholder}
        </Text>
        <ChevronDown size={20} color={tokens.colors.iconMuted} />
      </Pressable>
      <Text
        accessibilityLiveRegion={isInvalid ? "polite" : undefined}
        style={{
          color: isInvalid ? tokens.colors.danger : tokens.colors.mutedFg,
          fontSize: tokens.typography.caption,
          minHeight: 16,
        }}
      >
        {helperText}
      </Text>

      <AppModalSheet
        heightMode="medium"
        initialFocusRef={searchInputRef}
        onRequestClose={closeSheet}
        restoreFocusRef={triggerRef}
        title={label}
        variant="menu"
        visible={visible}
      >
        <Text
          accessibilityLiveRegion="polite"
          style={{
            color: tokens.colors.muted,
            fontSize: tokens.typography.caption,
            fontWeight: "500",
            marginBottom: 10,
          }}
        >
          {t("common.options.count", { count: filteredOptions.length })}
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderRadius: tokens.radius.md,
            borderWidth: 1,
            borderColor: tokens.colors.border,
            backgroundColor: tokens.colors.background,
            paddingHorizontal: 10,
            marginBottom: 10,
            gap: tokens.spacing.xs,
          }}
        >
          <Search size={16} color={tokens.colors.iconMuted} />
          <TextInput
            ref={searchInputRef}
            accessibilityLabel={searchPlaceholder}
            accessibilityRole="search"
            placeholder={searchPlaceholder}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            style={{
              flex: 1,
              minHeight: tokens.minHeight.touchTarget,
              color: tokens.colors.foreground,
              fontSize: tokens.typography.body,
            }}
            placeholderTextColor={tokens.colors.mutedFg}
          />
        </View>

        <FlatList
          data={filteredOptions}
          keyExtractor={(item) => item}
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: listMaxHeight }}
          contentContainerStyle={{ paddingBottom: tokens.spacing.xs }}
          renderItem={({ item }) => {
            const isSelected = item === selected;
            return (
              <Pressable
                accessibilityLabel={item}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: isSelected }}
                onPress={() => handleSelect(item)}
                style={{
                  minHeight: tokens.minHeight.touchTarget,
                  paddingHorizontal: 10,
                  paddingVertical: 10,
                  borderRadius: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: tokens.spacing.xs,
                  backgroundColor: isSelected ? tokens.colors.primarySofter : "transparent",
                }}
              >
                {isSelected ? (
                  <CheckCircle size={18} color={tokens.colors.primary} />
                ) : (
                  <Circle size={18} color={tokens.colors.iconMuted} />
                )}
                <Text
                  style={{
                    flex: 1,
                    color: isSelected ? tokens.colors.primaryDark : tokens.colors.dark700,
                    fontSize: tokens.typography.body,
                    fontWeight: "500",
                  }}
                  numberOfLines={2}
                >
                  {item}
                </Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={emptyState}
        />

        <Pressable
          accessibilityRole="button"
          style={{
            marginTop: 6,
            minHeight: tokens.minHeight.touchTarget,
            borderRadius: tokens.radius.md,
            borderWidth: 1,
            borderColor: tokens.colors.border,
            backgroundColor: tokens.colors.background,
            alignItems: "center",
            justifyContent: "center",
          }}
          onPress={closeSheet}
        >
          <Text
            style={{
              color: tokens.colors.dark700,
              fontSize: tokens.typography.body,
              fontWeight: "600",
            }}
          >
            {t("common.close")}
          </Text>
        </Pressable>
      </AppModalSheet>
    </View>
  );
});

SelectField.displayName = "SelectField";
