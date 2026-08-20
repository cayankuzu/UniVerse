import { useCallback, useEffect, useSyncExternalStore, useState } from "react";
import { DangerConfirmSheet } from "../components/DangerConfirmSheet";
import {
  dismissConfirmAlert,
  getActiveConfirmAlert,
  showErrorAlert,
  subscribeConfirmAlerts,
} from "../utils/alerts";

export function AppConfirmationHost() {
  const request = useSyncExternalStore(
    subscribeConfirmAlerts,
    getActiveConfirmAlert,
    getActiveConfirmAlert,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBusy(false);
  }, [request?.id]);

  const close = useCallback(() => {
    if (!request || busy) return;
    dismissConfirmAlert(request.id);
  }, [busy, request]);

  const confirm = useCallback(async () => {
    if (!request || busy) return;
    setBusy(true);
    try {
      await request.onConfirm();
      dismissConfirmAlert(request.id);
    } catch {
      setBusy(false);
      showErrorAlert("İşlem tamamlanamadı. Lütfen tekrar deneyin.");
    }
  }, [busy, request]);

  if (!request) return null;

  return (
    <DangerConfirmSheet
      busy={busy}
      cancelLabel={request.cancelLabel}
      confirmLabel={request.confirmLabel}
      description={request.message}
      destructive={request.destructive}
      onClose={close}
      onConfirm={() => void confirm()}
      title={request.title}
      visible
    />
  );
}
