import React, { useRef } from "react";
import { render } from "@testing-library/react-native";
import { useScrollToTopOnReselect } from "../../../shared/hooks/useScrollToTopOnReselect";

function Harness(props: {
  onReselect?: () => void;
  reselectCounter: number;
  scrollToOffset: jest.Mock;
}) {
  const listRef = useRef<{ scrollToOffset: jest.Mock } | null>({
    scrollToOffset: props.scrollToOffset,
  });

  useScrollToTopOnReselect({
    listRef,
    onReselect: props.onReselect,
    reselectCounter: props.reselectCounter,
  });

  return null;
}

describe("useScrollToTopOnReselect", () => {
  it("resets state and scrolls to the top when the counter increments", () => {
    const onReselect = jest.fn();
    const scrollToOffset = jest.fn();
    const { rerender } = render(
      <Harness onReselect={onReselect} reselectCounter={0} scrollToOffset={scrollToOffset} />,
    );

    rerender(
      <Harness onReselect={onReselect} reselectCounter={1} scrollToOffset={scrollToOffset} />,
    );

    expect(onReselect).toHaveBeenCalledTimes(1);
    expect(scrollToOffset).toHaveBeenCalledWith({ animated: false, offset: 0 });
  });
});
