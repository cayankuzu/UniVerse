import type { PropsWithChildren } from "react";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { Inter_800ExtraBold } from "@expo-google-fonts/inter/800ExtraBold";
import { useFonts } from "expo-font";

const APP_FONTS = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} as const;

export function AppFontGate({ children }: PropsWithChildren) {
  // Font loading must never become an application-start gate. React Native
  // renders with the platform fallback for the first frame and replaces it as
  // soon as Inter is ready, avoiding a blank screen on slow storage devices.
  useFonts(APP_FONTS);
  return children;
}
