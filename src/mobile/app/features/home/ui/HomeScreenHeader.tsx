import { Bell, GraduationCap, SlidersHorizontal } from "lucide-react-native";
import { View } from "react-native";
import { AppText as Text } from "../../../shared/components/AppText";
import { TourAnchor } from "../../../app-shell/onboarding";
import { AppIconButton } from "../../../shared/components";
import { t } from "../../../shared/i18n";
import { tokens } from "../../../shared/theme";
import { APP_NAME, APP_SLOGAN } from "../application/homeBranding";

interface HomeScreenHeaderProps {
  activeFilterCount: number;
  onNotificationsPress: () => void;
  onNotificationsPressIn?: () => void;
  onToggleFilters: () => void;
  showFilters: boolean;
  unread: number;
}

export function HomeScreenHeader({
  activeFilterCount,
  onNotificationsPress,
  onNotificationsPressIn,
  onToggleFilters,
  showFilters,
  unread,
}: HomeScreenHeaderProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: tokens.spacing.md,
        paddingVertical: tokens.spacing.xs,
        backgroundColor: tokens.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: tokens.colors.border,
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.compact, flex: 1 }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: tokens.radius.pill,
            backgroundColor: tokens.colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <GraduationCap size={18} color={tokens.colors.surface} strokeWidth={1.5} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: tokens.typography.header,
              fontWeight: "800",
              color: tokens.colors.text,
            }}
          >
            {APP_NAME}
          </Text>
          {APP_SLOGAN ? (
            <Text
              style={{ fontSize: tokens.typography.caption, color: tokens.colors.muted }}
              numberOfLines={1}
            >
              {APP_SLOGAN}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: tokens.spacing.xs }}>
        <TourAnchor tourId="feed-filter">
          <AppIconButton
            accessibilityLabel={t("home.a11y.filters")}
            badgeContent={activeFilterCount > 0 ? activeFilterCount : null}
            icon={({ color, size }) => (
              <SlidersHorizontal color={color} size={size} strokeWidth={1.5} />
            )}
            onPress={onToggleFilters}
            selected={showFilters}
            testID="home-feed-filter-button"
          />
        </TourAnchor>
        <TourAnchor tourId="notification-bell">
          <AppIconButton
            accessibilityLabel={t("home.a11y.notifications")}
            badgeContent={unread > 0 ? (unread > 99 ? "99+" : unread) : null}
            icon={({ color, size }) => <Bell color={color} size={size} strokeWidth={1.5} />}
            onPress={onNotificationsPress}
            onPressIn={onNotificationsPressIn}
            testID="home-notifications-button"
          />
        </TourAnchor>
      </View>
    </View>
  );
}
