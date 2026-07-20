import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { ProfileTabsBar } from "./ProfileTabsBar";

jest.mock("../../../../app-shell/onboarding", () => ({
  TourAnchor: ({ children }: { children: React.ReactNode }) => children,
}));

describe("ProfileTabsBar", () => {
  it("opens the events tab on the first press", () => {
    const onChange = jest.fn();
    const screen = render(
      <ProfileTabsBar
        onChange={onChange}
        tab="album"
        tabs={[
          { count: 2, key: "album", label: "Albums" },
          { count: 3, key: "events", label: "Events" },
        ]}
      />,
    );

    fireEvent.press(screen.getByRole("tab", { name: "Events" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("events");
  });
});
