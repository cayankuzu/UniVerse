import { ChevronRight, GraduationCap, Users } from "lucide-react-native";
import { Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackHeader } from "../../../../shared/components";
import { tokens } from "../../../../shared/theme";
import { useTranslation } from "../../../../shared/i18n";
import type { RootStackParamList } from "../../../../app-shell/navigation/types";
import { AuthBrandFooter } from "../components";

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

export function RegisterScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const options = [
    {
      chevronColor: tokens.colors.primary,
      icon: <GraduationCap size={26} color={tokens.colors.primary} strokeWidth={1.5} />,
      iconBg: tokens.colors.primarySofter,
      route: "StudentRegister" as const,
      subtitle: t("auth.register.student.subtitle"),
      title: t("auth.register.student.title"),
    },
    {
      chevronColor: tokens.colors.violet,
      icon: <Users size={26} color={tokens.colors.violet} strokeWidth={1.5} />,
      iconBg: tokens.colors.violetSoft,
      route: "ClubRegister" as const,
      subtitle: t("auth.register.club.subtitle"),
      title: t("auth.register.club.title"),
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: tokens.colors.background }}>
      <BackHeader onBack={() => navigation.navigate("Welcome")} />

      <View
        style={{
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingBottom: Math.max(insets.bottom + 20, 32),
        }}
      >
        <LinearGradient
          colors={[tokens.colors.primaryLight, tokens.colors.primaryDark]}
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

        <Text
          style={{
            marginTop: 14,
            fontSize: 30,
            fontWeight: "800",
            color: tokens.colors.foreground,
            letterSpacing: -0.5,
          }}
        >
          {t("auth.register.title")}
        </Text>
        <Text style={{ marginTop: 4, fontSize: 14, color: tokens.colors.muted }}>
          {t("auth.register.subtitle")}
        </Text>

        <View style={{ marginTop: 28, gap: 12 }}>
          {options.map((option) => (
            <TouchableOpacity
              accessibilityLabel={`${option.title}. ${option.subtitle}`}
              accessibilityRole="button"
              key={option.route}
              activeOpacity={0.8}
              onPress={() => navigation.navigate(option.route)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                borderRadius: 16,
                backgroundColor: tokens.colors.surface,
                borderWidth: 1,
                borderColor: "rgba(15,23,42,0.06)",
                padding: 16,
                minHeight: tokens.minHeight.touchTarget,
                ...tokens.shadow.sm,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: option.iconBg,
                }}
              >
                {option.icon}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: tokens.colors.foreground }}>
                  {option.title}
                </Text>
                <Text style={{ marginTop: 2, fontSize: 13, color: tokens.colors.muted }}>
                  {option.subtitle}
                </Text>
              </View>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: option.iconBg,
                }}
              >
                <ChevronRight size={18} color={option.chevronColor} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Text
          style={{
            marginTop: 28,
            textAlign: "center",
            color: tokens.colors.muted,
            fontSize: 14,
          }}
        >
          {t("auth.register.haveAccount")}{" "}
          <Text
            accessibilityRole="button"
            style={{ color: tokens.colors.primary, fontWeight: "700" }}
            onPress={() => navigation.navigate("Login")}
          >
            {t("auth.login.submit")}
          </Text>
        </Text>
        <AuthBrandFooter />
      </View>
    </View>
  );
}
