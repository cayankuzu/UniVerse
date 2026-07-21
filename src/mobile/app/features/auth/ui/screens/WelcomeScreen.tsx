import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { ArrowRight, Calendar, GraduationCap, TrendingUp, Users } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { AppText as Text } from "../../../../shared/components/AppText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../app-shell/navigation/types";
import { AppScrollView as ScrollView, GradientButton } from "../../../../shared/components";
import { tokens, withAlpha } from "../../../../shared/theme";
import { useTranslation } from "../../../../shared/i18n";
import { AuthBrandFooter } from "../components/AuthBrandFooter";
import { AuthLegalConsent } from "../components/AuthLegalConsent";
import { APP_NAME, APP_SLOGAN } from "../../application/authUiConfig";

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;

export function WelcomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [acceptedLegalTerms, setAcceptedLegalTerms] = useState(false);
  const { t } = useTranslation();
  const features = [
    {
      icon: <Users size={22} color={tokens.colors.primary} strokeWidth={1.5} />,
      bg: tokens.colors.primarySofter,
      title: t("welcome.feature.clubs.title"),
      desc: t("welcome.feature.clubs.subtitle"),
    },
    {
      icon: <Calendar size={22} color={tokens.colors.violet} strokeWidth={1.5} />,
      bg: tokens.colors.violetSoft,
      title: t("search.tab.events"),
      desc: t("welcome.feature.events.subtitle"),
    },
    {
      icon: <TrendingUp size={22} color={tokens.colors.successIcon} strokeWidth={1.5} />,
      bg: tokens.colors.successSoft,
      title: t("welcome.feature.follow.title"),
      desc: t("welcome.feature.follow.subtitle"),
    },
  ];

  const handleNavigate = (route: "Login" | "Register") => {
    if (route === "Register" && !acceptedLegalTerms) return;
    navigation.navigate(route);
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.colors.surface }}>
      <StatusBar backgroundColor={tokens.colors.primary} style="light" />
      <LinearGradient
        colors={[tokens.colors.primary, tokens.colors.primaryLight, tokens.colors.primaryDark]}
        style={{
          paddingHorizontal: tokens.spacing.xl,
          paddingTop: insets.top + 36,
          paddingBottom: 48,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            position: "absolute",
            right: -40,
            top: -40,
            width: 132,
            height: 132,
            borderRadius: tokens.radius.pill,
            backgroundColor: withAlpha(tokens.colors.onMedia, 0.12),
          }}
        />
        <View
          style={{
            position: "absolute",
            left: -20,
            bottom: 24,
            width: 78,
            height: 78,
            borderRadius: tokens.radius.pill,
            backgroundColor: withAlpha(tokens.colors.onMedia, 0.12),
          }}
        />
        <View style={{ alignItems: "center" }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: tokens.radius.card,
              backgroundColor: withAlpha(tokens.colors.onMedia, 0.22),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GraduationCap
              size={tokens.iconSize["2xl"]}
              color={tokens.colors.surface}
              strokeWidth={1.5}
            />
          </View>
          <Text
            style={{
              marginTop: tokens.spacing.mdPlus,
              color: tokens.colors.surface,
              fontSize: tokens.typography.hero,
              fontWeight: "800",
              letterSpacing: tokens.letterSpacing.displayTight,
            }}
          >
            {APP_NAME}
          </Text>
          <Text
            style={{
              marginTop: tokens.spacing.xsMinus,
              color: tokens.colors.primarySoft,
              fontSize: tokens.typography.body,
              fontWeight: "500",
              textAlign: "center",
            }}
          >
            {APP_SLOGAN}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: tokens.spacing.xl,
          paddingHorizontal: tokens.spacing.lg,
          paddingTop: tokens.spacing.xl,
          gap: tokens.spacing.compact,
        }}
      >
        {features.map((feature) => (
          <View
            key={feature.title}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.smPlus,
              borderRadius: tokens.radius.lg,
              borderWidth: 1,
              borderColor: withAlpha(tokens.colors.foreground, 0.06),
              backgroundColor: tokens.colors.surface,
              padding: tokens.spacing.md,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: tokens.radius.md,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: feature.bg,
              }}
            >
              {feature.icon}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: tokens.typography.subtitle,
                  fontWeight: "700",
                  color: tokens.colors.foreground,
                }}
              >
                {feature.title}
              </Text>
              <Text
                style={{
                  fontSize: tokens.typography.label,
                  color: tokens.colors.muted,
                  marginTop: tokens.spacing.micro,
                }}
              >
                {feature.desc}
              </Text>
            </View>
          </View>
        ))}

        <AuthLegalConsent
          accepted={acceptedLegalTerms}
          onToggleAccepted={() => setAcceptedLegalTerms((previous) => !previous)}
        />
      </ScrollView>

      <View
        style={{
          paddingHorizontal: tokens.spacing.lg,
          paddingBottom: Math.max(insets.bottom + 16, 24),
          gap: tokens.spacing.compact,
        }}
      >
        <GradientButton
          disabled={!acceptedLegalTerms}
          label={t("auth.login.register")}
          onPress={() => handleNavigate("Register")}
          size="lg"
          icon={<ArrowRight size={16} color={tokens.colors.surface} />}
        />
        <GradientButton
          label={t("auth.login.submit")}
          onPress={() => handleNavigate("Login")}
          variant="secondary"
          size="lg"
        />
        <AuthBrandFooter />
      </View>
    </View>
  );
}
