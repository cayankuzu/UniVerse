import React from "react";
import { render, screen } from "@testing-library/react-native";
import { StartupSplashScreen } from "./StartupSplashScreen";

describe("StartupSplashScreen", () => {
  it("renders the native splash artwork as a non-interactive overlay", () => {
    render(<StartupSplashScreen />);

    expect(screen.getByTestId("startup-splash-overlay")).toHaveProp("pointerEvents", "none");
  });
});
