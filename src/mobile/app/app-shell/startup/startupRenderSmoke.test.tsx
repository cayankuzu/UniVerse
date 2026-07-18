import React from "react";
import { render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PaperProvider } from "react-native-paper";
import { appTheme } from "../../shared/theme";
import { MainBottomTabs } from "../navigation/components/MainBottomTabs";

function renderWithProviders(node: React.ReactElement) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 44, right: 0, bottom: 34, left: 0 },
      }}
    >
      <PaperProvider theme={appTheme}>{node}</PaperProvider>
    </SafeAreaProvider>,
  );
}

describe("startup render smoke", () => {
  it("renders bottom tabs without crashing", () => {
    const screen = renderWithProviders(
      <MainBottomTabs
        active="home"
        accountType="student"
        onHome={() => undefined}
        onSearch={() => undefined}
        onProfile={() => undefined}
      />,
    );

    expect(screen.getByText("Ana Sayfa")).toBeTruthy();
    expect(screen.getByText("Keşfet")).toBeTruthy();
    expect(screen.getByText("Profil")).toBeTruthy();
  });
});
