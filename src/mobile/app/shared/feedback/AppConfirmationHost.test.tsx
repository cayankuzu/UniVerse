import { act, render, waitFor } from "@testing-library/react-native";
import { AppConfirmationHost } from "./AppConfirmationHost";

const mockDismissConfirmAlert = jest.fn();
const mockShowErrorAlert = jest.fn();
let mockRequest: {
  cancelLabel?: string;
  confirmLabel: string;
  destructive?: boolean;
  id: string;
  message: string;
  onConfirm: () => Promise<void> | void;
  title: string;
} | null = null;
let mockSheetProps: Record<string, unknown> | null = null;

jest.mock("../utils/alerts", () => ({
  dismissConfirmAlert: (...args: unknown[]) => mockDismissConfirmAlert(...args),
  getActiveConfirmAlert: () => mockRequest,
  showErrorAlert: (...args: unknown[]) => mockShowErrorAlert(...args),
  subscribeConfirmAlerts: () => () => undefined,
}));

jest.mock("../components/DangerConfirmSheet", () => ({
  DangerConfirmSheet: (props: Record<string, unknown>) => {
    mockSheetProps = props;
    return null;
  },
}));

describe("AppConfirmationHost", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = null;
    mockSheetProps = null;
  });

  it("renders nothing without an active confirmation", () => {
    const screen = render(<AppConfirmationHost />);

    expect(screen.toJSON()).toBeNull();
    expect(mockSheetProps).toBeNull();
  });

  it("forwards the request and dismisses it from the close action", () => {
    mockRequest = {
      cancelLabel: "Vazgeç",
      confirmLabel: "Sil",
      destructive: true,
      id: "confirm-1",
      message: "Kaydı sil?",
      onConfirm: jest.fn(),
      title: "Silme onayı",
    };

    render(<AppConfirmationHost />);

    expect(mockSheetProps).toMatchObject({
      busy: false,
      cancelLabel: "Vazgeç",
      confirmLabel: "Sil",
      description: "Kaydı sil?",
      destructive: true,
      title: "Silme onayı",
      visible: true,
    });
    act(() => (mockSheetProps?.onClose as () => void)());
    expect(mockDismissConfirmAlert).toHaveBeenCalledWith("confirm-1");
  });

  it("locks duplicate actions while confirming and dismisses on success", async () => {
    let resolveConfirmation: (() => void) | undefined;
    const onConfirm = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirmation = resolve;
        }),
    );
    mockRequest = {
      confirmLabel: "Onayla",
      id: "confirm-2",
      message: "Devam et?",
      onConfirm,
      title: "Onay",
    };

    render(<AppConfirmationHost />);
    act(() => (mockSheetProps?.onConfirm as () => void)());
    await waitFor(() => expect(mockSheetProps).toMatchObject({ busy: true }));

    act(() => {
      (mockSheetProps?.onClose as () => void)();
      (mockSheetProps?.onConfirm as () => void)();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(mockDismissConfirmAlert).not.toHaveBeenCalled();

    await act(async () => {
      resolveConfirmation?.();
      await Promise.resolve();
    });
    expect(mockDismissConfirmAlert).toHaveBeenCalledWith("confirm-2");
  });

  it("unlocks and reports a failed confirmation", async () => {
    mockRequest = {
      confirmLabel: "Onayla",
      id: "confirm-3",
      message: "Devam et?",
      onConfirm: jest.fn(async () => {
        throw new Error("failed");
      }),
      title: "Onay",
    };

    render(<AppConfirmationHost />);
    act(() => (mockSheetProps?.onConfirm as () => void)());

    await waitFor(() => expect(mockShowErrorAlert).toHaveBeenCalledTimes(1));
    expect(mockDismissConfirmAlert).not.toHaveBeenCalled();
    expect(mockSheetProps).toMatchObject({ busy: false });
  });
});
