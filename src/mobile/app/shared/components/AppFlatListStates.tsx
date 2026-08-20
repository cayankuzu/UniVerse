import type { ReactElement } from "react";
import { StyleSheet, View } from "react-native";
import { t } from "../i18n";
import { tokens } from "../theme";
import { AppText as Text } from "./AppText";
import { AsyncState } from "./AsyncState";
import { AppListSkeleton } from "./AppListSkeleton";
import { EmptyState } from "./EmptyState";
import { LoadingSpinner } from "./LoadingSpinner";

export function buildDefaultListEmptyState(params: {
  emptySubtitle?: string;
  emptyText?: string;
  emptyTitle?: string;
  error?: string | null;
  estimatedItemSize: number;
  loading?: boolean;
  loadingComponent?: ReactElement | null;
  numColumns: number;
  onRetry?: () => void;
}) {
  if (params.loading) {
    if (params.loadingComponent) return params.loadingComponent;

    return (
      <AppListSkeleton
        columns={params.numColumns}
        count={
          params.numColumns > 1 ? params.numColumns * 3 : params.estimatedItemSize > 220 ? 3 : 6
        }
        itemHeight={
          params.numColumns > 1
            ? Math.max(128, params.estimatedItemSize - 40)
            : Math.max(72, params.estimatedItemSize - 24)
        }
        variant={params.numColumns > 1 ? "grid" : "list"}
      />
    );
  }

  if (params.error) {
    return (
      <AsyncState error={params.error} loading={false} onRetry={params.onRetry}>
        <View />
      </AsyncState>
    );
  }

  if (!params.emptyText && !params.emptyTitle && !params.emptySubtitle) return null;

  const title = params.emptyTitle ?? params.emptyText ?? t("common.empty.title");
  const subtitle = params.emptyTitle
    ? params.emptySubtitle
    : (params.emptySubtitle ?? (params.emptyText ? undefined : t("common.empty.subtitle")));

  return <EmptyState title={title} subtitle={subtitle} />;
}

export function buildDefaultListFooter(params: {
  dataLength: number;
  endReachedText?: string;
  hasMore?: boolean;
  loadingMore?: boolean;
}) {
  if (params.dataLength === 0) return null;

  if (params.loadingMore) {
    return (
      <View style={styles.footer}>
        <LoadingSpinner size="small" />
        <Text style={styles.footerText}>{t("common.loading")}</Text>
      </View>
    );
  }

  if (params.hasMore === false) {
    return (
      <View style={styles.footer}>
        <Text style={styles.footerText}>{params.endReachedText || t("common.list.end")}</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  footer: {
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
  },
  footerText: {
    color: tokens.colors.muted,
    fontSize: tokens.typography.caption,
    textAlign: "center",
  },
});
