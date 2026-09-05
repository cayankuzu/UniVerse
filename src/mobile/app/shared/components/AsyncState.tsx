import React from "react";
import { View } from "react-native";
import { AlertCircle, Inbox } from "lucide-react-native";
import { ActivityIndicator } from "react-native-paper";
import { AppText as Text } from "./AppText";
import { tokens } from "../../shared/theme";
import { t } from "../../shared/i18n";
import { AppButton } from "./AppButton";
import { EmptyState } from "./EmptyState";
import { useLiveRegionAnnouncement } from "../hooks/useLiveRegionAnnouncement";

interface AsyncStateProps {
  loading: boolean;
  error?: string | null;
  empty?: boolean;
  emptyText?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
  loadingFallback?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  children?: React.ReactNode;
}

export function AsyncState({
  loading,
  error,
  empty,
  emptyText,
  emptyTitle,
  emptySubtitle,
  loadingFallback,
  onRetry,
  retryLabel = "Tekrar dene",
  children,
}: AsyncStateProps) {
  // Mirrors the accessibilityLiveRegion props below onto VoiceOver, which
  // ignores them.
  useLiveRegionAnnouncement(error || (loading ? t("common.loading") : null));

  if (loading) {
    if (loadingFallback) {
      return <>{loadingFallback}</>;
    }
    return (
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="progressbar"
        accessible
        style={{
          paddingVertical: tokens.spacing.twoXl,
          alignItems: "center",
          justifyContent: "center",
          gap: tokens.spacing.xs,
        }}
      >
        <ActivityIndicator color={tokens.colors.primary} size="small" />
        <Text
          style={{
            color: tokens.colors.iconMuted,
            fontSize: tokens.typography.label,
            fontWeight: tokens.fontWeight.medium,
            lineHeight: tokens.lineHeight.label,
          }}
        >
          {t("common.loading")}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View
        accessibilityLiveRegion="assertive"
        accessibilityRole="alert"
        accessible
        style={{
          paddingVertical: tokens.spacing.twoXl,
          alignItems: "center",
          justifyContent: "center",
          gap: tokens.spacing.xs,
        }}
      >
        <AlertCircle size={18} color={tokens.colors.danger} />
        <Text
          style={{
            color: tokens.colors.danger,
            fontSize: tokens.typography.label,
            fontWeight: tokens.fontWeight.medium,
            lineHeight: tokens.lineHeight.label,
            textAlign: "center",
          }}
        >
          {error}
        </Text>
        {onRetry ? (
          <AppButton fullWidth={false} label={retryLabel} mode="text" onPress={onRetry} size="sm" />
        ) : null}
      </View>
    );
  }

  if (empty) {
    const resolvedTitle = emptyTitle ?? emptyText ?? t("common.empty.title");
    const resolvedSubtitle = emptyTitle
      ? emptySubtitle
      : (emptySubtitle ?? (emptyText ? undefined : t("common.empty.subtitle")));

    return (
      <EmptyState
        icon={<Inbox size={20} color={tokens.colors.iconMuted} />}
        title={resolvedTitle}
        subtitle={resolvedSubtitle}
      />
    );
  }

  return <>{children}</>;
}
