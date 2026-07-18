import React from "react";
import { Text } from "react-native";
import { render } from "@testing-library/react-native";
import { AsyncState } from "./AsyncState";
import { EmptyState } from "./EmptyState";

describe("AsyncState", () => {
  it("renders a loading message", () => {
    const screen = render(
      <AsyncState loading error={null}>
        <Text>Loaded</Text>
      </AsyncState>,
    );

    expect(screen.getByText("Yükleniyor...")).toBeOnTheScreen();
  });

  it("renders a custom loading fallback when provided", () => {
    const screen = render(
      <AsyncState loading error={null} loadingFallback={<Text>Skeleton</Text>}>
        <Text>Loaded</Text>
      </AsyncState>,
    );

    expect(screen.getByText("Skeleton")).toBeOnTheScreen();
    expect(screen.queryByText("Yükleniyor...")).not.toBeOnTheScreen();
  });

  it("renders its children when not loading, empty, or errored", () => {
    const screen = render(
      <AsyncState loading={false}>
        <Text>Loaded</Text>
      </AsyncState>,
    );

    expect(screen.getByText("Loaded")).toBeOnTheScreen();
  });

  it("renders the shared empty state contract", () => {
    const screen = render(
      <AsyncState empty emptySubtitle="Try another filter." emptyTitle="No items" loading={false}>
        <Text>Loaded</Text>
      </AsyncState>,
    );

    expect(screen.getByText("No items")).toBeOnTheScreen();
    expect(screen.getByText("Try another filter.")).toBeOnTheScreen();
  });
});

describe("EmptyState", () => {
  it("renders the title and subtitle", () => {
    const screen = render(<EmptyState title="No items" subtitle="Try again later." />);

    expect(screen.getByText("No items")).toBeOnTheScreen();
    expect(screen.getByText("Try again later.")).toBeOnTheScreen();
  });
});
