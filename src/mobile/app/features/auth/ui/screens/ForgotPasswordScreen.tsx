import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle, Mail, RefreshCw } from "lucide-react-native";
import { useForm } from "react-hook-form";
import { tokens } from "../../../../shared/theme";
import { t } from "../../../../shared/i18n";
import type { RootStackParamList } from "../../../../app-shell/navigation/types";
import {
  AppTextField,
  BackHeader,
  GradientButton,
  KeyboardSafeForm,
} from "../../../../shared/components";
import { AuthBrandFooter } from "../components";
import { forgotPasswordSchema, type ForgotPasswordForm } from "../../domain/schemas";
import { sendForgotPasswordResetMail, toForgotPasswordUiErrorMessage } from "../../data";

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [sent, setSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const {
    control,
    getValues,
    formState: { errors, isSubmitting },
    handleSubmit,
    setError,
    watch,
  } = useForm<ForgotPasswordForm>({
    defaultValues: { email: "" },
    resolver: zodResolver(forgotPasswordSchema),
  });
  const email = watch("email");

  const sendResetMail = handleSubmit(async ({ email }) => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { error } = await sendForgotPasswordResetMail(normalizedEmail);
      if (error) throw error;
      setSubmittedEmail(normalizedEmail);
      setSent(true);
    } catch (error) {
      setError("root", {
        message: toForgotPasswordUiErrorMessage(error, t("settings.password.error.default")),
      });
    }
  });

  const resendResetMail = async () => {
    const currentEmail = getValues("email").trim().toLowerCase();
    if (!currentEmail || isSubmitting) return;
    try {
      const { error } = await sendForgotPasswordResetMail(currentEmail);
      if (error) throw error;
      setSubmittedEmail(currentEmail);
      setError("root", { message: "" });
    } catch (error) {
      setError("root", { message: toForgotPasswordUiErrorMessage(error, t("common.error")) });
    }
  };

  if (sent) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: tokens.colors.background }}
        edges={["top", "bottom"]}
      >
        <BackHeader
          title={t("auth.password.forgot.title")}
          onBack={() => navigation.navigate("Login")}
        />

        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
            paddingVertical: 20,
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              backgroundColor: tokens.colors.successSurface,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CheckCircle size={44} color={tokens.colors.successDark} strokeWidth={1.5} />
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
            {t("auth.password.forgot.sentTitle")}
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
            {t("auth.password.forgot.sentSubtitle", { email: submittedEmail })}
          </Text>

          <View style={{ width: "100%", marginTop: 28, gap: 10 }}>
            <GradientButton
              label={t("auth.password.forgot.back")}
              onPress={() => navigation.navigate("Login")}
            />
            <Pressable
              disabled={isSubmitting}
              onPress={() => void resendResetMail()}
              style={{
                minHeight: 48,
                borderRadius: 16,
                backgroundColor: tokens.colors.surfaceVariant,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              <RefreshCw size={16} color={tokens.colors.muted} strokeWidth={1.5} />
              <Text style={{ color: tokens.colors.dark600, fontSize: 15, fontWeight: "700" }}>
                {t("auth.password.forgot.resend")}
              </Text>
            </Pressable>
            {errors.root?.message ? (
              <Text
                style={{
                  color: tokens.colors.dangerDark,
                  textAlign: "center",
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                {errors.root.message}
              </Text>
            ) : null}
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
        <BackHeader
          title={t("auth.password.forgot.title")}
          onBack={() => navigation.navigate("Login")}
        />
      }
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingVertical: 22,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          backgroundColor: tokens.colors.primary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Mail size={30} color={tokens.colors.surface} strokeWidth={1.5} />
      </View>

      <Text
        style={{
          marginTop: 14,
          color: tokens.colors.foreground,
          fontSize: 30,
          fontWeight: "700",
          letterSpacing: 0.2,
        }}
      >
        {t("auth.password.forgot.heading")}
      </Text>
      <Text style={{ marginTop: 4, color: tokens.colors.muted, fontSize: 14, lineHeight: 21 }}>
        {t("auth.password.forgot.subtitle")}
      </Text>

      <AppTextField
        autoCapitalize="none"
        autoComplete="email"
        containerStyle={{ marginTop: 30 }}
        control={control}
        keyboardType="email-address"
        label={t("common.requiredEmail")}
        name="email"
        placeholder="isim@gmail.com"
        returnKeyType="done"
        supportingText={t("auth.password.forgot.emailHint")}
      />

      {errors.root?.message ? (
        <View
          style={{
            marginTop: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: tokens.colors.dangerBorder,
            backgroundColor: tokens.colors.dangerSoft,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: tokens.colors.dangerDark, fontSize: 13, fontWeight: "500" }}>
            {errors.root.message}
          </Text>
        </View>
      ) : null}

      <View style={{ marginTop: "auto" }}>
        <GradientButton
          disabled={!email.trim() || isSubmitting}
          label={t("auth.password.forgot.send")}
          loading={isSubmitting}
          onPress={() => void sendResetMail()}
        />
        <AuthBrandFooter />
      </View>
    </KeyboardSafeForm>
  );
}
