import { ChevronRight, GraduationCap, Users } from "lucide-react-native";
import { TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppScrollView, BackHeader } from "../../../../shared/components";
import { AppText as Text } from "../../../../shared/components/AppText";
import { tokens, withAlpha } from "../../../../shared/theme";
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
      icon: (
        <GraduationCap
          size={tokens.iconSize["2xl"]}
          color={tokens.colors.primary}
          strokeWidth={1.5}
        />
      ),
      iconBg: tokens.colors.primarySofter,
      route: "StudentRegister" as const,
      subtitle: t("auth.register.student.subtitle"),
      title: t("auth.register.student.title"),
    },
    {
      chevronColor: tokens.colors.violet,
      icon: <Users size={tokens.iconSize["2xl"]} color={tokens.colors.violet} strokeWidth={1.5} />,
      iconBg: tokens.colors.violetSoft,
      route: "ClubRegister" as const,
      subtitle: t("auth.register.club.subtitle"),
      title: t("auth.register.club.title"),
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: tokens.colors.background }}>
      <BackHeader onBack={() => navigation.navigate("Welcome")} />

      <AppScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: tokens.spacing.xl,
          paddingBottom: Math.max(insets.bottom + 20, 32),
          paddingTop: tokens.spacing.md,
        }}
      >
        <LinearGradient
          colors={[tokens.colors.primaryLight, tokens.colors.primaryDark]}
          style={{
            width: 46,
            height: 46,
            borderRadius: tokens.radius.lg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <GraduationCap
            size={tokens.iconSize["2xl"]}
            color={tokens.colors.surface}
            strokeWidth={1.5}
          />
        </LinearGradient>

        <Text
          style={{
            marginTop: tokens.spacing.smPlus,
            fontSize: tokens.typography.displayLarge,
            fontWeight: "800",
            color: tokens.colors.foreground,
            letterSpacing: tokens.letterSpacing.displayTight,
          }}
        >
          {t("auth.register.title")}
        </Text>
        <Text
          style={{
            marginTop: tokens.spacing.xxs,
            fontSize: tokens.typography.body,
            color: tokens.colors.muted,
          }}
        >
          {t("auth.register.subtitle")}
        </Text>

        <View style={{ marginTop: tokens.spacing.twoXl, gap: tokens.spacing.sm }}>
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
                gap: tokens.spacing.smPlus,
                borderRadius: tokens.radius.lg,
                backgroundColor: tokens.colors.surface,
                borderWidth: 1,
                borderColor: withAlpha(tokens.colors.foreground, 0.06),
                padding: tokens.spacing.md,
                minHeight: tokens.minHeight.row,
                ...tokens.shadow.sm,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: tokens.radius.control,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: option.iconBg,
                }}
              >
                {option.icon}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: tokens.typography.subtitle,
                    fontWeight: "700",
                    color: tokens.colors.foreground,
                  }}
                >
                  {option.title}
                </Text>
                <Text
                  style={{
                    marginTop: tokens.spacing.micro,
                    fontSize: tokens.typography.label,
                    color: tokens.colors.muted,
                  }}
                >
                  {option.subtitle}
                </Text>
              </View>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: tokens.radius.pill,
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
            marginTop: tokens.spacing.twoXl,
            textAlign: "center",
            color: tokens.colors.muted,
            fontSize: tokens.typography.body,
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
      </AppScrollView>
    </View>
  );
}
