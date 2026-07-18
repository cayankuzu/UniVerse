import type { View } from "react-native";
import { measureKeyboardSafeField } from "./KeyboardSafeForm";

describe("measureKeyboardSafeField", () => {
  it("measures against the native anchor ref instead of a numeric node handle", () => {
    const contentAnchor = {} as View;
    const onFailure = jest.fn();
    const onSuccess = jest.fn();
    const measureLayout = jest.fn();
    const target = { measureLayout } as unknown as View;

    expect(measureKeyboardSafeField(target, contentAnchor, onSuccess, onFailure)).toBe(true);
    expect(measureLayout).toHaveBeenCalledWith(contentAnchor, onSuccess, onFailure);
  });
});
