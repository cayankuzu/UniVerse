import React from "react";
import { Text } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { AppIconButton } from "./AppIconButton";
import { triggerHapticFeedback } from "../feedback/haptics";

jest.mock("../feedback/haptics", () => ({
  triggerHapticFeedback: jest.fn(),
}));

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

  it("runs haptic feedback before the icon action", () => {
    const onPress = jest.fn();
    render(
      <AppIconButton
        accessibilityLabel="Create"
        haptic="light"
        icon={({ size }) => <Text>{size}</Text>}
        onPress={onPress}
      />,
    );

    fireEvent.press(screen.getByLabelText("Create"));

    expect(triggerHapticFeedback).toHaveBeenCalledWith("light");
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
