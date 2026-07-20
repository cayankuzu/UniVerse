import type { ProfileTileItem } from "../application/profileUiModels";
import type { ProfileTab } from "../domain/profileConstants";

type EstimateProfilePagerHeightsParams = {
  cardHeight: number;
  hasMore?: boolean;
  numColumns: number;
  rowGap: number;
  tabs: Record<ProfileTab, ProfileTileItem[]>;
};

const EMPTY_STATE_HEIGHT = 280;
const FOOTER_HEIGHT = 58;
const GRID_BOTTOM_PADDING = 20;
const PAGE_SAFETY_PADDING = 16;

function estimateGridHeight(
  items: ProfileTileItem[],
  cardHeight: number,
  columns: number,
  gap: number,
) {
  if (items.length === 0) return EMPTY_STATE_HEIGHT;
  const rows = Math.ceil(items.length / Math.max(1, columns));
  return rows * cardHeight + Math.max(0, rows - 1) * gap + GRID_BOTTOM_PADDING;
}

export function estimateProfilePagerHeights({
  cardHeight,
  hasMore,
  numColumns,
  rowGap,
  tabs,
}: EstimateProfilePagerHeightsParams) {
  const footerHeight = hasMore ? FOOTER_HEIGHT : 0;

  return {
    album:
      estimateGridHeight(tabs.album, cardHeight, numColumns, rowGap) +
      footerHeight +
      PAGE_SAFETY_PADDING,
    events:
      estimateGridHeight(tabs.events, cardHeight, numColumns, rowGap) +
      footerHeight +
      PAGE_SAFETY_PADDING,
  } satisfies Record<ProfileTab, number>;
}
