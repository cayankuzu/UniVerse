import { Alert } from "react-native";

import {
  dismissConfirmAlert,
  getActiveConfirmAlert,
  showConfirmAlert,
  showErrorAlert,
  showInfoAlert,
  subscribeConfirmAlerts,
} from "./alerts";

describe("alerts", () => {
  beforeEach(() => {
    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });

  afterEach(() => {
    while (getActiveConfirmAlert()) {
      dismissConfirmAlert(getActiveConfirmAlert()!.id);
    }
    jest.restoreAllMocks();
  });

  it("shows info and error alerts", () => {
    showInfoAlert("Bilgi", "Hazır");
    showErrorAlert("Bir hata oluştu");

    expect(Alert.alert).toHaveBeenNthCalledWith(1, "Bilgi", "Hazır");
    expect(Alert.alert).toHaveBeenNthCalledWith(2, "Hata", "Bir hata oluştu");
  });

  it("shows a default confirm alert and invokes the confirm handler", () => {
    const onConfirm = jest.fn();

    showConfirmAlert({
      confirmLabel: "Devam et",
      message: "Emin misin?",
      onConfirm,
      title: "Onay",
    });

    expect(Alert.alert).toHaveBeenCalledWith("Onay", "Emin misin?", [
      { text: expect.any(String), style: "cancel" },
      {
        text: "Devam et",
        style: "default",
        onPress: onConfirm,
      },
    ]);

    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    buttons[1].onPress();

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("shows a destructive confirm alert with a custom cancel label", () => {
    const onConfirm = jest.fn();

    showConfirmAlert({
      cancelLabel: "İptal",
      confirmLabel: "Sil",
      destructive: true,
      message: "Bu işlem geri alınamaz.",
      onConfirm,
      title: "Sil",
    });

    expect(Alert.alert).toHaveBeenCalledWith("Sil", "Bu işlem geri alınamaz.", [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: onConfirm,
      },
    ]);
  });

  it("routes and queues confirmations through the in-app host when mounted", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeConfirmAlerts(listener);

    const firstId = showConfirmAlert({
      confirmLabel: "Devam et",
      message: "İlk işlem",
      onConfirm: jest.fn(),
      title: "Onay",
    });
    const secondId = showConfirmAlert({
      confirmLabel: "Sil",
      destructive: true,
      message: "İkinci işlem",
      onConfirm: jest.fn(),
      title: "Sil",
    });

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(getActiveConfirmAlert()?.id).toBe(firstId);

    dismissConfirmAlert(firstId!);
    expect(getActiveConfirmAlert()?.id).toBe(secondId);

    dismissConfirmAlert(secondId!);
    expect(getActiveConfirmAlert()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
  });
});
