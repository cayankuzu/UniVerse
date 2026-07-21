import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckCircle, Lock } from "lucide-react-native";
import { safeResetToRoute } from "../../../../app-shell/navigation/safeReset";
import { PASSWORD_POLICY } from "../../../../shared/security/passwordPolicy";
import { tokens } from "../../../../shared/theme";
import { t } from "../../../../shared/i18n";
import type { RootStackParamList } from "../../../../app-shell/navigation/types";
import { AppTextField, GradientButton, KeyboardSafeForm } from "../../../../shared/components";
import { AuthBrandFooter } from "../components";
import { useResetPasswordScreenState } from "../../application/useResetPasswordScreenState";

type Props = NativeStackScreenProps<RootStackParamList, "ResetPassword">;

export function ResetPasswordScreen({ navigation }: Props) {
  // Security boundary stays in auth domain state via hardSignOut("reset-password-boundary").
  const { control, errors, goToLogin, hasSession, isSubmitting, onSubmit, success } =
    useResetPasswordScreenState({
      goToLogin: React.useCallback(() => {
        safeResetToRoute(navigation, "Login");
      }, [navigation]),
      replaceWithForgotPassword: React.useCallback(() => {
        navigation.replace("ForgotPassword");
      }, [navigation]),
    });

  if (!hasSession) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: tokens.colors.background }}
        edges={["top", "bottom"]}
      >
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: tokens.spacing.sm,
          }}
        >
          <Lock size={tokens.iconSize["3xl"]} color={tokens.colors.primary} strokeWidth={1.5} />
          <Text style={{ color: tokens.colors.muted, fontSize: tokens.typography.body }}>
            {t("auth.password.reset.checking")}
          </Text>
          <AuthBrandFooter />
        </View>
      </SafeAreaView>
    );
  }

  if (success) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: tokens.colors.background }}
        edges={["top", "bottom"]}
      >
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
            <CheckCircle size={36} color={tokens.colors.successDark} strokeWidth={1.5} />
          </View>
          <Text
            style={{
              marginTop: tokens.spacing.xl,
              color: tokens.colors.foreground,
              fontSize: tokens.typography.heading,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            {t("auth.password.reset.successTitle")}
          </Text>
          <Text
            style={{
              marginTop: tokens.spacing.compact,
              color: tokens.colors.muted,
              fontSize: tokens.typography.body,
              lineHeight: tokens.lineHeight.bodyRelaxed,
              textAlign: "center",
            }}
          >
            {t("auth.password.reset.successSubtitle")}
          </Text>
          <View style={{ marginTop: tokens.spacing.xl, width: "100%" }}>
            <GradientButton label={t("auth.login.submit")} onPress={goToLogin} />
          </View>
          <AuthBrandFooter />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardSafeForm
      backgroundColor={tokens.colors.background}
      header={
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: tokens.spacing.sm,
            paddingHorizontal: tokens.spacing.lg,
            paddingTop: tokens.spacing.xs,
            paddingBottom: tokens.spacing.xs,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: tokens.radius.md,
              backgroundColor: tokens.colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Lock size={20} color={tokens.colors.surface} strokeWidth={1.5} />
          </View>
          <Text
            style={{
              color: tokens.colors.foreground,
              fontSize: tokens.typography.cardTitle,
              fontWeight: "700",
            }}
          >
            {t("auth.password.reset.title")}
          </Text>
        </View>
      }
      contentContainerStyle={{
        paddingHorizontal: tokens.spacing.xl,
        paddingVertical: tokens.spacing.xl,
      }}
    >
      <Text
        style={{
          color: tokens.colors.muted,
          fontSize: tokens.typography.body,
          marginBottom: tokens.spacing.lg,
        }}
      >
        {t("auth.password.reset.subtitle")}
      </Text>

      <AppTextField
        autoCapitalize="none"
        autoComplete="new-password"
        control={control}
        label={t("auth.password.reset.password")}
        name="password"
        returnKeyType="next"
        secureTextEntry
        supportingText={t("settings.password.newRule", {
          min: PASSWORD_POLICY.minLength,
          max: PASSWORD_POLICY.maxLength,
        })}
      />

      <AppTextField
        autoCapitalize="none"
        autoComplete="new-password"
        containerStyle={{ marginTop: tokens.spacing.sm }}
        control={control}
        label={t("auth.password.reset.confirm")}
        name="confirmPassword"
        returnKeyType="done"
        secureTextEntry
      />

      {errors.root?.message ? (
        <View
          style={{
            borderRadius: tokens.radius.md,
            borderWidth: 1,
            borderColor: tokens.colors.dangerBorder,
            backgroundColor: tokens.colors.dangerSoft,
            paddingHorizontal: tokens.spacing.sm,
            paddingVertical: tokens.spacing.compact,
            marginTop: tokens.spacing.sm,
          }}
        >
          <Text
            style={{
              color: tokens.colors.danger,
              fontSize: tokens.typography.label,
              fontWeight: "500",
            }}
          >
            {errors.root.message}
          </Text>
        </View>
      ) : null}

      <View style={{ marginTop: "auto" }}>
        <GradientButton
          disabled={isSubmitting}
          label={t("auth.password.reset.submit")}
          loading={isSubmitting}
          onPress={() => void onSubmit()}
        />
        <AuthBrandFooter />
      </View>
    </KeyboardSafeForm>
  );
}
