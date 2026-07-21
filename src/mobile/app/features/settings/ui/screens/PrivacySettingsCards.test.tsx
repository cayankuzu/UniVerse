import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import {
  PrivacySettingsExplainCard,
  PrivacySettingsNotice,
  PrivacySettingsToggleCard,
} from "./PrivacySettingsCards";

describe("privacy settings cards", () => {
  it("renders the notice and explanatory bullets", () => {
    render(
      <>
        <PrivacySettingsNotice body="Notice body" icon={<Text>!</Text>} title="Notice" />
        <PrivacySettingsExplainCard
          bulletColor="blue"
          icon={<Text>i</Text>}
          iconBg="white"
          items={["First", "Second"]}
          title="Details"
        />
      </>,
    );

    expect(screen.getByText("Notice body")).toBeOnTheScreen();
    expect(screen.getByText("First")).toBeOnTheScreen();
    expect(screen.getByText("Second")).toBeOnTheScreen();
  });

  it.each([true, false])("renders and operates an enabled=%s toggle", (enabled) => {
    const onPress = jest.fn();
    render(
      <PrivacySettingsToggleCard
        enabled={enabled}
        icon={<Text>lock</Text>}
        iconBg="white"
        onPress={onPress}
        pending={enabled}
        stateDetail="State detail"
        stateSummary="State summary"
        subtitle="Subtitle"
        title="Private account"
      />,
    );

    fireEvent.press(screen.getByRole("switch"));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText("State summary")).toBeOnTheScreen();
  });
});
