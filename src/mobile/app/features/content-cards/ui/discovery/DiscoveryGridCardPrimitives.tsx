import React from "react";
import { Text, View } from "react-native";
import { Globe, Users } from "lucide-react-native";
import { Avatar } from "../../../../shared/components/Avatar";
import { tokens } from "../../../../shared/theme";

type EventAccessKind = "general" | "members_only" | "public";
type ImageVariants = {
  full?: string | null;
  medium?: string | null;
  thumbnail?: string | null;
};

function resolveAccessVisual(kind: EventAccessKind) {
  if (kind === "members_only") {
    return {
      Icon: Users,
      bg: tokens.colors.dangerSoft,
      border: tokens.colors.dangerBorder,
      color: tokens.colors.dangerDark,
    };
  }
  if (kind === "general") {
    return {
      Icon: Users,
      bg: tokens.colors.accent,
      border: tokens.colors.primaryBorder,
      color: tokens.colors.primaryDark,
    };
  }
  return {
    Icon: Globe,
    bg: tokens.colors.successSoft,
    border: tokens.colors.successBorder,
    color: tokens.colors.success,
  };
}

export function AccessChip({ label, kind }: { label: string; kind: EventAccessKind }) {
  const visual = resolveAccessVisual(kind);
  return (
    <View
      style={{
        marginTop: 6,
        marginHorizontal: tokens.spacing.xs,
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.xxs,
        borderRadius: tokens.radius.pill,
        borderWidth: 1,
        borderColor: visual.border,
        backgroundColor: visual.bg,
        paddingHorizontal: 7,
        paddingVertical: tokens.spacing.xxs,
      }}
    >
      <visual.Icon size={tokens.typography.micro} color={visual.color} />
      <Text
        style={{
          color: visual.color,
          fontSize: tokens.typography.micro,
          fontWeight: tokens.fontWeight.bold,
          lineHeight: tokens.typography.caption,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export function VisibilityChip({ label, type }: { label: string; type: "club" | "own" }) {
  const visual =
    type === "club"
      ? {
          bg: tokens.colors.successSoft,
          border: tokens.colors.successBorder,
          color: tokens.colors.success,
        }
      : {
          bg: tokens.colors.warningSurface,
          border: tokens.colors.warningBorder,
          color: tokens.colors.warning,
        };
  return (
    <View
      style={{
        marginTop: 6,
        marginHorizontal: tokens.spacing.xs,
        alignSelf: "flex-start",
        borderRadius: tokens.radius.pill,
        borderWidth: 1,
        borderColor: visual.border,
        backgroundColor: visual.bg,
        paddingHorizontal: 7,
        paddingVertical: tokens.spacing.xxs,
      }}
    >
      <Text
        style={{
          color: visual.color,
          fontSize: tokens.typography.micro,
          fontWeight: tokens.fontWeight.bold,
          lineHeight: tokens.typography.caption,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export function OwnerRow({
  image,
  imageVariants,
  name,
  university,
}: {
  image: string;
  imageVariants?: ImageVariants;
  name: string;
  university: string;
}) {
  return (
    <View
      style={{
        marginTop: 6,
        paddingHorizontal: tokens.spacing.xs,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      <Avatar uri={image} variants={imageVariants} name={name} size={22} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            color: tokens.colors.foreground,
            fontSize: tokens.typography.tiny,
            fontWeight: tokens.fontWeight.bold,
            lineHeight: 14,
          }}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          style={{ color: tokens.colors.muted, fontSize: tokens.typography.micro, lineHeight: 13 }}
          numberOfLines={1}
        >
          {university}
        </Text>
      </View>
    </View>
  );
}
