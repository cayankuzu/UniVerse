import React from "react";
import { useWindowDimensions, View, type DimensionValue } from "react-native";
import { tokens } from "../../shared/theme";

export type AppListSkeletonVariant = "grid" | "list";

interface AppListSkeletonProps {
  columns?: number;
  count?: number;
  gap?: number;
  horizontalPadding?: number;
  itemHeight?: number;
  itemWidth?: number;
  paddingBottom?: number;
  paddingTop?: number;
  variant?: AppListSkeletonVariant;
}

function SkeletonBlock({
  height,
  radius,
  width,
}: {
  height: number;
  radius?: number;
  width: DimensionValue;
}) {
  return (
    <View
      style={{
        width,
        height,
        borderRadius: radius ?? 10,
        backgroundColor: tokens.colors.surfaceVariant,
      }}
    />
  );
}

function buildIndexes(count: number) {
  return Array.from({ length: count }, (_item, index) => index);
}

export function AppListSkeleton({
  columns = 2,
  count = 6,
  gap = tokens.spacing.sm,
  horizontalPadding = tokens.spacing.md,
  itemHeight,
  itemWidth,
  paddingBottom = tokens.spacing.lg,
  paddingTop = tokens.spacing.sm,
  variant = "list",
}: AppListSkeletonProps) {
  const { width } = useWindowDimensions();
  const safeCount = Math.max(1, count);
  const safeColumns = Math.max(1, columns);
  const resolvedGridWidth =
    itemWidth ??
    Math.floor((width - horizontalPadding * 2 - gap * (safeColumns - 1)) / safeColumns);
  const resolvedGridHeight = itemHeight ?? 188;
  const resolvedListHeight = itemHeight ?? 86;
  const usesCardListLayout = resolvedListHeight > 140;

  if (variant === "grid") {
    return (
      <View
        style={{
          paddingTop,
          paddingBottom,
          paddingHorizontal: horizontalPadding,
          flexDirection: "row",
          flexWrap: "wrap",
          rowGap: gap,
          columnGap: gap,
        }}
      >
        {buildIndexes(safeCount).map((index) => (
          <View
            key={`grid-skeleton-${index}`}
            style={{
              width: resolvedGridWidth,
              borderRadius: tokens.radius.lg,
              borderWidth: 1,
              borderColor: tokens.colors.border,
              backgroundColor: tokens.colors.surface,
              overflow: "hidden",
              paddingBottom: tokens.spacing.sm,
            }}
          >
            <SkeletonBlock height={Math.max(92, resolvedGridHeight - 72)} width="100%" radius={0} />
            <View
              style={{
                gap: tokens.spacing.xs,
                paddingHorizontal: tokens.spacing.sm,
                paddingTop: tokens.spacing.sm,
              }}
            >
              <SkeletonBlock height={12} width="78%" />
              <SkeletonBlock height={10} width="54%" />
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={{ gap, paddingTop, paddingBottom, paddingHorizontal: horizontalPadding }}>
      {buildIndexes(safeCount).map((index) => (
        <View
          key={`list-skeleton-${index}`}
          style={{
            minHeight: resolvedListHeight,
            borderRadius: tokens.radius.lg,
            borderWidth: 1,
            borderColor: tokens.colors.border,
            backgroundColor: tokens.colors.surface,
            paddingHorizontal: tokens.spacing.md,
            paddingVertical: tokens.spacing.sm,
            flexDirection: "row",
            alignItems: "center",
            gap,
          }}
        >
          {usesCardListLayout ? (
            <View style={{ width: "100%", gap: tokens.spacing.sm }}>
              <SkeletonBlock height={Math.max(112, resolvedListHeight - 74)} width="100%" />
              <SkeletonBlock height={14} width="64%" />
              <SkeletonBlock height={10} width="38%" />
            </View>
          ) : (
            <>
              <SkeletonBlock height={44} width={44} radius={22} />
              <View style={{ flex: 1, gap: tokens.spacing.xs }}>
                <SkeletonBlock height={12} width="62%" />
                <SkeletonBlock height={10} width="38%" />
              </View>
            </>
          )}
        </View>
      ))}
    </View>
  );
}
