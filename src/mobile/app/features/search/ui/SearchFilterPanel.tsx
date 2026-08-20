import { Pressable, View } from "react-native";
import { AppText as Text } from "../../../shared/components/AppText";
import { X } from "lucide-react-native";
import { SelectField } from "../../../shared/components/SelectField";
import { categories, universities } from "../../../shared/catalog/taxonomy";
import { tokens } from "../../../shared/theme";
import { t } from "../../../shared/i18n";
import type { SearchType } from "../domain/types";
import type { SortOption } from "../domain/types";

interface Props {
  show: boolean;
  type: SearchType;
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  selectedUniversity: string;
  setSelectedUniversity: (value: string) => void;
  selectedFee: "" | "free" | "paid";
  setSelectedFee: (value: "" | "free" | "paid") => void;
  sortOption: SortOption;
  setSortOption: (value: SortOption) => void;
  onClear: () => void;
}

function renderSortChips(
  options: Array<{ key: SortOption; label: string }>,
  sortOption: SortOption,
  setSortOption: (value: SortOption) => void,
) {
  return (
    <View style={{ flexDirection: "row", gap: tokens.spacing.xs, flexWrap: "wrap" }}>
      {options.map((item) => (
        <Pressable
          accessibilityLabel={item.label}
          accessibilityRole="button"
          accessibilityState={{ selected: sortOption === item.key }}
          key={item.key}
          onPress={() => setSortOption(item.key)}
          style={{
            borderRadius: tokens.radius.pill,
            backgroundColor:
              sortOption === item.key ? tokens.colors.primarySoft : tokens.colors.background,
            borderWidth: 1,
            borderColor:
              sortOption === item.key ? tokens.colors.primaryBorder : tokens.colors.border,
            paddingHorizontal: tokens.spacing.sm,
            minHeight: tokens.minHeight.chipSm,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: sortOption === item.key ? tokens.colors.primary : tokens.colors.muted,
              fontSize: tokens.typography.caption,
              fontWeight: tokens.fontWeight.bold,
            }}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function SearchFilterPanel({
  show,
  type,
  selectedCategory,
  setSelectedCategory,
  selectedUniversity,
  setSelectedUniversity,
  selectedFee,
  setSelectedFee,
  sortOption,
  setSortOption,
  onClear,
}: Props) {
  if (!show) return null;

  const sortOptions =
    type === "albums"
      ? [
          { key: "newest" as const, label: t("search.filter.sort.newest") },
          { key: "oldest" as const, label: t("search.filter.sort.oldest") },
          { key: "most_liked" as const, label: t("search.filter.sort.mostLiked") },
          { key: "most_comments" as const, label: t("search.filter.sort.mostComments") },
        ]
      : type === "events"
        ? [
            { key: "newest" as const, label: t("search.filter.sort.newest") },
            { key: "oldest" as const, label: t("search.filter.sort.oldest") },
            { key: "date_asc" as const, label: t("search.filter.sort.dateAsc") },
            { key: "date_desc" as const, label: t("search.filter.sort.dateDesc") },
            { key: "most_liked" as const, label: t("search.filter.sort.mostLiked") },
            { key: "most_comments" as const, label: t("search.filter.sort.mostComments") },
            { key: "most_attended" as const, label: t("search.filter.sort.mostAttended") },
          ]
        : [
            { key: "newest" as const, label: t("search.filter.sort.newest") },
            { key: "oldest" as const, label: t("search.filter.sort.oldest") },
            { key: "alphabetical_asc" as const, label: t("search.filter.sort.az") },
            { key: "alphabetical_desc" as const, label: t("search.filter.sort.za") },
          ];

  return (
    <View
      style={{
        backgroundColor: tokens.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: tokens.colors.border,
        paddingHorizontal: tokens.spacing.md,
        paddingBottom: tokens.spacing.sm,
        gap: tokens.spacing.xs,
      }}
    >
      {type === "events" || type === "clubs" ? (
        <SelectField
          label={t("search.filter.category")}
          value={selectedCategory}
          placeholder={t("search.filter.categoryPlaceholder")}
          options={categories}
          onSelect={setSelectedCategory}
          searchPlaceholder={t("search.filter.categorySearch")}
        />
      ) : null}

      {type === "events" || type === "clubs" || type === "students" ? (
        <SelectField
          label={t("search.filter.university")}
          value={selectedUniversity}
          placeholder={t("search.filter.universityPlaceholder")}
          options={universities}
          onSelect={setSelectedUniversity}
          searchPlaceholder={t("search.filter.universitySearch")}
        />
      ) : null}

      {renderSortChips(sortOptions, sortOption, setSortOption)}

      {type === "events" ? (
        <>
          <View style={{ flexDirection: "row", gap: tokens.spacing.xs }}>
            {[
              { key: "free", label: t("search.filter.fee.free") },
              { key: "paid", label: t("search.filter.fee.paid") },
            ].map((item) => (
              <Pressable
                accessibilityLabel={item.label}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedFee === item.key }}
                key={item.key}
                onPress={() =>
                  setSelectedFee(selectedFee === item.key ? "" : (item.key as "free" | "paid"))
                }
                style={{
                  flex: 1,
                  minHeight: tokens.minHeight.chipMd,
                  borderRadius: tokens.radius.sm,
                  backgroundColor:
                    selectedFee === item.key
                      ? tokens.colors.successSurface
                      : tokens.colors.background,
                  borderWidth: 1,
                  borderColor:
                    selectedFee === item.key ? tokens.colors.successBorder : tokens.colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color:
                      selectedFee === item.key ? tokens.colors.successIcon : tokens.colors.muted,
                    fontSize: tokens.typography.caption,
                    fontWeight: tokens.fontWeight.bold,
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <Pressable
        accessibilityLabel={t("search.filter.clear")}
        accessibilityRole="button"
        onPress={onClear}
        style={{
          minHeight: tokens.minHeight.chipLg,
          borderRadius: tokens.radius.sm,
          backgroundColor: tokens.colors.background,
          borderWidth: 1,
          borderColor: tokens.colors.border,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: tokens.spacing.xxs + 2,
        }}
      >
        <X size={tokens.iconSize.sm} color={tokens.colors.muted} />
        <Text
          style={{
            color: tokens.colors.muted,
            fontSize: tokens.typography.caption,
            fontWeight: tokens.fontWeight.bold,
          }}
        >
          {t("search.filter.clear")}
        </Text>
      </Pressable>
    </View>
  );
}
