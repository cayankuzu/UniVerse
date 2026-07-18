import { normalizeHomeSortOption } from "./homeSortPolicy";

describe("normalizeHomeSortOption", () => {
  it("keeps home feed pinned to newest-first ordering", () => {
    expect(normalizeHomeSortOption("newest")).toBe("newest");
    expect(normalizeHomeSortOption("oldest")).toBe("newest");
    expect(normalizeHomeSortOption(undefined)).toBe("newest");
  });
});
