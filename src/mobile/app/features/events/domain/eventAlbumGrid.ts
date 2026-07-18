import {
  getThreeColumnGridMetrics,
  type ThreeColumnGridMetrics,
} from "../../../shared/layout/gridMetrics";

export function getEventAlbumGridMetrics(
  screenWidth: number,
  screenHeight: number,
): ThreeColumnGridMetrics {
  return getThreeColumnGridMetrics({
    screenWidth,
    screenHeight,
    columns: 2,
    rowsVisible: 3,
    rowGap: 10,
    horizontalPadding: 12,
    topReserved: 196,
    bottomReserved: 110,
    minCardHeight: 232,
    maxCardHeight: 300,
  });
}
