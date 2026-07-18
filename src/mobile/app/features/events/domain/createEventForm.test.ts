import { hasCreateEventDraftChanges, INITIAL_CREATE_EVENT_FORM } from "./createEventForm";

describe("hasCreateEventDraftChanges", () => {
  it("returns false for the initial form state", () => {
    expect(
      hasCreateEventDraftChanges({
        coverImageUri: "",
        form: INITIAL_CREATE_EVENT_FORM,
        selectedCategories: [],
      }),
    ).toBe(false);
  });

  it("returns true when the draft contains form, category, or cover changes", () => {
    expect(
      hasCreateEventDraftChanges({
        coverImageUri: "",
        form: {
          ...INITIAL_CREATE_EVENT_FORM,
          title: "Etkinlik",
        },
        selectedCategories: [],
      }),
    ).toBe(true);

    expect(
      hasCreateEventDraftChanges({
        coverImageUri: "file:///cover.jpg",
        form: INITIAL_CREATE_EVENT_FORM,
        selectedCategories: [],
      }),
    ).toBe(true);

    expect(
      hasCreateEventDraftChanges({
        coverImageUri: "",
        form: INITIAL_CREATE_EVENT_FORM,
        selectedCategories: ["Teknoloji"],
      }),
    ).toBe(true);
  });
});
