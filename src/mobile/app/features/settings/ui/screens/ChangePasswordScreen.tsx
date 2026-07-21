import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckCircle, Mail, ShieldCheck } from "lucide-react-native";
import { PASSWORD_POLICY } from "../../../../shared/security/passwordPolicy";
import { tokens } from "../../../../shared/theme";
import { t } from "../../../../shared/i18n";
import type { RootStackParamList } from "../../../../app-shell/navigation/types";
import {
  AppTextField,
  BackHeader,
  GradientButton,
  KeyboardSafeForm,
} from "../../../../shared/components";
import { useChangePasswordScreenState } from "../../application/useChangePasswordScreenState";

type Props = NativeStackScreenProps<RootStackParamList, "ChangePassword">;

export function ChangePasswordScreen({ navigation }: Props) {
  const {
    canSubmit,
    control,
    currentPassword,
    currentPasswordInvalid,
    errors,
    handleBack,
    isSubmitting,
    sendResetMail,
    success,
    verifiedEmail,
  } = useChangePasswordScreenState({
    goBack: () => {
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    },
  });

  if (success) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.colors.surface }} edges={["bottom"]}>
        <BackHeader title={t("settings.password.title")} onBack={handleBack} />

        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: tokens.spacing.xl,
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: tokens.radius["2xl"],
              backgroundColor: tokens.colors.successSurface,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CheckCircle size={36} color={tokens.colors.successDark} strokeWidth={1.7} />
          </View>

          <Text
            style={{
              marginTop: tokens.spacing.lgPlus,
              color: tokens.colors.foreground,
              fontSize: tokens.typography.heading,
              fontWeight: tokens.fontWeight.bold,
              textAlign: "center",
            }}
          >
            {t("settings.password.successTitle")}
          </Text>
          <Text
            style={{
              marginTop: tokens.spacing.xs,
              color: tokens.colors.muted,
              fontSize: tokens.typography.body,
              lineHeight: tokens.lineHeight.bodyRelaxed,
              textAlign: "center",
              maxWidth: 320,
            }}
          >
            {t("settings.password.successSubtitle", { email: verifiedEmail })}
          </Text>

          <View style={{ marginTop: 26, width: "100%", gap: tokens.spacing.compact }}>
            <GradientButton
              label={t("auth.password.forgot.resend")}
              onPress={() => void sendResetMail()}
              loading={isSubmitting}
              disabled={isSubmitting}
            />
            <GradientButton
              label={t("settings.editProfile.backToSettings")}
              onPress={handleBack}
              variant="secondary"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardSafeForm
      backgroundColor={tokens.colors.surface}
      header={<BackHeader title={t("settings.password.title")} onBack={handleBack} />}
      scrollProps={{ showsVerticalScrollIndicator: false }}
      contentContainerStyle={{
        paddingHorizontal: tokens.spacing.xl,
        paddingTop: tokens.spacing.lg,
      }}
    >
      <View style={{ flex: 1, gap: tokens.spacing.smPlus }}>
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: tokens.radius.lg,
            backgroundColor: tokens.colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ShieldCheck
            size={tokens.iconSize["3xl"]}
            color={tokens.colors.surface}
            strokeWidth={1.7}
          />
        </View>

        <View style={{ gap: tokens.spacing.microPlus }}>
          <Text
            style={{
              color: tokens.colors.foreground,
              fontSize: tokens.typography.display,
              fontWeight: tokens.fontWeight.bold,
              letterSpacing: tokens.letterSpacing.helper,
            }}
          >
            {t("settings.password.heading")}
          </Text>
          <Text
            style={{
              color: tokens.colors.muted,
              fontSize: tokens.typography.body,
              lineHeight: tokens.lineHeight.bodyRelaxed,
            }}
          >
            {t("settings.password.subtitle")}
          </Text>
        </View>

        <View
          style={{
            borderRadius: tokens.radius.control,
            borderWidth: 1,
            borderColor: tokens.colors.primarySoft,
            backgroundColor: tokens.colors.primarySofter,
            paddingHorizontal: tokens.spacing.smPlus,
            paddingVertical: tokens.spacing.sm,
            flexDirection: "row",
            alignItems: "flex-start",
            gap: tokens.spacing.compact,
          }}
        >
          <Mail
            size={tokens.iconSize.lg}
            color={tokens.colors.primaryDark}
            style={{ marginTop: tokens.spacing.hairline }}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: tokens.colors.primaryDark,
                fontSize: tokens.typography.label,
                fontWeight: tokens.fontWeight.bold,
              }}
            >
              {t("settings.password.infoTitle")}
            </Text>
            <Text
              style={{
                marginTop: tokens.spacing.microPlus,
                color: tokens.colors.primaryDeep,
                fontSize: tokens.typography.caption,
                lineHeight: tokens.lineHeight.label,
              }}
            >
              {t("settings.password.infoBody")}
            </Text>
          </View>
        </View>

        {errors.root?.message ? (
          <View
            style={{
              borderRadius: tokens.radius.md,
              borderWidth: 1,
              borderColor: tokens.colors.dangerBorder,
              backgroundColor: tokens.colors.dangerSoft,
              paddingHorizontal: tokens.spacing.sm,
              paddingVertical: tokens.spacing.compact,
            }}
          >
            <Text
              style={{
                color: tokens.colors.dangerDark,
                fontSize: tokens.typography.label,
                fontWeight: tokens.fontWeight.medium,
              }}
            >
              {errors.root.message}
            </Text>
          </View>
        ) : null}

        <AppTextField
          autoCapitalize="none"
          autoComplete="current-password"
          control={control}
          label={t("settings.password.current")}
          name="currentPassword"
          placeholder={t("settings.password.currentPlaceholder")}
          secureTextEntry
        />

        {currentPasswordInvalid ? (
          <Text
            style={{
              marginTop: -6,
              color: tokens.colors.danger,
              fontSize: tokens.typography.caption,
            }}
          >
            {t("settings.password.error.invalidCurrent")}
          </Text>
        ) : null}

        <View style={{ gap: tokens.spacing.xsMinus }}>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.xsCompact }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: tokens.radius.pill,
                backgroundColor: currentPassword.trim()
                  ? tokens.colors.successDark
                  : tokens.colors.borderStrong,
              }}
            />
            <Text
              style={{
                color: currentPassword.trim() ? tokens.colors.successText : tokens.colors.mutedFg,
                fontSize: tokens.typography.caption,
              }}
            >
              {t("settings.password.tip.verify")}
            </Text>
          </View>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.xsCompact }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: tokens.radius.pill,
                backgroundColor: tokens.colors.borderStrong,
              }}
            />
            <Text style={{ color: tokens.colors.mutedFg, fontSize: tokens.typography.caption }}>
              {t("settings.password.tip.mail")}
            </Text>
          </View>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.xsCompact }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: tokens.radius.pill,
                backgroundColor: tokens.colors.borderStrong,
              }}
            />
            <Text style={{ color: tokens.colors.mutedFg, fontSize: tokens.typography.caption }}>
              {t("settings.password.newRule", {
                min: PASSWORD_POLICY.minLength,
                max: PASSWORD_POLICY.maxLength,
              })}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ marginTop: tokens.spacing.lg }}>
        <GradientButton
          disabled={!canSubmit}
          label={t("settings.password.submit")}
          loading={isSubmitting}
          onPress={() => void sendResetMail()}
          size="lg"
        />
      </View>
    </KeyboardSafeForm>
  );
}
