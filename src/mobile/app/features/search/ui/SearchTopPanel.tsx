import React from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Search, SlidersHorizontal, X } from "lucide-react-native";
import { tokens } from "../../../shared/theme";
import { t } from "../../../shared/i18n";
import { TourAnchor } from "../../../app-shell/onboarding";
import type { SearchType } from "../domain/types";
import type { SortOption } from "../domain/types";
import { SearchFilterPanel } from "./SearchFilterPanel";
import { C, TABS } from "./searchHelpers";

interface Props {
  query: string;
  setQuery: (value: string) => void;
  supportsFilters: boolean;
  showFilters: boolean;
  setShowFilters: (next: boolean | ((prev: boolean) => boolean)) => void;
  activeFilterCount: number;
  type: SearchType;
  onSelectType: (value: SearchType) => void;
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  selectedUniversity: string;
  setSelectedUniversity: (value: string) => void;
  selectedFee: "" | "free" | "paid";
  setSelectedFee: (value: "" | "free" | "paid") => void;
  sortOption: SortOption;
  setSortOption: (value: SortOption) => void;
  topPanelBusy: boolean;
}

export function SearchTopPanel({
  query,
  setQuery,
  supportsFilters,
  showFilters,
  setShowFilters,
  activeFilterCount,
  type,
  onSelectType,
  selectedCategory,
  setSelectedCategory,
  selectedUniversity,
  setSelectedUniversity,
  selectedFee,
  setSelectedFee,
  sortOption,
  setSortOption,
  topPanelBusy,
}: Props) {
  return (
    <>
      <View
        style={{
          paddingHorizontal: 0,
          paddingTop: 6,
          paddingBottom: tokens.spacing.xs,
          backgroundColor: C.surface,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.xs }}>
          <TourAnchor tourId="search-bar" style={{ flex: 1 }}>
            <View
              style={{
                height: tokens.minHeight.touchTarget,
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: C.bg,
                borderRadius: tokens.radius.md,
                borderWidth: 1,
                borderColor: C.border,
                paddingHorizontal: tokens.spacing.sm,
                gap: tokens.spacing.xs,
              }}
            >
              <Search size={tokens.iconSize.md} color={C.muted} />
              <TextInput
                accessibilityLabel={t("search.a11y.searchInput")}
                autoCapitalize="none"
                maxLength={80}
                onChangeText={setQuery}
                placeholder={t("search.placeholder")}
                placeholderTextColor={tokens.colors.mutedFg}
                style={{ flex: 1, fontSize: tokens.typography.body, color: C.text }}
                value={query}
              />
              {topPanelBusy ? (
                <ActivityIndicator
                  accessibilityLabel="Arama güncelleniyor"
                  accessibilityRole="progressbar"
                  color={C.primary}
                  size="small"
                />
              ) : null}
              {query ? (
                <Pressable
                  accessibilityLabel={t("search.a11y.clearQuery")}
                  accessibilityRole="button"
                  onPress={() => setQuery("")}
                  style={{
                    alignItems: "center",
                    height: tokens.minHeight.touchTarget,
                    justifyContent: "center",
                    marginRight: -tokens.spacing.xs,
                    width: tokens.minHeight.touchTarget,
                  }}
                >
                  <X size={tokens.iconSize.md} color={C.muted} />
                </Pressable>
              ) : null}
            </View>
          </TourAnchor>
          {supportsFilters ? (
            <TourAnchor tourId="filter-button">
              <Pressable
                accessibilityLabel={t("search.a11y.filters")}
                accessibilityRole="button"
                accessibilityState={{ expanded: showFilters }}
                onPress={() => setShowFilters((prev) => !prev)}
                style={{
                  width: tokens.minHeight.touchTarget,
                  height: tokens.minHeight.touchTarget,
                  borderRadius: tokens.radius.md,
                  backgroundColor: showFilters ? tokens.colors.primarySofter : C.bg,
                  borderWidth: 1,
                  borderColor: showFilters ? tokens.colors.primaryBorder : C.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <SlidersHorizontal
                  size={tokens.iconSize.lg}
                  color={showFilters ? C.primary : C.muted}
                />
                {activeFilterCount > 0 ? (
                  <View
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      backgroundColor: C.primary,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: tokens.colors.surface,
                        fontSize: 8,
                        fontWeight: tokens.fontWeight.bold,
                      }}
                    >
                      {activeFilterCount}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            </TourAnchor>
          ) : null}
        </View>

        <TourAnchor tourId="search-tabs">
          <View style={{ flexDirection: "row", gap: 6 }}>
            {TABS.map((tab) => {
              const active = tab.key === type;
              return (
                <Pressable
                  accessibilityLabel={t("search.a11y.tab", { label: tab.label })}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  key={tab.key}
                  onPress={() => onSelectType(tab.key)}
                  style={{
                    flex: 1,
                    minHeight: tokens.minHeight.header,
                    borderRadius: tokens.radius.pill,
                    backgroundColor: active ? C.primary : C.border,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 4,
                    paddingHorizontal: 4,
                  }}
                >
                  {active ? tab.activeIcon : tab.icon}
                  <Text
                    style={{
                      color: active ? tokens.colors.surface : C.muted,
                      fontSize: tokens.typography.tiny,
                      fontWeight: tokens.fontWeight.bold,
                    }}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </TourAnchor>
      </View>

      <SearchFilterPanel
        onClear={() => {
          setSelectedCategory("");
          setSelectedUniversity("");
          setSelectedFee("");
          setSortOption("newest");
        }}
        selectedCategory={selectedCategory}
        selectedFee={selectedFee}
        selectedUniversity={selectedUniversity}
        setSelectedCategory={setSelectedCategory}
        setSelectedFee={setSelectedFee}
        setSelectedUniversity={setSelectedUniversity}
        setSortOption={setSortOption}
        show={showFilters}
        sortOption={sortOption}
        type={type}
      />
    </>
  );
}
