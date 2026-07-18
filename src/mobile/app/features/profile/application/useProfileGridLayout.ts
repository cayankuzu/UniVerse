import { useMemo } from "react";
import { getThreeColumnGridMetrics } from "../../../shared/layout/gridMetrics";
import {
  getResponsiveGridColumns,
  getResponsiveLayoutTokens,
} from "../../../shared/layout/responsive";

export function useProfileGridLayout(params: {
  height: number;
  insetBottom: number;
  width: number;
}) {
  const { height, insetBottom, width } = params;
  const responsiveTokens = useMemo(() => getResponsiveLayoutTokens(width, height), [height, width]);
  const numColumns = getResponsiveGridColumns(width, { tabletPortrait: 3 });
  const grid = useMemo(
    () =>
      getThreeColumnGridMetrics({
        screenWidth: width,
        screenHeight: height,
        columns: numColumns,
        rowsVisible: responsiveTokens.deviceClass === "tabletPortrait" ? 3.4 : 3,
        topReserved: responsiveTokens.deviceClass === "tabletPortrait" ? 190 : 176,
        bottomReserved: Math.max(insetBottom + 78, 86),
        minCardHeight: responsiveTokens.deviceClass === "tabletPortrait" ? 220 : 196,
        horizontalPadding: 0,
      }),
    [height, insetBottom, numColumns, responsiveTokens.deviceClass, width],
  );

  return {
    grid,
    numColumns,
  };
}
