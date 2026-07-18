import {
  buildClubRegistrationPayloads,
  buildStudentRegistrationPayloads,
} from "./registrationPayloads";

describe("registrationPayloads", () => {
  it("builds student registration payloads from feature-local values", () => {
    const result = buildStudentRegistrationPayloads({
      normalizedEmail: "student@example.com",
      normalizedUsername: "studentuser",
      selectedCategories: ["Teknoloji", "Yazilim"],
      values: {
        bio: "  Merhaba dunya  ",
        department: "  Bilgisayar Muhendisligi ",
        gradeYear: " 3 ",
        name: "  Ali Veli ",
        password: "Secret123",
        university: "  UniVerse ",
      },
    });

    expect(result.registerPayload).toEqual(
      expect.objectContaining({
        accountType: "student",
        bio: "Merhaba dunya",
        department: "Bilgisayar Muhendisligi",
        email: "student@example.com",
        gradeYear: "3",
        name: "Ali Veli",
        password: "Secret123",
        university: "UniVerse",
        username: "studentuser",
      }),
    );
    expect(result.updatePayload).toEqual(
      expect.objectContaining({
        accountType: "student",
        categories: ["Teknoloji", "Yazilim"],
        userId: "",
      }),
    );
  });

  it("builds club registration payloads from feature-local values", () => {
    const result = buildClubRegistrationPayloads({
      normalizedEmail: "club@example.com",
      normalizedUsername: "clubuser",
      selectedCategories: ["Spor"],
      values: {
        clubName: "  Satranc Kulübü ",
        description: "  Her hafta bulusuyoruz ",
        password: "Secret123",
        university: "  UniVerse ",
      },
    });

    expect(result.registerPayload).toEqual(
      expect.objectContaining({
        accountType: "club",
        clubName: "Satranc Kulübü",
        description: "Her hafta bulusuyoruz",
        email: "club@example.com",
        password: "Secret123",
        university: "UniVerse",
        username: "clubuser",
      }),
    );
    expect(result.updatePayload).toEqual(
      expect.objectContaining({
        accountType: "club",
        categories: ["Spor"],
        userId: "",
      }),
    );
  });
});
