import { getPasswordResetNotFoundMessage, requestPasswordResetEmail } from "./passwordResetRequest";

const mockCheckEmail = jest.fn();
const mockCreateTrackedAuthRedirectUrl = jest.fn();
const mockResetPasswordForEmail = jest.fn();

jest.mock("./auth.api", () => ({
  AuthAPI: {
    checkEmail: (...args: unknown[]) => mockCheckEmail(...args),
  },
}));

jest.mock("../../platform/security/authRedirectState", () => ({
  createTrackedAuthRedirectUrl: (...args: unknown[]) => mockCreateTrackedAuthRedirectUrl(...args),
}));

jest.mock("../../platform/supabase", () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
    },
  },
}));

describe("requestPasswordResetEmail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends reset mail only when the email is registered", async () => {
    mockCheckEmail.mockResolvedValue({ available: false, exists: true });
    mockCreateTrackedAuthRedirectUrl.mockResolvedValue("univers://reset-password");
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    await requestPasswordResetEmail("User@Example.com");

    expect(mockCheckEmail).toHaveBeenCalledWith("user@example.com");
    expect(mockCreateTrackedAuthRedirectUrl).toHaveBeenCalledWith({
      flow: "password-reset",
      target: "reset-password",
    });
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith("user@example.com", {
      redirectTo: "univers://reset-password",
    });
  });

  it("rejects unknown emails before talking to Supabase auth", async () => {
    mockCheckEmail.mockResolvedValue({ available: true, exists: false });

    await expect(requestPasswordResetEmail("missing@example.com")).rejects.toThrow(
      getPasswordResetNotFoundMessage(),
    );

    expect(mockCreateTrackedAuthRedirectUrl).not.toHaveBeenCalled();
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });
});
