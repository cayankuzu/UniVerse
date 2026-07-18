import React from "react";
import { render } from "@testing-library/react-native";
import { Avatar } from "./Avatar";

const mockAppImage = jest.fn();

jest.mock("./AppImage", () => {
  const React = require("react");
  return {
    AppImage: (props: { onError?: () => void; uri?: string | null }) => {
      mockAppImage(props.uri);
      React.useEffect(() => {
        props.onError?.();
      }, [props]);
      return null;
    },
  };
});

describe("Avatar", () => {
  beforeEach(() => {
    mockAppImage.mockClear();
  });

  it("falls back to initials after an image error and retries when the source changes", () => {
    const screen = render(<Avatar name="Ada Lovelace" uri="avatars/ada-1.jpg" />);

    expect(screen.getByText("AL")).toBeTruthy();
    expect(mockAppImage).toHaveBeenCalledWith("avatars/ada-1.jpg");

    screen.rerender(<Avatar name="Ada Lovelace" uri="avatars/ada-2.jpg" />);

    expect(screen.getByText("AL")).toBeTruthy();
    expect(mockAppImage).toHaveBeenCalledWith("avatars/ada-2.jpg");
  });
});
