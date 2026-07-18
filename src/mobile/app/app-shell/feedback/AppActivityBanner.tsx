import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import type { OverflowActionItem } from "../../shared/components";
import { OverflowActionMenu } from "../../shared/components";
import { tokens } from "../../shared/theme";

export type AppActivityBannerTone = "error" | "info" | "success";

type Props = {
  actions: OverflowActionItem[];
  hint?: string;
  percent?: number;
  stage: string;
  title: string;
  tone: AppActivityBannerTone;
};

function getToneColors(tone: AppActivityBannerTone) {
  if (tone === "error") {
    return {
      border: "rgba(185, 28, 28, 0.24)",
      progress: tokens.colors.danger,
      progressTrack: "rgba(185, 28, 28, 0.12)",
      stage: tokens.colors.dangerDeep,
      title: tokens.colors.foreground,
    };
  }
  if (tone === "success") {
    return {
      border: "rgba(5, 150, 105, 0.24)",
      progress: tokens.colors.success,
      progressTrack: "rgba(5, 150, 105, 0.12)",
      stage: tokens.colors.success,
      title: tokens.colors.foreground,
    };
  }
  return {
    border: tokens.colors.border,
    progress: tokens.colors.primary,
    progressTrack: tokens.colors.primarySoft,
    stage: tokens.colors.primary,
    title: tokens.colors.foreground,
  };
}

export function AppActivityBanner({ actions, hint, percent, stage, title, tone }: Props) {
  const colors = getToneColors(tone);
  const normalizedPercent = Math.max(0, Math.min(100, Math.round(percent ?? 0)));
  const showSpinner = tone === "info";
  const accessibilityRole = showSpinner ? "progressbar" : "alert";
  const accessibilityLabel = [title, stage, hint, `${normalizedPercent}%`]
    .filter(Boolean)
    .join(". ");

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion={tone === "error" ? "assertive" : "polite"}
      accessibilityRole={accessibilityRole}
      accessibilityValue={showSpinner ? { min: 0, max: 100, now: normalizedPercent } : undefined}
      style={{
        borderRadius: tokens.radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: tokens.colors.surface,
        paddingHorizontal: tokens.spacing.sm,
        paddingVertical: tokens.spacing.sm,
        gap: tokens.spacing.xs,
        shadowColor: tokens.colors.shadow,
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: tokens.spacing.xs }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.progressTrack,
          }}
        >
          {showSpinner ? (
            <ActivityIndicator size="small" color={colors.progress} />
          ) : (
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                backgroundColor: colors.progress,
              }}
            />
          )}
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text
            numberOfLines={2}
            style={{
              color: colors.title,
              fontSize: tokens.typography.caption,
              fontWeight: tokens.fontWeight.extrabold,
            }}
          >
            {title}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: tokens.spacing.sm,
            }}
          >
            <Text
              numberOfLines={2}
              style={{
                flex: 1,
                color: colors.stage,
                fontSize: tokens.typography.tiny,
                fontWeight: tokens.fontWeight.bold,
              }}
            >
              {stage}
            </Text>
            <Text
              style={{
                color: tokens.colors.muted,
                fontSize: tokens.typography.micro,
                fontWeight: tokens.fontWeight.bold,
              }}
            >
              %{normalizedPercent}
            </Text>
          </View>
        </View>

        <OverflowActionMenu actions={actions} buttonSize={28} title={title} />
      </View>

      <View
        style={{
          height: 7,
          borderRadius: 999,
          backgroundColor: colors.progressTrack,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${normalizedPercent}%`,
            minWidth: normalizedPercent > 0 ? 12 : 0,
            height: "100%",
            borderRadius: 999,
            backgroundColor: colors.progress,
          }}
        />
      </View>

      {hint ? (
        <Text
          style={{
            color: tokens.colors.muted,
            fontSize: tokens.typography.micro,
            lineHeight: 15,
          }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
