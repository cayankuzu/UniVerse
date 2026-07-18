import React from "react";
import { View } from "react-native";
import { AlertCircle, Inbox } from "lucide-react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { tokens } from "../../shared/theme";
import { t } from "../../shared/i18n";
import { EmptyState } from "./EmptyState";

interface AsyncStateProps {
  loading: boolean;
  error?: string | null;
  empty?: boolean;
  emptyText?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
  loadingFallback?: React.ReactNode;
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
  children,
}: AsyncStateProps) {
  if (loading) {
    if (loadingFallback) {
      return <>{loadingFallback}</>;
    }
    return (
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="progressbar"
        accessible
        style={{ paddingVertical: 28, alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        <ActivityIndicator color={tokens.colors.primary} size="small" />
        <Text style={{ color: tokens.colors.iconMuted, fontSize: 13, fontWeight: "500" }}>
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
        style={{ paddingVertical: 28, alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        <AlertCircle size={18} color={tokens.colors.danger} />
        <Text
          style={{
            color: tokens.colors.danger,
            fontSize: 13,
            fontWeight: "500",
            textAlign: "center",
          }}
        >
          {error}
        </Text>
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
