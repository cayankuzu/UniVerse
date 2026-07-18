import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
import { CheckCircle, ChevronDown, Circle, Search, SearchX, Shapes } from "lucide-react-native";
import { tokens } from "../../shared/theme";
import { t } from "../../shared/i18n";
import { TEXT_LIMITS } from "../../shared/validation/textLimits";
import { AppModalSheet } from "./AppModalSheet";
import { useKeyboardSafeField, useKeyboardSafeFormActions } from "./KeyboardSafeForm";

interface CategorySelectorProps {
  errorText?: string;
  fieldName?: string;
  label: string;
  selected: string[];
  options: string[];
  onChange: (next: string[]) => void;
  accent?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  maxSelections?: number;
  supportingText?: string;
}

const normalize = (value: string) => value.trim().toLocaleLowerCase("tr");

export function CategorySelector({
  label,
  selected,
  options,
  onChange,
  accent = tokens.colors.primary,
  errorText,
  fieldName,
  placeholder = t("search.filter.categoryPlaceholder"),
  searchPlaceholder = t("search.filter.categorySearch"),
  maxSelections = TEXT_LIMITS.category.maxSelections,
  supportingText,
}: CategorySelectorProps) {
  const { fontScale, height } = useWindowDimensions();
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [limitError, setLimitError] = useState("");
  const triggerRef = useRef<View>(null);
  const searchInputRef = useRef<TextInput>(null);
  const keyboardField = useKeyboardSafeField(fieldName);
  const keyboardActions = useKeyboardSafeFormActions();

  const sortedOptions = useMemo(
    () =>
      Array.from(new Set(options)).sort((a, b) =>
        a.localeCompare(b, "tr", { sensitivity: "base" }),
      ),
    [options],
  );

  const filteredOptions = useMemo(() => {
    const q = normalize(query);
    if (!q) return sortedOptions;
    return sortedOptions.filter((item) => normalize(item).includes(q));
  }, [query, sortedOptions]);

  useEffect(() => {
    if (!visible) {
      setQuery("");
      setLimitError("");
    }
  }, [visible]);

  const toggle = (item: string) => {
    if (selected.includes(item)) {
      onChange(selected.filter((v) => v !== item));
      return;
    }
    if (selected.length >= maxSelections) {
      setLimitError(t("common.maxSelection", { max: maxSelections }));
      return;
    }
    setLimitError("");
    onChange([...selected, item]);
  };
  useEffect(() => {
    if (!fieldName) return undefined;
    return keyboardActions?.registerFieldFocus(
      fieldName,
      () => setVisible(true),
      triggerRef.current,
    );
  }, [fieldName, keyboardActions]);
  const listMaxHeight = Math.max(180, Math.min(420, height * (fontScale >= 1.4 ? 0.34 : 0.42)));
  const resolvedError = errorText || limitError;
  const helperText = resolvedError || supportingText || "";
  const isInvalid = Boolean(resolvedError);

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
        accessibilityLabel={`${label}. ${selected.length > 0 ? t("common.selected.count", { count: selected.length }) : placeholder}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: visible }}
        style={{
          minHeight: tokens.minHeight.buttonXl,
          borderRadius: tokens.radius.md,
          borderWidth: 1,
          borderColor: isInvalid ? tokens.colors.danger : tokens.colors.border,
          backgroundColor: tokens.colors.background,
          paddingHorizontal: tokens.spacing.sm,
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.xs,
        }}
        onPress={() => {
          keyboardField.onFocus();
          setVisible(true);
        }}
      >
        <Shapes size={18} color={tokens.colors.mutedFg} />
        <Text
          style={{
            flex: 1,
            color: selected.length > 0 ? tokens.colors.foreground : tokens.colors.mutedFg,
            fontSize: tokens.typography.body,
            fontWeight: selected.length > 0 ? "500" : "400",
          }}
        >
          {selected.length > 0
            ? t("common.selected.count", { count: selected.length })
            : placeholder}
        </Text>
        <ChevronDown size={20} color={tokens.colors.mutedFg} />
      </Pressable>

      {selected.length > 0 ? (
        <View style={{ marginTop: 2, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {selected.slice(0, 8).map((item) => (
            <View
              key={item}
              style={{
                borderRadius: 10,
                paddingHorizontal: 10,
                paddingVertical: 6,
                backgroundColor: `${accent}1A`,
              }}
            >
              <Text style={{ fontSize: tokens.typography.tiny, fontWeight: "700", color: accent }}>
                {item}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
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
        onRequestClose={() => setVisible(false)}
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
            fontWeight: "600",
            marginBottom: 10,
          }}
        >
          {selected.length}/{maxSelections}
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
          <Search size={16} color={tokens.colors.mutedFg} />
          <TextInput
            ref={searchInputRef}
            accessibilityLabel={searchPlaceholder}
            accessibilityRole="search"
            autoCorrect={false}
            placeholder={searchPlaceholder}
            value={query}
            onChangeText={setQuery}
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
          ListEmptyComponent={
            <View style={{ minHeight: 64, alignItems: "center", justifyContent: "center", gap: 6 }}>
              <SearchX size={18} color={tokens.colors.mutedFg} />
              <Text style={{ color: tokens.colors.mutedFg, fontSize: tokens.typography.caption }}>
                {t("common.noResults")}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSelected = selected.includes(item);
            return (
              <Pressable
                accessibilityLabel={item}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                onPress={() => toggle(item)}
                style={{
                  minHeight: tokens.minHeight.touchTarget,
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: tokens.spacing.xs,
                  backgroundColor: isSelected ? `${accent}14` : "transparent",
                }}
              >
                {isSelected ? (
                  <CheckCircle size={18} color={accent} />
                ) : (
                  <Circle size={18} color={tokens.colors.mutedFg} />
                )}
                <Text
                  style={{
                    flex: 1,
                    color: isSelected ? accent : tokens.colors.dark700,
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
        />

        {resolvedError ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{
              marginTop: 6,
              color: tokens.colors.dangerDark,
              fontSize: tokens.typography.caption,
              fontWeight: "600",
            }}
          >
            {resolvedError}
          </Text>
        ) : null}

        <View style={{ marginTop: 10, flexDirection: "row", gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onChange([])}
            style={{
              flex: 1,
              minHeight: tokens.minHeight.touchTarget,
              borderRadius: tokens.radius.md,
              borderWidth: 1,
              borderColor: tokens.colors.border,
              backgroundColor: tokens.colors.background,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: tokens.colors.dark700,
                fontSize: tokens.typography.body,
                fontWeight: "700",
              }}
            >
              {t("common.clear")}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setVisible(false)}
            style={{
              flex: 1,
              minHeight: tokens.minHeight.touchTarget,
              borderRadius: tokens.radius.md,
              backgroundColor: accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: tokens.colors.surface,
                fontSize: tokens.typography.body,
                fontWeight: "700",
              }}
            >
              {t("common.done")}
            </Text>
          </Pressable>
        </View>
      </AppModalSheet>
    </View>
  );
}
