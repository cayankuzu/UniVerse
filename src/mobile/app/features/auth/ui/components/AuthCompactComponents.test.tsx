import React from "react";
import { render, screen } from "@testing-library/react-native";
import { AuthBrandFooter } from "./AuthBrandFooter";
import { RegistrationAvailabilityHint, RegistrationFieldError } from "./RegistrationWizardSections";

describe("compact authentication components", () => {
  it.each(["light", "dark"] as const)("renders the English brand footer in %s mode", (tone) => {
    render(<AuthBrandFooter tone={tone} />);
    expect(screen.getByText("Copyright 2026")).toBeOnTheScreen();
    expect(screen.getByText("MeMoDe")).toBeOnTheScreen();
  });

  it("shows validation hints only when they are relevant", () => {
    const { rerender } = render(
      <>
        <RegistrationAvailabilityHint active text="Checking" />
        <RegistrationFieldError message="Required" />
      </>,
    );
    expect(screen.getByText("Checking")).toBeOnTheScreen();
    expect(screen.getByText("Required")).toBeOnTheScreen();

    rerender(
      <>
        <RegistrationAvailabilityHint active={false} text="Checking" />
        <RegistrationFieldError message="" />
      </>,
    );
    expect(screen.queryByText("Checking")).not.toBeOnTheScreen();
    expect(screen.queryByText("Required")).not.toBeOnTheScreen();
  });
});
