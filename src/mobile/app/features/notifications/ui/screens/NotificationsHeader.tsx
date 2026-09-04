import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Pressable, View } from "react-native";
import { ArrowLeft, CheckCheck } from "lucide-react-native";
import { AppScrollView as ScrollView } from "../../../../shared/components";
import { t } from "../../../../shared/i18n";
import { tokens } from "../../../../shared/theme";
import { FILTERS, type FilterCategory } from "../../application/notificationsPresentation";

type Props = {
  activeFilter: FilterCategory;
  filterCounts: Record<FilterCategory, number>;
  unreadCount: number;
  visibleFilters: typeof FILTERS;
  markAllPending: boolean;
  onBack: () => void;
  onMarkAllRead: () => void;
  onSelectFilter: (filter: FilterCategory) => void;
};

export const NotificationsHeader = React.memo(function NotificationsHeader({
  activeFilter,
  filterCounts,
  unreadCount,
  visibleFilters,
  markAllPending,
  onBack,
  onMarkAllRead,
  onSelectFilter,
}: Props) {
  const displayUnreadCount = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderBottomColor: tokens.colors.border,
        backgroundColor: tokens.colors.surface,
        paddingHorizontal: tokens.spacing.smPlus,
        paddingTop: tokens.spacing.xs,
        paddingBottom: tokens.spacing.compact,
        gap: tokens.spacing.xs,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.xs }}>
        <Pressable
          accessibilityLabel={t("notifications.a11y.back")}
          accessibilityRole="button"
          onPress={onBack}
          style={{
            width: tokens.minHeight.header,
            height: tokens.minHeight.header,
            borderRadius: tokens.radius.md,
            backgroundColor: tokens.colors.surfaceVariant,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ArrowLeft size={tokens.iconSize.xl} color={tokens.colors.iconMuted} />
        </Pressable>
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: tokens.spacing.xsMinus,
          }}
        >
          <Text
            style={{
              color: tokens.colors.foreground,
              fontSize: tokens.typography.sectionTitle,
              fontWeight: "700",
            }}
          >
            {t("notifications.title")}
          </Text>
          {unreadCount > 0 ? (
            <View
              style={{
                minWidth: 22,
                borderRadius: tokens.radius.pill,
                backgroundColor: tokens.colors.primary,
                paddingHorizontal: tokens.spacing.xsMinus,
                paddingVertical: tokens.spacing.micro,
              }}
            >
              <Text
                style={{
                  color: tokens.colors.surface,
                  fontSize: tokens.typography.caption,
                  fontWeight: "800",
                  textAlign: "center",
                }}
              >
                {displayUnreadCount}
              </Text>
            </View>
          ) : null}
        </View>
        {unreadCount > 0 ? (
          <Pressable
            accessibilityLabel={t("notifications.a11y.markAllRead")}
            accessibilityRole="button"
            onPress={onMarkAllRead}
            disabled={markAllPending}
            style={{
              minHeight: tokens.minHeight.buttonSm,
              borderRadius: tokens.radius.pill,
              backgroundColor: tokens.colors.primarySofter,
              borderWidth: 1,
              borderColor: tokens.colors.primaryBorder,
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.xsMinus,
              paddingHorizontal: tokens.spacing.compact,
              opacity: markAllPending ? 0.65 : 1,
            }}
          >
            <CheckCheck size={14} color={tokens.colors.primary} />
            <Text
              style={{
                color: tokens.colors.primary,
                fontSize: tokens.typography.caption,
                fontWeight: "700",
              }}
            >
              {t("notifications.markAllRead")}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: tokens.spacing.xsMinus,
          paddingHorizontal: tokens.spacing.micro,
        }}
      >
        {visibleFilters.map((item) => {
          const Icon = item.icon;
          const active = activeFilter === item.key;
          return (
            <Pressable
              accessibilityLabel={t("notifications.a11y.filter", { label: item.label })}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={item.key}
              onPress={() => onSelectFilter(item.key)}
              style={{
                minHeight: tokens.minHeight.chipMd,
                borderRadius: tokens.radius.pill,
                paddingHorizontal: tokens.spacing.sm,
                backgroundColor: active
                  ? tokens.colors.primarySofter
                  : tokens.colors.surfaceVariant,
                borderColor: active ? tokens.colors.primaryBorder : tokens.colors.border,
                borderWidth: 1,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: tokens.spacing.xsMinus,
              }}
            >
              <Icon
                size={13}
                color={active ? tokens.colors.primary : item.color}
                strokeWidth={1.8}
              />
              <Text
                style={{
                  color: active ? tokens.colors.primary : tokens.colors.muted,
                  fontSize: tokens.typography.caption,
                  fontWeight: "700",
                }}
              >
                {item.label} ({filterCounts[item.key] || 0})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});
