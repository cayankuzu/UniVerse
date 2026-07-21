import React, { useRef } from "react";
import { render } from "@testing-library/react-native";
import { useScrollToTopOnReselect } from "../../../shared/hooks/useScrollToTopOnReselect";

function Harness(props: {
  onReselect?: () => void;
  onSecondReselect?: () => void;
  reselectCounter: number;
  scrollToOffset: jest.Mock;
}) {
  const listRef = useRef<{ scrollToOffset: jest.Mock } | null>({
    scrollToOffset: props.scrollToOffset,
  });

  useScrollToTopOnReselect({
    listRef,
    onReselect: props.onReselect,
    onSecondReselect: props.onSecondReselect,
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

  it("runs the optional refresh action on a quick second reselect", () => {
    const onSecondReselect = jest.fn();
    const scrollToOffset = jest.fn();
    const now = jest.spyOn(Date, "now").mockReturnValueOnce(10_000).mockReturnValueOnce(10_500);
    const { rerender } = render(
      <Harness
        onSecondReselect={onSecondReselect}
        reselectCounter={0}
        scrollToOffset={scrollToOffset}
      />,
    );

    rerender(
      <Harness
        onSecondReselect={onSecondReselect}
        reselectCounter={1}
        scrollToOffset={scrollToOffset}
      />,
    );
    rerender(
      <Harness
        onSecondReselect={onSecondReselect}
        reselectCounter={2}
        scrollToOffset={scrollToOffset}
      />,
    );

    expect(onSecondReselect).toHaveBeenCalledTimes(1);
    now.mockRestore();
  });
});
