export type DeviceClass = "phoneCompact" | "phoneLarge" | "tabletPortrait";
export type WindowWidthClass = "compactNarrow" | "compact" | "medium" | "expanded";
export type WindowHeightClass = "short" | "regular" | "tall";
export type WindowOrientation = "landscape" | "portrait";

export interface LayoutInsets {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export interface ResponsiveLayoutOptions {
  fontScale?: number;
  insets?: Partial<LayoutInsets>;
  keyboardHeight?: number;
  keyboardVisible?: boolean;
  reduceMotion?: boolean;
}

export interface ResponsiveSpacingTokens {
  contentMaxWidth: number;
  edgeInset: number;
  listGap: number;
  modalPadding: number;
  rowGap: number;
}

export interface ResponsiveMediaTokens {
  imageViewerHeight: number;
  modalMaxWidth: number;
}

export interface ResponsiveLayoutTokens {
  deviceClass: DeviceClass;
  fontScale: number;
  heightClass: WindowHeightClass;
  insets: LayoutInsets;
  keyboardHeight: number;
  keyboardVisible: boolean;
  media: ResponsiveMediaTokens;
  orientation: WindowOrientation;
  reduceMotion: boolean;
  spacing: ResponsiveSpacingTokens;
  widthClass: WindowWidthClass;
}

export function resolveDeviceClass(width: number): DeviceClass {
  if (width >= 820) return "tabletPortrait";
  if (width >= 390) return "phoneLarge";
  return "phoneCompact";
}

export function resolveWindowWidthClass(width: number): WindowWidthClass {
  if (width >= 840) return "expanded";
  if (width >= 600) return "medium";
  if (width >= 360) return "compact";
  return "compactNarrow";
}

export function resolveWindowHeightClass(height: number): WindowHeightClass {
  if (height < 640) return "short";
  if (height >= 820) return "tall";
  return "regular";
}

export function getResponsiveLayoutTokens(
  width: number,
  height: number,
  options: ResponsiveLayoutOptions = {},
): ResponsiveLayoutTokens {
  const deviceClass = resolveDeviceClass(width);
  const widthClass = resolveWindowWidthClass(width);
  const heightClass = resolveWindowHeightClass(height);
  const insets = {
    bottom: options.insets?.bottom ?? 0,
    left: options.insets?.left ?? 0,
    right: options.insets?.right ?? 0,
    top: options.insets?.top ?? 0,
  };
  const baseGutter = widthClass === "compactNarrow" ? 12 : widthClass === "compact" ? 16 : 24;
  const edgeInset = Math.max(baseGutter, insets.left + baseGutter, insets.right + baseGutter);
  const rowGap = deviceClass === "tabletPortrait" ? 10 : 8;
  const listGap = deviceClass === "tabletPortrait" ? 10 : 8;
  const modalPadding = deviceClass === "tabletPortrait" ? 28 : baseGutter;
  const contentMaxWidth = widthClass === "expanded" ? 960 : widthClass === "medium" ? 720 : width;
  const modalMaxWidth =
    deviceClass === "tabletPortrait" ? 720 : Math.max(280, width - modalPadding * 2);
  const imageViewerHeight =
    deviceClass === "tabletPortrait"
      ? Math.max(360, Math.min(Math.floor(height * 0.72), 620))
      : Math.max(280, Math.min(Math.floor(height * 0.62), 420));

  return {
    deviceClass,
    fontScale: options.fontScale ?? 1,
    heightClass,
    insets,
    keyboardHeight: options.keyboardHeight ?? 0,
    keyboardVisible: Boolean(options.keyboardVisible),
    media: {
      imageViewerHeight,
      modalMaxWidth,
    },
    orientation: width > height ? "landscape" : "portrait",
    reduceMotion: Boolean(options.reduceMotion),
    spacing: {
      contentMaxWidth,
      edgeInset,
      listGap,
      modalPadding,
      rowGap,
    },
    widthClass,
  };
}

export function getResponsiveGridColumns(
  width: number,
  options: {
    minItemWidth?: number;
    phoneCompact?: number;
    phoneLarge?: number;
    tabletPortrait?: number;
  } = {},
) {
  const deviceClass = resolveDeviceClass(width);
  const preferred =
    deviceClass === "tabletPortrait"
      ? (options.tabletPortrait ?? 3)
      : deviceClass === "phoneLarge"
        ? (options.phoneLarge ?? 2)
        : (options.phoneCompact ?? 2);
  const minItemWidth = options.minItemWidth ?? 148;
  const maxColumnsByWidth = Math.max(1, Math.floor(Math.max(width, minItemWidth) / minItemWidth));
  return Math.max(1, Math.min(preferred, maxColumnsByWidth));
}
