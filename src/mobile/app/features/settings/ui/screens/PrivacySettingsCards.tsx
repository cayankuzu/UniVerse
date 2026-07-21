import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Pressable, View } from "react-native";
import { tokens, withAlpha } from "../../../../shared/theme";

export const privacySettingsColors = {
  bg: tokens.colors.background,
  blueText: tokens.colors.primaryDark,
  border: withAlpha(tokens.colors.foreground, 0.08),
  muted: tokens.colors.muted,
  surface: tokens.colors.onMedia,
  text: tokens.colors.foreground,
} as const;

type PrivacySettingsNoticeProps = {
  body: string;
  icon: React.ReactNode;
  title: string;
};

export function PrivacySettingsNotice({ body, icon, title }: PrivacySettingsNoticeProps) {
  return (
    <View
      style={{
        borderRadius: tokens.radius.lg,
        borderWidth: 1,
        borderColor: tokens.colors.primaryBorder,
        backgroundColor: tokens.colors.primarySofter,
        padding: tokens.spacing.smPlus,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: tokens.spacing.compact,
      }}
    >
      {icon}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: privacySettingsColors.blueText,
            fontSize: tokens.typography.body,
            fontWeight: "700",
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            marginTop: tokens.spacing.microPlus,
            color: tokens.colors.blueStrong,
            fontSize: tokens.typography.caption,
            lineHeight: tokens.lineHeight.label,
          }}
        >
          {body}
        </Text>
      </View>
    </View>
  );
}

type PrivacySettingsToggleCardProps = {
  disabled?: boolean;
  enabled: boolean;
  icon: React.ReactNode;
  iconBg: string;
  onPress: () => void;
  pending?: boolean;
  stateDetail: string;
  stateSummary: string;
  subtitle: string;
  title: string;
};

export function PrivacySettingsToggleCard({
  disabled,
  enabled,
  icon,
  iconBg,
  onPress,
  pending,
  stateDetail,
  stateSummary,
  subtitle,
  title,
}: PrivacySettingsToggleCardProps) {
  const statusBg = enabled ? tokens.colors.warningSurface : tokens.colors.background;
  const statusBorder = enabled ? tokens.colors.orangeBorderStrong : tokens.colors.borderStrong;
  const statusText = enabled ? tokens.colors.warning : tokens.colors.dark600;

  return (
    <Pressable
      accessibilityLabel={`${title}. ${stateSummary}. ${stateDetail}`}
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled, disabled: Boolean(disabled), busy: Boolean(pending) }}
      onPress={onPress}
      disabled={disabled}
      style={{
        borderRadius: tokens.radius.lg,
        borderWidth: 1,
        borderColor: privacySettingsColors.border,
        backgroundColor: privacySettingsColors.surface,
        paddingHorizontal: tokens.spacing.smPlus,
        paddingVertical: tokens.spacing.smPlus,
        minHeight: tokens.minHeight.row,
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.sm,
        opacity: disabled ? 0.85 : 1,
      }}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: tokens.radius.control,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: iconBg,
        }}
      >
        {icon}
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: privacySettingsColors.text,
            fontSize: tokens.typography.control,
            fontWeight: "700",
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            marginTop: tokens.spacing.microPlus,
            color: privacySettingsColors.muted,
            fontSize: tokens.typography.caption,
            lineHeight: tokens.lineHeight.caption,
          }}
        >
          {subtitle}
        </Text>
        <View
          style={{
            marginTop: tokens.spacing.xsPlus,
            borderRadius: tokens.radius.md,
            borderWidth: 1,
            borderColor: statusBorder,
            backgroundColor: statusBg,
            paddingHorizontal: tokens.spacing.compact,
            paddingVertical: tokens.spacing.xs,
            gap: tokens.spacing.microPlus,
          }}
        >
          <Text
            style={{ color: statusText, fontSize: tokens.typography.caption, fontWeight: "700" }}
          >
            {stateSummary}
          </Text>
          {pending ? (
            <Text
              style={{ color: statusText, fontSize: tokens.typography.caption, fontWeight: "700" }}
            >
              Değişiklik kaydediliyor...
            </Text>
          ) : null}
          <Text
            style={{
              color: statusText,
              fontSize: tokens.typography.caption,
              lineHeight: tokens.lineHeight.tiny,
            }}
          >
            {stateDetail}
          </Text>
        </View>
      </View>

      <View
        accessible={false}
        style={{
          width: 48,
          height: 28,
          borderRadius: tokens.radius.pill,
          backgroundColor: enabled ? tokens.colors.amber : tokens.colors.border,
          padding: tokens.spacing.micro,
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: tokens.radius.pill,
            backgroundColor: tokens.colors.onMedia,
            transform: [{ translateX: enabled ? 20 : 0 }],
          }}
        />
      </View>
    </Pressable>
  );
}

type PrivacySettingsExplainCardProps = {
  bulletColor: string;
  icon: React.ReactNode;
  iconBg: string;
  items: string[];
  title: string;
};

export function PrivacySettingsExplainCard({
  bulletColor,
  icon,
  iconBg,
  items,
  title,
}: PrivacySettingsExplainCardProps) {
  return (
    <View
      style={{
        borderRadius: tokens.radius.lg,
        borderWidth: 1,
        borderColor: privacySettingsColors.border,
        backgroundColor: privacySettingsColors.surface,
        padding: tokens.spacing.smPlus,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.compact,
          marginBottom: tokens.spacing.xs,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: tokens.radius.compact,
            backgroundColor: iconBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </View>
        <Text
          style={{
            color: privacySettingsColors.text,
            fontSize: tokens.typography.body,
            fontWeight: "700",
          }}
        >
          {title}
        </Text>
      </View>

      <View style={{ gap: tokens.spacing.xsMinus }}>
        {items.map((item) => (
          <View
            key={item}
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: tokens.spacing.xsCompact,
            }}
          >
            <Text
              style={{
                color: bulletColor,
                fontSize: tokens.typography.caption,
                marginTop: tokens.spacing.micro,
              }}
            >
              *
            </Text>
            <Text
              style={{
                color: privacySettingsColors.muted,
                fontSize: tokens.typography.caption,
                lineHeight: tokens.lineHeight.caption,
                flex: 1,
              }}
            >
              {item}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
