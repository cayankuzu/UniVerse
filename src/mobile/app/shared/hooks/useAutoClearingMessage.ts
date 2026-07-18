import { useEffect, useState } from "react";

export function useAutoClearingMessage(timeoutMs = 3000) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), timeoutMs);
    return () => clearTimeout(timer);
  }, [message, timeoutMs]);

  return {
    message,
    setMessage,
  };
}
