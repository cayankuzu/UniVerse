import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { AppButton } from "./AppButton";
import { GradientButton } from "./GradientButton";
import { triggerHapticFeedback } from "../feedback/haptics";

jest.mock("../feedback/haptics", () => ({
  triggerHapticFeedback: jest.fn(),
}));

describe("AppButton", () => {
  it("passes the accessibility label through to the native button", () => {
    render(
      <AppButton accessibilityLabel="Save changes button" label="Save" onPress={() => undefined} />,
    );

    expect(screen.getByLabelText("Save changes button")).toBeOnTheScreen();
  });

  it("supports success feedback and invokes the requested haptic before the action", () => {
    const onPress = jest.fn();
    render(<AppButton haptic="success" label="Done" onPress={onPress} variant="success" />);

    fireEvent.press(screen.getByLabelText("Done"));

    expect(triggerHapticFeedback).toHaveBeenCalledWith("success");
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("GradientButton", () => {
  it("forwards the accessibility label to AppButton", () => {
    render(
      <GradientButton
        accessibilityLabel="Follow action"
        label="Follow"
        onPress={() => undefined}
      />,
    );

    expect(screen.getByLabelText("Follow action")).toBeOnTheScreen();
  });
});
