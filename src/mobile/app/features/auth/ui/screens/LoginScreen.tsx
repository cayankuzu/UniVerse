import { Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { GraduationCap } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../../../../app-shell/auth";
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
import { useLoginScreenState } from "../../application/useLoginScreenState";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const { login, setPendingVerification, updateUserData } = useAuth();
  const { control, errors, handleLogin, isSubmitting } = useLoginScreenState({
    goToVerifyEmail: (email) => navigation.navigate("VerifyEmail", { email }),
    login,
    setPendingVerification,
    updateUserData,
  });

  return (
    <KeyboardSafeForm
      backgroundColor={tokens.colors.background}
      header={<BackHeader onBack={() => navigation.navigate("Welcome")} />}
      contentContainerStyle={{
        gap: 16,
        paddingBottom: 36,
        paddingHorizontal: 24,
        paddingTop: 24,
      }}
    >
      <LinearGradient
        colors={[tokens.colors.primaryLight, tokens.colors.primary]}
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <GraduationCap size={28} color={tokens.colors.surface} strokeWidth={1.5} />
      </LinearGradient>

      <View style={{ gap: 4 }}>
        <Text
          style={{
            fontSize: 30,
            fontWeight: "800",
            color: tokens.colors.foreground,
            letterSpacing: -0.5,
          }}
        >
          {t("auth.login.title")}
        </Text>
        <Text style={{ fontSize: 14, color: tokens.colors.muted }}>{t("auth.login.subtitle")}</Text>
      </View>

      {errors.root?.message ? (
        <View
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: tokens.colors.dangerBorder,
            backgroundColor: tokens.colors.dangerSoft,
            padding: 12,
          }}
        >
          <Text style={{ fontSize: 13, color: tokens.colors.dangerDark }}>
            {errors.root.message}
          </Text>
        </View>
      ) : null}

      <View style={{ gap: 12 }}>
        <AppTextField
          autoCapitalize="none"
          autoComplete="email"
          control={control}
          keyboardType="email-address"
          label={t("common.requiredEmail")}
          name="email"
          nextFieldName="password"
          placeholder="isim@gmail.com"
          returnKeyType="next"
          supportingText={t("auth.password.forgot.emailHint")}
        />
        <AppTextField
          autoCapitalize="none"
          autoComplete="current-password"
          control={control}
          label={t("common.requiredPassword")}
          name="password"
          placeholder="********"
          returnKeyType="done"
          secureTextEntry
        />
      </View>

      <TouchableOpacity
        accessibilityLabel={t("auth.login.forgotPassword")}
        accessibilityRole="button"
        onPress={() => navigation.navigate("ForgotPassword")}
        style={{
          alignSelf: "flex-start",
          justifyContent: "center",
          minHeight: tokens.minHeight.touchTarget,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: "600", color: tokens.colors.primary }}>
          {t("auth.login.forgotPassword")}
        </Text>
      </TouchableOpacity>

      <GradientButton
        disabled={isSubmitting}
        label={t("auth.login.submit")}
        loading={isSubmitting}
        onPress={() => void handleLogin()}
        size="lg"
      />

      <Text style={{ textAlign: "center", color: tokens.colors.muted, fontSize: 14 }}>
        {t("auth.login.noAccount")}{" "}
        <Text
          accessibilityRole="button"
          style={{ color: tokens.colors.primary, fontWeight: "700" }}
          onPress={() => navigation.navigate("Register")}
        >
          {t("auth.login.register")}
        </Text>
      </Text>

      <AuthBrandFooter />
    </KeyboardSafeForm>
  );
}
