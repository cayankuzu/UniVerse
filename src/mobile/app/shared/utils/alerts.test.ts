import { Alert } from "react-native";

import { showConfirmAlert, showErrorAlert, showInfoAlert } from "./alerts";

describe("alerts", () => {
  beforeEach(() => {
    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });

  afterEach(() => {
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
});
