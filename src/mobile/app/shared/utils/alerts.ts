import { Alert } from "react-native";

interface ConfirmAlertOptions {
  cancelLabel?: string;
  confirmLabel: string;
  destructive?: boolean;
  message: string;
  onConfirm: () => void;
  title: string;
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
  Alert.alert(title, message, [
    { text: cancelLabel, style: "cancel" },
    {
      text: confirmLabel,
      style: destructive ? "destructive" : "default",
      onPress: onConfirm,
    },
  ]);
}
