import { useCallback, useEffect, useRef, useState } from "react";

type Notice = { kind: "error" | "info"; text: string } | null;

export function useNotificationNotice() {
  const [notice, setNotice] = useState<Notice>(null);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushNotice = useCallback((text: string, kind: "error" | "info" = "info") => {
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    setNotice({ kind, text });
    noticeTimeoutRef.current = setTimeout(() => {
      setNotice(null);
      noticeTimeoutRef.current = null;
    }, 2400);
  }, []);

  useEffect(
    () => () => {
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    },
    [],
  );

  return {
    notice,
    pushNotice,
  };
}
