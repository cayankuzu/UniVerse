import { Calendar, Image as ImageIcon, UserCheck, Users, X } from "lucide-react-native";
import { AppText as Text } from "../../../shared/components/AppText";
import { Pressable, View } from "react-native";
import { t } from "../../../shared/i18n";
import { tokens } from "../../../shared/theme";
import type { EntityFilter, SourceFilter, TypeFilter } from "../application/useHomeScreenUiState";

interface Props {
  visible: boolean;
  sourceFilter: SourceFilter;
  setSourceFilter: (value: SourceFilter) => void;
  typeFilter: TypeFilter;
  setTypeFilter: (value: TypeFilter) => void;
  entityFilter: EntityFilter;
  setEntityFilter: (value: EntityFilter) => void;
  onReset: () => void;
}

export function HomeFilterPanel({
  visible,
  sourceFilter,
  setSourceFilter,
  typeFilter,
  setTypeFilter,
  entityFilter,
  setEntityFilter,
  onReset,
}: Props) {
  if (!visible) return null;

  const sourceOptions = [
    { key: "all", label: t("home.filter.source.all"), icon: Users },
    { key: "own", label: t("home.filter.source.own"), icon: UserCheck },
    { key: "following", label: t("home.filter.source.following"), icon: UserCheck },
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
      <Text
        style={{
          color: tokens.colors.muted,
          fontSize: tokens.typography.caption,
          fontWeight: tokens.fontWeight.bold,
        }}
      >
        {t("home.filter.source")}
      </Text>
      <View style={{ flexDirection: "row", gap: tokens.spacing.xs, flexWrap: "wrap" }}>
        {sourceOptions.map((item) => {
          const active = sourceFilter === item.key;
          return (
            <Pressable
              accessibilityLabel={item.label}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={item.key}
              onPress={() => setSourceFilter(item.key as SourceFilter)}
              style={{
                borderRadius: tokens.radius.pill,
                backgroundColor: active ? tokens.colors.primarySoft : tokens.colors.background,
                borderWidth: 1,
                borderColor: active ? tokens.colors.primaryBorder : tokens.colors.border,
                paddingHorizontal: tokens.spacing.sm,
                minHeight: tokens.minHeight.chipSm,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: tokens.spacing.xxs + 1,
              }}
            >
              <item.icon
                size={tokens.iconSize.xs}
                color={active ? tokens.colors.primary : tokens.colors.muted}
              />
              <Text
                style={{
                  color: active ? tokens.colors.primary : tokens.colors.muted,
                  fontSize: tokens.typography.caption,
                  fontWeight: tokens.fontWeight.bold,
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text
        style={{
          color: tokens.colors.muted,
          fontSize: tokens.typography.caption,
          fontWeight: tokens.fontWeight.bold,
        }}
      >
        {t("home.filter.contentType")}
      </Text>
      <View style={{ flexDirection: "row", gap: tokens.spacing.xs, flexWrap: "wrap" }}>
        {[
          { key: "all", label: t("home.filter.contentType.all"), icon: Users },
          { key: "events", label: t("home.filter.contentType.events"), icon: Calendar },
          { key: "albums", label: t("home.filter.contentType.albums"), icon: ImageIcon },
        ].map((item) => {
          const active = typeFilter === item.key;
          return (
            <Pressable
              accessibilityLabel={item.label}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={item.key}
              onPress={() => setTypeFilter(item.key as TypeFilter)}
              style={{
                borderRadius: tokens.radius.pill,
                backgroundColor: active ? tokens.colors.primarySoft : tokens.colors.background,
                borderWidth: 1,
                borderColor: active ? tokens.colors.primaryBorder : tokens.colors.border,
                paddingHorizontal: tokens.spacing.sm,
                minHeight: tokens.minHeight.chipSm,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: tokens.spacing.xxs + 1,
              }}
            >
              <item.icon
                size={tokens.iconSize.xs}
                color={active ? tokens.colors.primary : tokens.colors.muted}
              />
              <Text
                style={{
                  color: active ? tokens.colors.primary : tokens.colors.muted,
                  fontSize: tokens.typography.caption,
                  fontWeight: tokens.fontWeight.bold,
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text
        style={{
          color: tokens.colors.muted,
          fontSize: tokens.typography.caption,
          fontWeight: tokens.fontWeight.bold,
        }}
      >
        {t("home.filter.accountType")}
      </Text>
      <View style={{ flexDirection: "row", gap: tokens.spacing.xs }}>
        {[
          { key: "all", label: t("home.filter.accountType.all") },
          { key: "clubs", label: t("home.filter.accountType.clubs") },
          { key: "students", label: t("home.filter.accountType.students") },
        ].map((item) => {
          const active = entityFilter === item.key;
          return (
            <Pressable
              accessibilityLabel={item.label}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={item.key}
              onPress={() => setEntityFilter(item.key as EntityFilter)}
              style={{
                flex: 1,
                minHeight: tokens.minHeight.chipMd,
                borderRadius: tokens.radius.sm + 2,
                backgroundColor: active ? tokens.colors.primarySoft : tokens.colors.background,
                borderWidth: 1,
                borderColor: active ? tokens.colors.primaryBorder : tokens.colors.border,
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
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityLabel={t("home.filter.clear")}
        accessibilityRole="button"
        onPress={onReset}
        style={{
          minHeight: tokens.minHeight.chipLg,
          borderRadius: tokens.radius.sm + 2,
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
          {t("home.filter.clear")}
        </Text>
      </Pressable>
    </View>
  );
}
