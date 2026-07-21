import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { SettingsSectionGroup } from "./SettingsSectionGroup";

jest.mock("./SettingsActionCard", () => ({
  SettingsActionCard: (props: Record<string, any>) => {
    const { Text } = require("react-native");
    return (
      <Text accessibilityRole="button" onPress={props.onPress}>
        {`${props.title}:${props.groupPosition}`}
      </Text>
    );
  },
}));

const Icon = () => <Text>icon</Text>;

describe("SettingsSectionGroup", () => {
  it("assigns first, middle, and last positions and forwards presses", () => {
    const onPressItem = jest.fn();
    const items = ["one", "two", "three"].map((key) => ({
      action: "navigate" as const,
      iconBackgroundColor: "white",
      iconColor: "blue",
      Icon,
      key,
      subtitle: `${key} subtitle`,
      title: key,
    }));
    render(
      <SettingsSectionGroup
        onPressItem={onPressItem}
        section={{ key: "account", label: "Account", items } as never}
      />,
    );

    expect(screen.getByText("one:first")).toBeOnTheScreen();
    expect(screen.getByText("two:middle")).toBeOnTheScreen();
    expect(screen.getByText("three:last")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("two:middle"));
    expect(onPressItem).toHaveBeenCalledWith(items[1]);
  });
});
