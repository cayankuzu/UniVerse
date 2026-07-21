import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { InstantPressable } from "./InstantPressable";
import { triggerHapticFeedback } from "../feedback/haptics";

jest.mock("../feedback/haptics", () => ({
  triggerHapticFeedback: jest.fn(),
}));

describe("InstantPressable", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("responds with the requested haptic feedback", () => {
    const onPress = jest.fn();
    render(
      <InstantPressable accessibilityLabel="Open" haptic="selection" onPress={onPress}>
        <Text>Open</Text>
      </InstantPressable>,
    );

    fireEvent.press(screen.getByLabelText("Open"));

    expect(triggerHapticFeedback).toHaveBeenCalledWith("selection");
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("blocks repeated async actions and recovers after a rejection", async () => {
    let rejectAction: ((error: Error) => void) | undefined;
    const onPress = jest.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectAction = reject;
        }),
    );
    render(
      <InstantPressable accessibilityLabel="Submit" onPress={onPress} preventRepeatMs={0}>
        <Text>Submit</Text>
      </InstantPressable>,
    );

    const button = screen.getByLabelText("Submit");
    fireEvent.press(button);
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(button).toHaveProp("accessibilityState", { busy: true, disabled: true });

    await act(async () => {
      rejectAction?.(new Error("network"));
      await Promise.resolve();
    });

    expect(screen.getByLabelText("Submit")).toHaveProp("accessibilityState", {
      busy: undefined,
      disabled: false,
      checked: undefined,
      expanded: undefined,
      selected: undefined,
    });
  });

  it("recovers after an async action resolves", async () => {
    let resolveAction: (() => void) | undefined;
    const onPress = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveAction = resolve;
        }),
    );
    render(
      <InstantPressable accessibilityLabel="Load" onPress={onPress} preventRepeatMs={0}>
        <Text>Load</Text>
      </InstantPressable>,
    );

    fireEvent.press(screen.getByLabelText("Load"));
    await act(async () => {
      resolveAction?.();
      await Promise.resolve();
    });

    expect(screen.getByLabelText("Load")).toHaveProp("accessibilityState", {
      busy: undefined,
      disabled: false,
      checked: undefined,
      expanded: undefined,
      selected: undefined,
    });
  });
});
