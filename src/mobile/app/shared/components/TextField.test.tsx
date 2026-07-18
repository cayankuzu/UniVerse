import React from "react";
import { render, screen } from "@testing-library/react-native";
import { TextField } from "./TextField";

describe("TextField", () => {
  it("uses the native field label and reserves supporting text space", () => {
    render(
      <TextField
        label="E-posta"
        onChangeText={() => undefined}
        supportingText="Hesabında kullandığın e-posta adresi"
        value=""
      />,
    );

    expect(screen.getByLabelText("E-posta")).toBeOnTheScreen();
    expect(screen.getByText("Hesabında kullandığın e-posta adresi")).toBeOnTheScreen();
  });

  it("prioritizes error text over neutral supporting text", () => {
    render(
      <TextField
        error="E-posta adresini kontrol et."
        label="E-posta"
        onChangeText={() => undefined}
        supportingText="Hesabında kullandığın e-posta adresi"
        value="bad"
      />,
    );

    expect(screen.getByText("E-posta adresini kontrol et.")).toBeOnTheScreen();
    expect(screen.queryByText("Hesabında kullandığın e-posta adresi")).not.toBeOnTheScreen();
  });
});
