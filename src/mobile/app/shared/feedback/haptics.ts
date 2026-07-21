import * as Haptics from "expo-haptics";

export type AppHapticFeedback = "light" | "selection" | "success";

export function triggerHapticFeedback(feedback: AppHapticFeedback) {
  const request =
    feedback === "selection"
      ? Haptics.selectionAsync()
      : feedback === "success"
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  void request.catch(() => undefined);
}
