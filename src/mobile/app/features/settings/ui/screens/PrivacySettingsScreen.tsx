import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Globe, Lock, Shield } from "lucide-react-native";
import { useAuth } from "../../../../app-shell/auth";
import { AppScrollView as ScrollView, BackHeader } from "../../../../shared/components";
import { useTranslation } from "../../../../shared/i18n";
import { useBottomNavPadding } from "../../../../shared/layout/bottomNavSpacing";
import type { RootStackParamList } from "../../../../app-shell/navigation/types";
import { usePrivacySettingsState } from "../../application/usePrivacySettingsState";
import {
  PrivacySettingsExplainCard,
  PrivacySettingsNotice,
  PrivacySettingsToggleCard,
  privacySettingsColors as C,
} from "./PrivacySettingsCards";

type Props = NativeStackScreenProps<RootStackParamList, "PrivacySettings">;

export function PrivacySettingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const bottomPadding = useBottomNavPadding(20, 36);
  const { t } = useTranslation();
  const { accountType, isPrivateAccount, setIsPrivateAccount, updateUserData, userData } =
    useAuth();
  const {
    handleBack,
    handleHideEmailToggle,
    handleTogglePrivacy,
    hideEmail,
    savingHideEmail,
    savingPrivacy,
  } = usePrivacySettingsState({
    accountType,
    goBack: () => {
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    },
    isPrivateAccount,
    setIsPrivateAccount,
    updateUserData,
    userData,
  });

  if (accountType === "club") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["bottom"]}>
        <BackHeader title={t("settings.privacy.title")} onBack={handleBack} />
        <View style={{ paddingHorizontal: 14, paddingTop: 14 }}>
          <PrivacySettingsNotice
            icon={<Shield size={20} color={C.blueText} style={{ marginTop: 1 }} />}
            title={t("settings.privacy.club.title")}
            body={t("settings.privacy.club.body")}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["bottom"]}>
      <BackHeader title={t("settings.privacy.title")} onBack={handleBack} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 14,
          paddingTop: 14,
          paddingBottom: Math.max(bottomPadding, insets.bottom + 24),
          gap: 10,
        }}
      >
        <PrivacySettingsNotice
          icon={<Shield size={20} color={C.blueText} style={{ marginTop: 1 }} />}
          title={t("settings.privacy.account.title")}
          body={t("settings.privacy.account.body")}
        />

        <PrivacySettingsToggleCard
          title={
            isPrivateAccount
              ? t("settings.privacy.state.private.title")
              : t("settings.privacy.state.public.title")
          }
          subtitle={
            isPrivateAccount
              ? t("settings.privacy.state.private.subtitle")
              : t("settings.privacy.state.public.subtitle")
          }
          stateSummary={
            isPrivateAccount
              ? t("settings.privacy.state.private.summary")
              : t("settings.privacy.state.public.summary")
          }
          stateDetail={
            isPrivateAccount
              ? t("settings.privacy.state.private.detail")
              : t("settings.privacy.state.public.detail")
          }
          enabled={isPrivateAccount}
          icon={
            isPrivateAccount ? (
              <Lock size={24} color="#d97706" strokeWidth={1.9} />
            ) : (
              <Globe size={24} color="#059669" strokeWidth={1.9} />
            )
          }
          iconBg={isPrivateAccount ? "#fffbeb" : "#ecfdf5"}
          onPress={handleTogglePrivacy}
          pending={savingPrivacy}
        />

        {savingPrivacy ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 4,
            }}
          >
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={{ color: C.muted, fontSize: 12 }}>{t("settings.privacy.saving")}</Text>
          </View>
        ) : null}

        <PrivacySettingsToggleCard
          title={
            hideEmail
              ? t("settings.privacy.email.hidden.title")
              : t("settings.privacy.email.visible.title")
          }
          subtitle={
            hideEmail
              ? t("settings.privacy.email.hidden.subtitle")
              : t("settings.privacy.email.visible.subtitle")
          }
          stateSummary={
            hideEmail
              ? t("settings.privacy.email.hidden.summary")
              : t("settings.privacy.email.visible.summary")
          }
          stateDetail={
            hideEmail
              ? t("settings.privacy.email.hidden.detail")
              : t("settings.privacy.email.visible.detail")
          }
          enabled={hideEmail}
          icon={
            hideEmail ? (
              <Lock size={24} color="#d97706" strokeWidth={1.9} />
            ) : (
              <Globe size={24} color="#059669" strokeWidth={1.9} />
            )
          }
          iconBg={hideEmail ? "#fffbeb" : "#ecfdf5"}
          onPress={() => void handleHideEmailToggle()}
          disabled={savingHideEmail}
        />

        <View style={{ gap: 8, marginTop: 4 }}>
          <PrivacySettingsExplainCard
            title={t("settings.privacy.explain.public.title")}
            icon={<Globe size={15} color="#059669" strokeWidth={2} />}
            iconBg="#ecfdf5"
            bulletColor="#059669"
            items={[
              t("settings.privacy.explain.public.item1"),
              t("settings.privacy.explain.public.item2"),
              t("settings.privacy.explain.public.item3"),
            ]}
          />

          <PrivacySettingsExplainCard
            title={t("settings.privacy.explain.private.title")}
            icon={<Lock size={15} color="#d97706" strokeWidth={2} />}
            iconBg="#fffbeb"
            bulletColor="#d97706"
            items={[
              t("settings.privacy.explain.private.item1"),
              t("settings.privacy.explain.private.item2"),
              t("settings.privacy.explain.private.item3"),
              t("settings.privacy.explain.private.item4"),
            ]}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
