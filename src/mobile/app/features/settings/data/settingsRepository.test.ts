import {
  sendPasswordResetMail,
  updateViewerPrivacySetting,
  updateViewerProfileSetting,
  verifySettingsPassword,
} from "./settingsRepository";

const mockUpdatePrivacy = jest.fn();
const mockUpdateProfile = jest.fn();
const mockGetUser = jest.fn();
const mockRequestPasswordResetEmail = jest.fn();
const mockSignInWithPassword = jest.fn();

jest.mock("../../../data/auth", () => ({
  AuthAPI: {
    updatePrivacy: (...args: unknown[]) => mockUpdatePrivacy(...args),
    updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  },
}));

jest.mock("../../../data/auth/passwordResetRequest", () => ({
  requestPasswordResetEmail: (...args: unknown[]) => mockRequestPasswordResetEmail(...args),
}));

jest.mock("../../../platform/supabase", () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
    },
  },
}));

describe("settingsRepository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("verifies the current password with Supabase auth", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { session: null }, error: null });

    await verifySettingsPassword("user@example.com", "Password1");

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "Password1",
    });
  });

  it("delegates password reset mail requests through the guarded helper", async () => {
    mockRequestPasswordResetEmail.mockResolvedValue({ data: {}, error: null });

    await sendPasswordResetMail("user@example.com");

    expect(mockRequestPasswordResetEmail).toHaveBeenCalledWith("user@example.com");
  });

  it("persists privacy and hide-email settings through AuthAPI", async () => {
    mockUpdatePrivacy.mockResolvedValue({ isPrivate: true });
    mockUpdateProfile.mockResolvedValue({ hideEmail: true });

    await updateViewerPrivacySetting(true);
    await updateViewerProfileSetting("hideEmail", true);

    expect(mockUpdatePrivacy).toHaveBeenCalledWith(true);
    expect(mockUpdateProfile).toHaveBeenCalledWith({ hideEmail: true });
  });
});
