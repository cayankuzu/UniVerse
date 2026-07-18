import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { AuthLegalConsent } from "./AuthLegalConsent";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  }),
}));

jest.mock("../../../../shared/components", () => ({
  AppModalHost: ({ children, visible }: { children: React.ReactNode; visible?: boolean }) => {
    const { View } = require("react-native");
    return visible ? <View>{children}</View> : null;
  },
  AppScrollView: ({ children }: { children: React.ReactNode }) => {
    const { View } = require("react-native");
    return <View>{children}</View>;
  },
  GradientButton: ({ label, onPress }: { label: string; onPress: () => void }) => {
    const { Pressable, Text } = require("react-native");
    return (
      <Pressable accessibilityRole="button" onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    );
  },
}));

describe("AuthLegalConsent", () => {
  it("opens the related legal document in a modal", () => {
    render(<AuthLegalConsent accepted={false} onToggleAccepted={() => undefined} />);

    fireEvent.press(screen.getByText("Kullanım Koşulları"));

    expect(screen.getByText("Hizmetin Tanımı ve Kabul")).toBeTruthy();
    expect(screen.getByText("Anladım")).toBeTruthy();
  });

  it("toggles acceptance from the checkbox control", () => {
    const onToggleAccepted = jest.fn();

    render(<AuthLegalConsent accepted={false} onToggleAccepted={onToggleAccepted} />);

    fireEvent.press(screen.getByLabelText("Yasal metinleri kabul et"));

    expect(onToggleAccepted).toHaveBeenCalledTimes(1);
  });
});
