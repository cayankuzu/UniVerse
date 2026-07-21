import React from "react";
import { render, screen } from "@testing-library/react-native";
import { EventPendingActions } from "./EventPendingActions";

describe("EventPendingActions", () => {
  it.each(["failed", "pending", "uploading"] as const)("renders the %s upload state", (status) => {
    render(<EventPendingActions status={status} />);
    expect(screen.getByText(/Yükle/)).toBeOnTheScreen();
  });
});
