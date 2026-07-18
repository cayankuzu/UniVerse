import React from "react";
import { Text, View } from "react-native";
import { AppScrollView as ScrollView } from "../../../../shared/components";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../../../app-shell/auth";
import { safeResetToRoute } from "../../../../app-shell/navigation/safeReset";
import type { RootStackParamList } from "../../../../app-shell/navigation/types";
import { BackHeader } from "../../../../shared/components";
import { t } from "../../../../shared/i18n";
import { useBottomNavPadding } from "../../../../shared/layout/bottomNavSpacing";
import { tokens } from "../../../../shared/theme";
import { useSettingsScreenState } from "../../application/useSettingsScreenState";
import { SettingsDeleteAccountModal } from "./SettingsDeleteAccountModal";
import { SettingsSectionGroup } from "./SettingsSectionGroup";
import type { SettingsActionCardData } from "./settingsScreen.shared";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export function SettingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const bottomPadding = useBottomNavPadding(18, 32);
  const { accountType, blockedUsers, deleteAccount, logout } = useAuth();
  const {
    deletingAccount,
    handleBack,
    handleDeleteAccount,
    handleLogout,
    hideDeleteConfirm,
    loggingOut,
    operationError,
    sections,
    showDeleteConfirm,
    showDeleteConfirmModal,
  } = useSettingsScreenState({
    accountType,
    blockedUsersCount: blockedUsers.length,
    deleteAccount,
    goBack: () => {
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    },
    logout,
    resetToWelcome: () => safeResetToRoute(navigation, "Welcome"),
  });
  const handlePressItem = React.useCallback(
    (item: SettingsActionCardData) => {
      if (item.action === "logout") {
        void handleLogout();
        return;
      }
      if (item.action === "delete-account") {
        showDeleteConfirmModal();
        return;
      }
      if (item.route) {
        navigation.navigate(item.route);
      }
    },
    [handleLogout, navigation, showDeleteConfirmModal],
  );
  const handleDeleteConfirm = React.useCallback(() => {
    void handleDeleteAccount();
  }, [handleDeleteAccount]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.colors.background }} edges={["bottom"]}>
      <BackHeader title={t("settings.title")} onBack={handleBack} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: tokens.spacing.sm + 2,
          paddingTop: tokens.spacing.md,
          paddingBottom: Math.max(bottomPadding, insets.bottom + tokens.spacing.xl),
          gap: tokens.spacing.xs,
        }}
      >
        {operationError && !showDeleteConfirm ? (
          <View
            accessibilityLiveRegion="polite"
            style={{
              borderColor: tokens.colors.dangerBorder,
              borderRadius: tokens.radius.md,
              borderWidth: 1,
              backgroundColor: tokens.colors.dangerSoft,
              paddingHorizontal: tokens.spacing.sm,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: tokens.colors.dangerDark, fontSize: 13, fontWeight: "600" }}>
              {operationError}
            </Text>
          </View>
        ) : null}
        {sections.map((section) => (
          <SettingsSectionGroup key={section.key} onPressItem={handlePressItem} section={section} />
        ))}
      </ScrollView>

      <SettingsDeleteAccountModal
        bottomInset={Math.max(bottomPadding - 12, insets.bottom + 14)}
        deletingAccount={deletingAccount || loggingOut}
        errorMessage={showDeleteConfirm ? operationError : ""}
        onCancel={hideDeleteConfirm}
        onConfirm={handleDeleteConfirm}
        visible={showDeleteConfirm}
      />
    </SafeAreaView>
  );
}
