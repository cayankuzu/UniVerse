import React from "react";
import { Pressable, Text, View } from "react-native";
import { tokens } from "../../../../shared/theme";

export const privacySettingsColors = {
  bg: "#f8fafc",
  blueText: "#1d4ed8",
  border: "rgba(15,23,42,0.08)",
  muted: "#64748b",
  surface: "#ffffff",
  text: "#0f172a",
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
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#bfdbfe",
        backgroundColor: "#eff6ff",
        padding: 14,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      {icon}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: privacySettingsColors.blueText,
            fontSize: 14,
            fontWeight: "700",
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            marginTop: 3,
            color: "#1e40af",
            fontSize: 12,
            lineHeight: 18,
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
  const statusBg = enabled ? "#fff7ed" : "#f8fafc";
  const statusBorder = enabled ? "#fdba74" : "#cbd5e1";
  const statusText = enabled ? "#c2410c" : "#475569";

  return (
    <Pressable
      accessibilityLabel={`${title}. ${stateSummary}. ${stateDetail}`}
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled, disabled: Boolean(disabled), busy: Boolean(pending) }}
      onPress={onPress}
      disabled={disabled}
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: privacySettingsColors.border,
        backgroundColor: privacySettingsColors.surface,
        paddingHorizontal: 14,
        paddingVertical: 14,
        minHeight: tokens.minHeight.touchTarget,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        opacity: disabled ? 0.85 : 1,
      }}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 14,
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
            fontSize: 15,
            fontWeight: "700",
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            marginTop: 3,
            color: privacySettingsColors.muted,
            fontSize: 12,
            lineHeight: 17,
          }}
        >
          {subtitle}
        </Text>
        <View
          style={{
            marginTop: 9,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: statusBorder,
            backgroundColor: statusBg,
            paddingHorizontal: 10,
            paddingVertical: 8,
            gap: 3,
          }}
        >
          <Text style={{ color: statusText, fontSize: 11, fontWeight: "700" }}>{stateSummary}</Text>
          {pending ? (
            <Text
              style={{ color: statusText, fontSize: tokens.typography.caption, fontWeight: "700" }}
            >
              Değişiklik kaydediliyor...
            </Text>
          ) : null}
          <Text style={{ color: statusText, fontSize: 11, lineHeight: 15 }}>{stateDetail}</Text>
        </View>
      </View>

      <View
        accessible={false}
        style={{
          width: 48,
          height: 28,
          borderRadius: 999,
          backgroundColor: enabled ? "#f59e0b" : "#e2e8f0",
          padding: 2,
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 999,
            backgroundColor: "#ffffff",
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
        borderRadius: 16,
        borderWidth: 1,
        borderColor: privacySettingsColors.border,
        backgroundColor: privacySettingsColors.surface,
        padding: 14,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
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
            fontSize: 14,
            fontWeight: "700",
          }}
        >
          {title}
        </Text>
      </View>

      <View style={{ gap: 6 }}>
        {items.map((item) => (
          <View key={item} style={{ flexDirection: "row", alignItems: "flex-start", gap: 7 }}>
            <Text style={{ color: bulletColor, fontSize: 12, marginTop: 2 }}>*</Text>
            <Text
              style={{
                color: privacySettingsColors.muted,
                fontSize: 12,
                lineHeight: 17,
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
