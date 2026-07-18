import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight, Calendar, GraduationCap, TrendingUp, Users } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../app-shell/navigation/types";
import { AppScrollView as ScrollView, GradientButton } from "../../../../shared/components";
import { tokens } from "../../../../shared/theme";
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
    if (!acceptedLegalTerms) return;
    navigation.navigate(route);
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.colors.surface }}>
      <LinearGradient
        colors={[tokens.colors.primary, tokens.colors.primaryLight, tokens.colors.primaryDark]}
        style={{
          paddingHorizontal: 24,
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
            width: 160,
            height: 160,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.12)",
          }}
        />
        <View
          style={{
            position: "absolute",
            left: -20,
            bottom: 24,
            width: 96,
            height: 96,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.12)",
          }}
        />
        <View style={{ alignItems: "center" }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              backgroundColor: "rgba(255,255,255,0.22)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GraduationCap size={30} color={tokens.colors.surface} strokeWidth={1.5} />
          </View>
          <Text
            style={{
              marginTop: 18,
              color: tokens.colors.surface,
              fontSize: 32,
              fontWeight: "800",
              letterSpacing: -0.5,
            }}
          >
            {APP_NAME}
          </Text>
          <Text
            style={{
              marginTop: 6,
              color: tokens.colors.primarySoft,
              fontSize: 14,
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
          paddingBottom: 24,
          paddingHorizontal: 20,
          paddingTop: 24,
          gap: 10,
        }}
      >
        {features.map((feature) => (
          <View
            key={feature.title}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "rgba(15,23,42,0.06)",
              backgroundColor: tokens.colors.surface,
              padding: 16,
              ...tokens.shadow.sm,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: feature.bg,
              }}
            >
              {feature.icon}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: tokens.colors.foreground }}>
                {feature.title}
              </Text>
              <Text style={{ fontSize: 13, color: tokens.colors.muted, marginTop: 2 }}>
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
        style={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom + 16, 24), gap: 10 }}
      >
        <GradientButton
          disabled={!acceptedLegalTerms}
          label={t("auth.login.register")}
          onPress={() => handleNavigate("Register")}
          size="lg"
          icon={<ArrowRight size={16} color={tokens.colors.surface} />}
        />
        <GradientButton
          disabled={!acceptedLegalTerms}
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
