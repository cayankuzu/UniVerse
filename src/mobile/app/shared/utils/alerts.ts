import { Alert } from "react-native";

export interface ConfirmAlertOptions {
  cancelLabel?: string;
  confirmLabel: string;
  destructive?: boolean;
  message: string;
  onConfirm: () => Promise<void> | void;
  title: string;
}

export type ConfirmAlertRequest = ConfirmAlertOptions & { id: string };

type ConfirmAlertListener = () => void;

const confirmAlertListeners = new Set<ConfirmAlertListener>();
const confirmAlertQueue: ConfirmAlertRequest[] = [];
let activeConfirmAlert: ConfirmAlertRequest | null = null;

function emitConfirmAlertChange() {
  confirmAlertListeners.forEach((listener) => listener());
}

function showNextConfirmAlert() {
  activeConfirmAlert = confirmAlertQueue.shift() || null;
  emitConfirmAlertChange();
}

export function subscribeConfirmAlerts(listener: ConfirmAlertListener) {
  confirmAlertListeners.add(listener);
  return () => confirmAlertListeners.delete(listener);
}

export function getActiveConfirmAlert() {
  return activeConfirmAlert;
}

export function dismissConfirmAlert(id: string) {
  if (activeConfirmAlert?.id !== id) return;
  showNextConfirmAlert();
}

export function showInfoAlert(title: string, message: string) {
  Alert.alert(title, message);
}

export function showErrorAlert(message: string, title = "Hata") {
  Alert.alert(title, message);
}

export function showConfirmAlert({
  cancelLabel = "Vazgeç",
  confirmLabel,
  destructive = false,
  message,
  onConfirm,
  title,
}: ConfirmAlertOptions) {
  if (confirmAlertListeners.size > 0) {
    const request = {
      cancelLabel,
      confirmLabel,
      destructive,
      id: `confirm:${Date.now()}:${Math.random().toString(16).slice(2)}`,
      message,
      onConfirm,
      title,
    } satisfies ConfirmAlertRequest;
    if (activeConfirmAlert) {
      confirmAlertQueue.push(request);
    } else {
      activeConfirmAlert = request;
      emitConfirmAlertChange();
    }
    return request.id;
  }

  Alert.alert(title, message, [
    { text: cancelLabel, style: "cancel" },
    {
      text: confirmLabel,
      style: destructive ? "destructive" : "default",
      onPress: onConfirm,
    },
  ]);
  return null;
}
