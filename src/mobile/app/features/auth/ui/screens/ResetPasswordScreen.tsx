import React from "react";
import { Text, View } from "react-native";
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
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Lock size={34} color={tokens.colors.primary} strokeWidth={1.5} />
          <Text style={{ color: tokens.colors.muted, fontSize: 14 }}>
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
          style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              backgroundColor: "#f0fdf4",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CheckCircle size={48} color="#22c55e" strokeWidth={1.5} />
          </View>
          <Text
            style={{
              marginTop: 24,
              color: tokens.colors.foreground,
              fontSize: 24,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            {t("auth.password.reset.successTitle")}
          </Text>
          <Text
            style={{
              marginTop: 10,
              color: tokens.colors.muted,
              fontSize: 14,
              lineHeight: 21,
              textAlign: "center",
            }}
          >
            {t("auth.password.reset.successSubtitle")}
          </Text>
          <View style={{ marginTop: 24, width: "100%" }}>
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
            gap: 12,
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 8,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: tokens.colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Lock size={20} color={tokens.colors.surface} strokeWidth={1.5} />
          </View>
          <Text style={{ color: tokens.colors.foreground, fontSize: 18, fontWeight: "700" }}>
            {t("auth.password.reset.title")}
          </Text>
        </View>
      }
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingVertical: 24,
      }}
    >
      <Text style={{ color: tokens.colors.muted, fontSize: 14, marginBottom: 20 }}>
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
        containerStyle={{ marginTop: 12 }}
        control={control}
        label={t("auth.password.reset.confirm")}
        name="confirmPassword"
        returnKeyType="done"
        secureTextEntry
      />

      {errors.root?.message ? (
        <View
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#fecaca",
            backgroundColor: "#fef2f2",
            paddingHorizontal: 12,
            paddingVertical: 10,
            marginTop: 12,
          }}
        >
          <Text style={{ color: "#dc2626", fontSize: 13, fontWeight: "500" }}>
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
