import {
  canContinueCreateEventStep,
  formatCreateEventValidationSummary,
  getCreateEventValidationErrors,
  resolveCreateEventStepError,
} from "./createEventScreen.helpers";

describe("createEventScreen.helpers", () => {
  it("returns the first relevant error for the current step", () => {
    expect(
      resolveCreateEventStepError(2, {
        capacity: "Kontenjan gerekli.",
        feeAmount: "Ücret gerekli.",
      }),
    ).toBe("Kontenjan gerekli.");
  });

  it("requires title and description on step one, then date and location on step two", () => {
    expect(
      canContinueCreateEventStep(1, {
        access: "",
        address: "",
        capacity: "",
        description: "",
        endDate: "",
        endTime: "",
        fee: "",
        feeAmount: "",
        level: "",
        location: "",
        materials: "",
        startDate: "",
        startTime: "",
        targetAudience: "",
        title: "Baslik",
        type: "",
      }),
    ).toBe(false);

    expect(
      canContinueCreateEventStep(2, {
        access: "",
        address: "",
        capacity: "",
        description: "",
        endDate: "",
        endTime: "",
        fee: "",
        feeAmount: "",
        level: "",
        location: "Kampus",
        materials: "",
        startDate: "2026-05-01",
        startTime: "",
        targetAudience: "",
        title: "",
        type: "",
      }),
    ).toBe(true);
  });

  it("formats a detailed validation summary for invalid fields", () => {
    const errors = getCreateEventValidationErrors({
      access: "",
      address: "",
      capacity: "0",
      description: "kisa",
      endDate: "",
      endTime: "",
      fee: "Ucretli",
      feeAmount: "0",
      level: "",
      location: "",
      materials: "",
      startDate: "",
      startTime: "",
      targetAudience: "",
      title: "ab",
      type: "",
    });

    const summary = formatCreateEventValidationSummary({ errors, step: 2 });
    expect(summary).toContain("Baslangic tarihi");
    expect(summary).toContain("Kontenjan");
  });
});
