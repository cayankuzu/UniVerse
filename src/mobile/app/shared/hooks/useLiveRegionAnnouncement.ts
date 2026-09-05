import { useEffect, useRef } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/**
 * `accessibilityLiveRegion` is an Android-only prop: TalkBack reads a region
 * whose text changed, VoiceOver never hears about it. Screens pair that prop
 * with this hook so an error, a retry or a busy message reaches both platforms.
 *
 * The announcement fires only when the text actually changes, so a re-render
 * with the same message stays silent instead of talking over the user.
 */
export function useLiveRegionAnnouncement(message: string | null | undefined) {
  const lastAnnouncedRef = useRef<string | null>(null);

  useEffect(() => {
    const next = String(message || "").trim();
    if (!next) {
      lastAnnouncedRef.current = null;
      return;
    }
    if (lastAnnouncedRef.current === next) return;
    lastAnnouncedRef.current = next;
    // Android already announces through accessibilityLiveRegion; announcing
    // again here would read the same message twice.
    if (Platform.OS === "android") return;
    AccessibilityInfo.announceForAccessibility(next);
  }, [message]);
}
