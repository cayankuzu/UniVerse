import React from "react";
import { Pressable, Text, View } from "react-native";
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
        paddingHorizontal: 14,
        paddingTop: 8,
        paddingBottom: 10,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable
          accessibilityLabel={t("notifications.a11y.back")}
          accessibilityRole="button"
          onPress={onBack}
          style={{
            width: tokens.minHeight.touchTarget,
            height: tokens.minHeight.touchTarget,
            borderRadius: 12,
            backgroundColor: tokens.colors.surfaceVariant,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ArrowLeft size={20} color={tokens.colors.iconMuted} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ color: tokens.colors.foreground, fontSize: 20, fontWeight: "700" }}>
            {t("notifications.title")}
          </Text>
          {unreadCount > 0 ? (
            <View
              style={{
                minWidth: 22,
                borderRadius: 999,
                backgroundColor: tokens.colors.danger,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <Text
                style={{
                  color: tokens.colors.surface,
                  fontSize: tokens.typography.tiny,
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
              minHeight: tokens.minHeight.touchTarget,
              borderRadius: 999,
              backgroundColor: tokens.colors.primarySofter,
              borderWidth: 1,
              borderColor: tokens.colors.primaryBorder,
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingHorizontal: 10,
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
        contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }}
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
                minHeight: tokens.minHeight.touchTarget,
                borderRadius: 999,
                paddingHorizontal: 12,
                backgroundColor: active ? tokens.colors.primary : tokens.colors.surfaceVariant,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 5,
              }}
            >
              <Icon
                size={13}
                color={active ? tokens.colors.surface : item.color}
                strokeWidth={1.8}
              />
              <Text
                style={{
                  color: active ? tokens.colors.surface : tokens.colors.muted,
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
