import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Pressable, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Mail, RefreshCw, ExternalLink, CheckCircle, AlertCircle } from "lucide-react-native";
import { useAuth } from "../../../../app-shell/auth";
import { safeResetToRoute } from "../../../../app-shell/navigation/safeReset";
import {
  AppScrollView as ScrollView,
  BackHeader,
  GradientButton,
} from "../../../../shared/components";
import { tokens } from "../../../../shared/theme";
import { t } from "../../../../shared/i18n";
import type { RootStackParamList } from "../../../../app-shell/navigation/types";
import { AuthBrandFooter } from "../components";
import {
  useVerifyEmailScreenState,
  VERIFY_EMAIL_STEPS,
} from "../../application/useVerifyEmailScreenState";

type Props = NativeStackScreenProps<RootStackParamList, "VerifyEmail">;

export function VerifyEmailScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { pendingVerification, setPendingVerification, updateUserData } = useAuth();
  const {
    checkMessage,
    checkSuccess,
    checking,
    countdown,
    email,
    goToLogin,
    handleCheckVerification,
    handleOpenMail,
    handleResend,
    resendError,
    resending,
    resent,
  } = useVerifyEmailScreenState({
    email: route.params?.email || "",
    goHome: React.useCallback(() => {
      safeResetToRoute(navigation, "Home");
    }, [navigation]),
    goToLogin: React.useCallback(() => {
      navigation.navigate("Login");
    }, [navigation]),
    goToWelcome: React.useCallback(() => {
      safeResetToRoute(navigation, "Welcome");
    }, [navigation]),
    pendingVerificationEmail: pendingVerification?.email,
    setPendingVerification,
    updateUserData,
  });

  if (!email) return null;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: tokens.colors.background }}
      edges={["top", "bottom"]}
    >
      <BackHeader title={t("auth.verify.title")} onBack={() => navigation.navigate("Welcome")} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: tokens.spacing.xl,
          alignItems: "center",
          paddingBottom: Math.max(insets.bottom + 16, 24),
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            width: 88,
            height: 88,
            marginTop: tokens.spacing.compact,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              position: "absolute",
              width: 88,
              height: 88,
              borderRadius: tokens.radius["3xl"],
              backgroundColor: tokens.colors.primaryBorder,
              opacity: 0.45,
              transform: [{ scale: 1.15 }],
            }}
          />
          <View
            style={{
              width: 78,
              height: 78,
              borderRadius: tokens.radius["2xl"],
              backgroundColor: tokens.colors.primary,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: tokens.colors.primaryBorder,
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.45,
              shadowRadius: 16,
              elevation: 6,
            }}
          >
            <Mail size={tokens.iconSize["3xl"]} color={tokens.colors.surface} strokeWidth={1.5} />
          </View>
        </View>

        <Text
          style={{
            marginTop: tokens.spacing.lgPlus,
            color: tokens.colors.foreground,
            fontSize: tokens.typography.displayLarge,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          {t("auth.verify.heading")}
        </Text>
        <Text
          style={{
            marginTop: tokens.spacing.compact,
            color: tokens.colors.muted,
            fontSize: tokens.typography.body,
            lineHeight: tokens.lineHeight.bodyRelaxed,
            textAlign: "center",
            maxWidth: 310,
          }}
        >
          <Text style={{ color: tokens.colors.dark700, fontWeight: "600" }}>{email}</Text>{" "}
          {t("auth.verify.sentTo", { email: "" }).replace("{email} ", "")}
        </Text>

        <View style={{ width: "100%", marginTop: tokens.spacing.xl, gap: tokens.spacing.compact }}>
          {VERIFY_EMAIL_STEPS.map((step, index) => (
            <View
              key={step}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: tokens.spacing.sm,
                borderRadius: tokens.radius.md,
                backgroundColor: tokens.colors.surface,
                paddingHorizontal: tokens.spacing.smPlus,
                paddingVertical: tokens.spacing.sm,
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: tokens.radius.pill,
                  backgroundColor: tokens.colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: tokens.colors.primary,
                    fontSize: tokens.typography.caption,
                    fontWeight: "800",
                  }}
                >
                  {index + 1}
                </Text>
              </View>
              <Text
                style={{ flex: 1, color: tokens.colors.dark700, fontSize: tokens.typography.body }}
              >
                {step}
              </Text>
            </View>
          ))}
        </View>

        {checkMessage ? (
          <View
            style={{
              width: "100%",
              marginTop: tokens.spacing.smPlus,
              borderRadius: tokens.radius.md,
              paddingHorizontal: tokens.spacing.sm,
              paddingVertical: tokens.spacing.compact,
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.xs,
              backgroundColor: checkSuccess
                ? tokens.colors.successSurface
                : tokens.colors.warningSoft,
            }}
          >
            {checkSuccess ? (
              <CheckCircle size={16} color={tokens.colors.successText} strokeWidth={1.5} />
            ) : (
              <AlertCircle size={16} color={tokens.colors.warningIcon} strokeWidth={1.5} />
            )}
            <Text
              style={{
                flex: 1,
                fontSize: tokens.typography.label,
                fontWeight: "500",
                color: checkSuccess ? tokens.colors.successText : tokens.colors.warningIcon,
              }}
            >
              {checkMessage}
            </Text>
          </View>
        ) : null}

        {resent && !checkMessage ? (
          <View
            style={{
              width: "100%",
              marginTop: tokens.spacing.smPlus,
              borderRadius: tokens.radius.md,
              paddingHorizontal: tokens.spacing.sm,
              paddingVertical: tokens.spacing.compact,
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.xs,
              backgroundColor: tokens.colors.successSurface,
            }}
          >
            <CheckCircle size={16} color={tokens.colors.successText} strokeWidth={1.5} />
            <Text
              style={{
                flex: 1,
                fontSize: tokens.typography.label,
                fontWeight: "500",
                color: tokens.colors.successText,
              }}
            >
              {t("auth.verify.resent")}
            </Text>
          </View>
        ) : null}

        {resendError ? (
          <View
            style={{
              width: "100%",
              marginTop: tokens.spacing.smPlus,
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
                fontWeight: "500",
              }}
            >
              {resendError}
            </Text>
          </View>
        ) : null}

        <View style={{ width: "100%", marginTop: tokens.spacing.lg, gap: tokens.spacing.compact }}>
          <GradientButton
            label={checking ? t("auth.verify.checking") : t("auth.verify.checkButton")}
            loading={checking}
            onPress={handleCheckVerification}
          />

          <Pressable
            accessibilityLabel={t("auth.verify.openMailApp")}
            accessibilityRole="button"
            onPress={handleOpenMail}
            style={{
              minHeight: 48,
              borderRadius: tokens.radius.lg,
              backgroundColor: tokens.colors.surfaceVariant,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: tokens.spacing.xs,
            }}
          >
            <ExternalLink size={16} color={tokens.colors.dark600} strokeWidth={1.5} />
            <Text
              style={{
                color: tokens.colors.dark600,
                fontSize: tokens.typography.control,
                fontWeight: "700",
              }}
            >
              {t("auth.verify.openMailApp")}
            </Text>
          </Pressable>

          <Pressable
            accessibilityLabel={
              countdown > 0
                ? t("auth.verify.resendCountdown", { countdown: String(countdown) })
                : t("auth.verify.resend")
            }
            accessibilityRole="button"
            accessibilityState={{ disabled: resending || countdown > 0, busy: resending }}
            onPress={handleResend}
            disabled={resending || countdown > 0}
            style={{
              minHeight: 48,
              borderRadius: tokens.radius.lg,
              borderWidth: 1,
              borderColor: tokens.colors.border,
              backgroundColor: tokens.colors.surface,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: tokens.spacing.xs,
              opacity: resending || countdown > 0 ? 0.6 : 1,
            }}
          >
            <RefreshCw size={16} color={tokens.colors.muted} strokeWidth={1.5} />
            <Text
              style={{
                color: tokens.colors.muted,
                fontSize: tokens.typography.control,
                fontWeight: "700",
              }}
            >
              {countdown > 0
                ? t("auth.verify.resendCountdown", { countdown: String(countdown) })
                : resending
                  ? t("auth.verify.resending")
                  : t("auth.verify.resend")}
            </Text>
          </Pressable>

          <Pressable
            accessibilityLabel={t("auth.verify.backToLogin")}
            accessibilityRole="button"
            onPress={goToLogin}
            style={{
              alignItems: "center",
              justifyContent: "center",
              minHeight: tokens.minHeight.buttonLg,
            }}
          >
            <Text
              style={{
                color: tokens.colors.mutedFg,
                fontSize: tokens.typography.label,
                fontWeight: "500",
              }}
            >
              {t("auth.verify.backToLogin")}
            </Text>
          </Pressable>
        </View>

        <Text
          style={{
            marginTop: tokens.spacing.md,
            color: tokens.colors.mutedFg,
            fontSize: tokens.typography.caption,
            lineHeight: tokens.lineHeight.label,
            textAlign: "center",
            maxWidth: 300,
          }}
        >
          {t("auth.verify.spamHint")}
        </Text>

        <AuthBrandFooter />
      </ScrollView>
    </SafeAreaView>
  );
}
