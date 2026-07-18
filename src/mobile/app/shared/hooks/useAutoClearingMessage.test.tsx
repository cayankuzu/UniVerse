import React, { useEffect } from "react";
import { Text } from "react-native";
import { act, render, screen } from "@testing-library/react-native";
import { useAutoClearingMessage } from "./useAutoClearingMessage";

function Harness() {
  const { message, setMessage } = useAutoClearingMessage(3000);

  useEffect(() => {
    setMessage("Merhaba");
  }, [setMessage]);

  return <Text>{message ?? "empty"}</Text>;
}

describe("useAutoClearingMessage", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("clears the message after the timeout elapses", () => {
    render(<Harness />);

    expect(screen.getByText("Merhaba")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(screen.getByText("empty")).toBeTruthy();
  });
});
