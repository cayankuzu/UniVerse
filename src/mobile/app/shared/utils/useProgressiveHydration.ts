import { useEffect, useState } from "react";
import { scheduleAfterInteractions } from "./scheduleAfterInteractions";

export function useProgressiveHydration(resetKey: string, delayMs = 72) {
  const [showSecondaryContent, setShowSecondaryContent] = useState(false);

  useEffect(() => {
    setShowSecondaryContent(false);
    const task = scheduleAfterInteractions(() => {
      setShowSecondaryContent(true);
    }, delayMs);
    return () => task.cancel();
  }, [delayMs, resetKey]);

  return showSecondaryContent;
}
