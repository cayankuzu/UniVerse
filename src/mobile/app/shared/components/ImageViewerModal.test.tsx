import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ImageViewerModal } from "./ImageViewerModal";

beforeAll(() => {
  global.clearImmediate = clearTimeout as unknown as typeof clearImmediate;
  global.setImmediate = setTimeout as unknown as typeof setImmediate;
});

jest.mock("./AppModalHost", () => ({
  AppModalHost: ({ children, visible }: { children: React.ReactNode; visible: boolean }) =>
    visible ? children : null,
}));

jest.mock("./AppImage", () => ({
  AppImage: ({ uri }: { uri: string }) => {
    const { Text } = require("react-native");
    return <Text>{uri}</Text>;
  },
}));

describe("ImageViewerModal", () => {
  it("renders the selected image and closes from the backdrop", () => {
    const onClose = jest.fn();
    render(<ImageViewerModal onClose={onClose} uri="file:///photo.jpg" visible />);

    expect(screen.getByText("file:///photo.jpg")).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText("Görsel önizleme"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
