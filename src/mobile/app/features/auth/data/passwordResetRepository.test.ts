import {
  sendForgotPasswordResetMail,
  toForgotPasswordUiErrorMessage,
} from "./passwordResetRepository";
import {
  getPasswordResetNotFoundMessage,
  requestPasswordResetEmail,
} from "../../../data/auth/passwordResetRequest";

jest.mock("../../../data/auth/passwordResetRequest", () => ({
  getPasswordResetNotFoundMessage: jest.fn(() => "Bu e-posta adresi ile kayitli hesap bulunamadi."),
  requestPasswordResetEmail: jest.fn(),
}));

const requestPasswordResetEmailMock = requestPasswordResetEmail as jest.MockedFunction<
  typeof requestPasswordResetEmail
>;

describe("passwordResetRepository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes forgot-password requests through to the shared auth helper", async () => {
    requestPasswordResetEmailMock.mockResolvedValueOnce({ data: {}, error: null } as never);

    await sendForgotPasswordResetMail("user@example.com");

    expect(requestPasswordResetEmailMock).toHaveBeenCalledWith("user@example.com");
  });

  it("preserves the registered-account-not-found message", () => {
    expect(
      toForgotPasswordUiErrorMessage(
        new Error("Bu e-posta adresi ile kayitli hesap bulunamadi."),
        "Sifirlama maili gonderilemedi.",
      ),
    ).toBe(getPasswordResetNotFoundMessage());
  });

  it("falls back to the safe generic message for unknown errors", () => {
    expect(
      toForgotPasswordUiErrorMessage(
        new Error("unexpected transport failure"),
        "Sifirlama maili gonderilemedi.",
      ),
    ).toBe("Sifirlama maili gonderilemedi.");
  });
});
