import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { SearchTopPanel } from "./SearchTopPanel";

jest.mock("../../../app-shell/onboarding", () => ({
  TourAnchor: ({ children }: { children: React.ReactNode }) => children,
}));

describe("SearchTopPanel", () => {
  it("sends every discovery tab press immediately", () => {
    const onSelectType = jest.fn();
    const screen = render(
      <SearchTopPanel
        activeFilterCount={0}
        onSelectType={onSelectType}
        query=""
        selectedCategory=""
        selectedFee=""
        selectedUniversity=""
        setQuery={jest.fn()}
        setSelectedCategory={jest.fn()}
        setSelectedFee={jest.fn()}
        setSelectedUniversity={jest.fn()}
        setShowFilters={jest.fn()}
        setSortOption={jest.fn()}
        showFilters={false}
        sortOption="newest"
        supportsFilters
        topPanelBusy={false}
        type="albums"
      />,
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    fireEvent.press(tabs[1]);
    fireEvent.press(tabs[2]);
    fireEvent.press(tabs[3]);

    expect(onSelectType.mock.calls.map(([value]) => value)).toEqual([
      "events",
      "clubs",
      "students",
    ]);
  });
});
