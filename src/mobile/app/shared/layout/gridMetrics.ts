export interface ThreeColumnGridMetrics {
  cardWidth: number;
  cardHeight: number;
  mediaHeight: number;
  rowGap: number;
  horizontalPadding: number;
}

interface ThreeColumnGridOptions {
  screenWidth: number;
  screenHeight: number;
  topReserved?: number;
  bottomReserved?: number;
  columns?: number;
  rowsVisible?: number;
  rowGap?: number;
  horizontalPadding?: number;
  minCardHeight?: number;
  maxCardHeight?: number;
}

export function getThreeColumnGridMetrics({
  screenWidth,
  screenHeight,
  topReserved = 176,
  bottomReserved = 96,
  columns = 3,
  rowsVisible = 4,
  rowGap = 8,
  horizontalPadding = 10,
  minCardHeight = 142,
  maxCardHeight = 236,
}: ThreeColumnGridOptions): ThreeColumnGridMetrics {
  const safeWidth = Math.max(screenWidth, 1);
  const safeHeight = Math.max(screenHeight, 640);
  const safeColumns = Math.max(1, Math.floor(columns));
  const cardWidth = Math.floor(
    (safeWidth - horizontalPadding * 2 - rowGap * (safeColumns - 1)) / safeColumns,
  );
  const availableHeight = Math.max(
    safeHeight - topReserved - bottomReserved,
    minCardHeight * rowsVisible + rowGap * (rowsVisible - 1),
  );
  const rawCardHeight = Math.floor((availableHeight - rowGap * (rowsVisible - 1)) / rowsVisible);
  const cardHeight = Math.max(minCardHeight, Math.min(maxCardHeight, rawCardHeight));
  const mediaHeight = Math.max(82, Math.floor(cardHeight * 0.67));

  return {
    cardWidth,
    cardHeight,
    mediaHeight,
    rowGap,
    horizontalPadding,
  };
}
