import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { FeedToast } from "./FeedToast";

jest.mock("../layout/bottomNavSpacing", () => ({
  useFloatingBottomMargin: jest.fn(() => 48),
}));

describe("FeedToast", () => {
  it("does not render an empty message", () => {
    render(<FeedToast message={null} />);
    expect(screen.queryByRole("text")).not.toBeOnTheScreen();
  });

  it.each(["error", "success", "info", "warning"] as const)(
    "renders the %s semantic tone",
    (tone) => {
      render(<FeedToast message={`${tone} message`} tone={tone} />);
      expect(screen.getByText(`${tone} message`)).toBeOnTheScreen();
    },
  );

  it("exposes and invokes an optional recovery action", () => {
    const onAction = jest.fn();
    render(
      <FeedToast actionLabel="Retry" message="Could not load" onAction={onAction} tone="error" />,
    );

    fireEvent.press(screen.getByLabelText("Retry"));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
