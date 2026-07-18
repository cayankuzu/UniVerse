import React from "react";
import { Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { CheckCircle, GraduationCap, XCircle } from "lucide-react-native";
import { useAuth } from "../../../../app-shell/auth";
import { safeResetToRoute } from "../../../../app-shell/navigation/safeReset";
import { tokens } from "../../../../shared/theme";
import { t } from "../../../../shared/i18n";
import { GradientButton } from "../components";
import type { RootStackParamList } from "../../../../app-shell/navigation/types";
import { useAuthCallbackScreenState } from "../../application/useAuthCallbackScreenState";

type Props = NativeStackScreenProps<RootStackParamList, "AuthCallback">;

export function AuthCallbackScreen({ navigation }: Props) {
  // Security boundary stays in auth domain state via hardSignOut("auth-recovery-failed").
  const { setPendingVerification, updateUserData } = useAuth();
  const { errorMessage, goToLogin, goToWelcome, status } = useAuthCallbackScreenState({
    goHome: React.useCallback(() => {
      safeResetToRoute(navigation, "Home");
    }, [navigation]),
    goToLogin: React.useCallback(() => {
      safeResetToRoute(navigation, "Login");
    }, [navigation]),
    goToWelcome: React.useCallback(() => {
      safeResetToRoute(navigation, "Welcome");
    }, [navigation]),
    setPendingVerification,
    updateUserData,
  });

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: tokens.colors.surface, paddingHorizontal: 24 }}
      edges={["top", "bottom"]}
    >
      {status === "loading" ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <View
            style={{
              width: 100,
              height: 100,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 24,
            }}
          >
            <View
              style={{
                position: "absolute",
                width: 100,
                height: 100,
                borderRadius: 26,
                backgroundColor: tokens.colors.primarySoft,
                opacity: 0.55,
              }}
            />
            <LinearGradient
              colors={[tokens.colors.primaryLight, tokens.colors.primaryDark]}
              style={{
                width: 84,
                height: 84,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <GraduationCap size={42} color={tokens.colors.surface} strokeWidth={1.5} />
            </LinearGradient>
          </View>
          <Text
            style={{
              color: tokens.colors.foreground,
              fontSize: 28,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            {t("auth.callback.verifying")}
          </Text>
          <Text
            style={{
              marginTop: 10,
              color: tokens.colors.muted,
              fontSize: 14,
              lineHeight: 21,
              textAlign: "center",
              maxWidth: 300,
            }}
          >
            {t("auth.callback.verifyingSubtitle")}
          </Text>
          <View style={{ marginTop: 18, flexDirection: "row", gap: 8 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: tokens.colors.primaryLight,
                opacity: 0.9,
              }}
            />
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: tokens.colors.primaryLight,
                opacity: 0.6,
              }}
            />
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: tokens.colors.primaryLight,
                opacity: 0.4,
              }}
            />
          </View>
        </View>
      ) : null}

      {status === "success" ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              backgroundColor: tokens.colors.successSurface,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 24,
            }}
          >
            <CheckCircle size={52} color={tokens.colors.successDark} />
          </View>
          <Text
            style={{
              color: tokens.colors.foreground,
              fontSize: 28,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            {t("auth.callback.success")}
          </Text>
          <Text
            style={{
              marginTop: 10,
              color: tokens.colors.muted,
              fontSize: 14,
              lineHeight: 21,
              textAlign: "center",
              maxWidth: 300,
            }}
          >
            {t("auth.callback.successSubtitle")}
          </Text>
        </View>
      ) : null}

      {status === "error" ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              backgroundColor: tokens.colors.dangerSoft,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 24,
            }}
          >
            <XCircle size={52} color={tokens.colors.danger} />
          </View>
          <Text
            style={{
              color: tokens.colors.foreground,
              fontSize: 28,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            {t("auth.callback.error")}
          </Text>
          <Text
            style={{
              marginTop: 10,
              color: tokens.colors.muted,
              fontSize: 14,
              lineHeight: 21,
              textAlign: "center",
              maxWidth: 300,
            }}
          >
            {errorMessage || t("auth.callback.errorFallback")}
          </Text>
          <View style={{ width: "100%", marginTop: 24, gap: 10 }}>
            <GradientButton label={t("auth.callback.goToLogin")} onPress={goToLogin} />
            <Pressable
              onPress={goToWelcome}
              style={{
                minHeight: 48,
                borderRadius: 16,
                backgroundColor: tokens.colors.surfaceVariant,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: tokens.colors.dark600, fontSize: 15, fontWeight: "700" }}>
                {t("auth.callback.goToHome")}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
