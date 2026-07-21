import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { useFonts } from "expo-font";
import { AppFontGate } from "./AppFontGate";

jest.mock("expo-font", () => ({ useFonts: jest.fn() }));
jest.mock("@expo-google-fonts/inter/400Regular", () => ({ Inter_400Regular: 400 }));
jest.mock("@expo-google-fonts/inter/500Medium", () => ({ Inter_500Medium: 500 }));
jest.mock("@expo-google-fonts/inter/600SemiBold", () => ({ Inter_600SemiBold: 600 }));
jest.mock("@expo-google-fonts/inter/700Bold", () => ({ Inter_700Bold: 700 }));
jest.mock("@expo-google-fonts/inter/800ExtraBold", () => ({ Inter_800ExtraBold: 800 }));

describe("AppFontGate", () => {
  it("keeps content hidden while fonts are loading", () => {
    (useFonts as jest.Mock).mockReturnValue([false, null]);
    render(
      <AppFontGate>
        <Text>ready</Text>
      </AppFontGate>,
    );

    expect(screen.queryByText("ready")).not.toBeOnTheScreen();
  });

  it.each([
    [true, null],
    [false, new Error("font unavailable")],
  ])("renders content when loaded=%s and an optional error is present", (loaded, error) => {
    (useFonts as jest.Mock).mockReturnValue([loaded, error]);
    render(
      <AppFontGate>
        <Text>ready</Text>
      </AppFontGate>,
    );

    expect(screen.getByText("ready")).toBeOnTheScreen();
  });
});
