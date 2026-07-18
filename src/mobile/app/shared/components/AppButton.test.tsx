import React from "react";
import { render, screen } from "@testing-library/react-native";
import { AppButton } from "./AppButton";
import { GradientButton } from "./GradientButton";

describe("AppButton", () => {
  it("passes the accessibility label through to the native button", () => {
    render(
      <AppButton accessibilityLabel="Save changes button" label="Save" onPress={() => undefined} />,
    );

    expect(screen.getByLabelText("Save changes button")).toBeOnTheScreen();
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
