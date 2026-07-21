import { formatTurkishDisplayText } from "./turkishDisplay";

describe("formatTurkishDisplayText", () => {
  it("corrects legacy catalog labels without changing their stored value", () => {
    const storedValue = "Yapay Zeka";

    expect(formatTurkishDisplayText(storedValue)).toBe("Yapay Zekâ");
    expect(storedValue).toBe("Yapay Zeka");
  });

  it("repairs known legacy replacement-character labels", () => {
    expect(formatTurkishDisplayText("Makine ??renmesi")).toBe("Makine Öğrenmesi");
    expect(formatTurkishDisplayText("?leti?im")).toBe("İletişim");
  });
});
