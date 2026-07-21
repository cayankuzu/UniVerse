import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ListSearchBar } from "./ListSearchBar";

describe("ListSearchBar", () => {
  it("tracks focus, forwards text changes, and clears an existing value", () => {
    const onChangeText = jest.fn();
    render(
      <ListSearchBar
        accessibilityLabel="Search people"
        onChangeText={onChangeText}
        placeholder="Search"
        value="Ada"
      />,
    );

    const input = screen.getByLabelText("Search people");
    fireEvent(input, "focus");
    fireEvent.changeText(input, "Grace");
    fireEvent(input, "blur");
    fireEvent.press(screen.getByRole("button"));

    expect(onChangeText).toHaveBeenCalledWith("Grace");
    expect(onChangeText).toHaveBeenCalledWith("");
  });
});
