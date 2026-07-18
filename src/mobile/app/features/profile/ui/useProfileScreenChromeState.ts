import { useCallback, useEffect, useRef, useState } from "react";
import { useProfileViewerChromeState } from "./useProfileViewerChromeState";

export function useProfileScreenChromeState() {
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const reportDismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewerChrome = useProfileViewerChromeState();

  const clearReportDismissTimeout = useCallback(() => {
    if (!reportDismissTimeoutRef.current) return;
    clearTimeout(reportDismissTimeoutRef.current);
    reportDismissTimeoutRef.current = null;
  }, []);

  useEffect(
    () => () => {
      clearReportDismissTimeout();
    },
    [clearReportDismissTimeout],
  );

  const closeMenu = useCallback(() => {
    setShowMenu(false);
  }, []);

  const openMenu = useCallback(() => {
    setShowMenu(true);
  }, []);
  const openReportModal = useCallback(() => {
    clearReportDismissTimeout();
    setShowReportModal(true);
    setReportSubmitted(false);
  }, [clearReportDismissTimeout]);

  const closeReportModal = useCallback(() => {
    clearReportDismissTimeout();
    setShowReportModal(false);
    setReportSubmitted(false);
  }, [clearReportDismissTimeout]);

  const completeReport = useCallback(() => {
    setReportSubmitted(true);
    clearReportDismissTimeout();
    reportDismissTimeoutRef.current = setTimeout(() => {
      setShowReportModal(false);
      setReportSubmitted(false);
      reportDismissTimeoutRef.current = null;
    }, 1500);
  }, [clearReportDismissTimeout]);

  const failReport = useCallback(() => {
    clearReportDismissTimeout();
    setShowReportModal(false);
    setReportSubmitted(false);
  }, [clearReportDismissTimeout]);

  return {
    closeMenu,
    closeReportModal,
    completeReport,
    failReport,
    openMenu,
    openReportModal,
    reportSubmitted,
    showMenu,
    showReportModal,
    ...viewerChrome,
  };
}
