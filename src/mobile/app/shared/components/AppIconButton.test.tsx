import React from "react";
import { Text } from "react-native";
import { render, screen } from "@testing-library/react-native";
import { AppIconButton } from "./AppIconButton";

describe("AppIconButton", () => {
  it("formats large badges without breaking the control", () => {
    render(
      <AppIconButton
        accessibilityLabel="Notifications"
        badgeContent={150}
        icon={({ size }) => <Text>{size}</Text>}
      />,
    );

    expect(screen.getByLabelText("Notifications")).toBeOnTheScreen();
    expect(screen.getByText("99+")).toBeOnTheScreen();
  });

  it("keeps disabled and selected state available to assistive tech", () => {
    render(
      <AppIconButton
        accessibilityLabel="Filter"
        disabled
        icon={({ size }) => <Text>{size}</Text>}
        selected
      />,
    );

    expect(screen.getByLabelText("Filter")).toHaveProp("accessibilityState", {
      disabled: true,
      selected: true,
    });
  });
});
