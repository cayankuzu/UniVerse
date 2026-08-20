import { BackHandler } from "react-native";
import { useCallback, useRef } from "react";
import { useAutoClearingMessage } from "../../shared/hooks/useAutoClearingMessage";

export const EXIT_INTENT_WINDOW_MS = 2000;
export const EXIT_INTENT_MESSAGE = "Uygulamadan çıkmak için tekrar geri tuşuna basın.";

export function useExitIntentGuard(timeoutMs = EXIT_INTENT_WINDOW_MS) {
  const { message, setMessage } = useAutoClearingMessage(timeoutMs);
  const lastExitIntentAtRef = useRef(0);

  const resetExitIntent = useCallback(() => {
    lastExitIntentAtRef.current = 0;
    setMessage(null);
  }, [setMessage]);

  const confirmExit = useCallback(() => {
    const now = Date.now();
    if (lastExitIntentAtRef.current > 0 && now - lastExitIntentAtRef.current <= timeoutMs) {
      lastExitIntentAtRef.current = 0;
      setMessage(null);
      BackHandler.exitApp();
      return true;
    }

    lastExitIntentAtRef.current = now;
    setMessage(EXIT_INTENT_MESSAGE);
    return true;
  }, [setMessage, timeoutMs]);

  return {
    confirmExit,
    exitMessage: message,
    resetExitIntent,
  };
}
