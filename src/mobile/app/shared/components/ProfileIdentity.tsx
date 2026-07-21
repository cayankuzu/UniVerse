import { LinearGradient } from "expo-linear-gradient";
import { GraduationCap, Users } from "lucide-react-native";
import { View } from "react-native";
import { tokens, withAlpha } from "../theme";
import { AppText } from "./AppText";

type ProfileIdentityProps = {
  accountType?: string | null;
};

export function ProfileCoverPlaceholder({ accountType }: ProfileIdentityProps) {
  const isClub = accountType === "club";
  const Icon = isClub ? Users : GraduationCap;
  const identityColor = isClub ? tokens.colors.clubIdentity : tokens.colors.studentIdentity;

  return (
    <LinearGradient
      colors={[tokens.colors.primarySofter, withAlpha(identityColor, 0.2)]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: withAlpha(tokens.colors.surface, 0.78),
          borderColor: withAlpha(identityColor, 0.18),
          borderRadius: tokens.radius.pill,
          borderWidth: 1,
          height: 48,
          justifyContent: "center",
          width: 48,
        }}
      >
        <Icon color={identityColor} size={tokens.iconSize["2xl"]} strokeWidth={1.7} />
      </View>
    </LinearGradient>
  );
}

export function ProfileRoleBadge({ accountType }: ProfileIdentityProps) {
  const isClub = accountType === "club";
  const color = isClub ? tokens.colors.clubIdentity : tokens.colors.studentIdentity;

  return (
    <View
      style={{
        alignItems: "center",
        alignSelf: "flex-start",
        backgroundColor: withAlpha(color, 0.1),
        borderColor: withAlpha(color, 0.2),
        borderRadius: tokens.radius.pill,
        borderWidth: 1,
        justifyContent: "center",
        minHeight: 24,
        paddingHorizontal: tokens.spacing.xs,
      }}
    >
      <AppText
        variant="badge"
        style={{
          color,
          fontSize: tokens.typography.caption,
          lineHeight: tokens.lineHeight.caption,
        }}
      >
        {isClub ? "Kulüp" : "Öğrenci"}
      </AppText>
    </View>
  );
}
