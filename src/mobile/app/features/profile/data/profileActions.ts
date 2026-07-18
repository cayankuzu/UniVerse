import { AuthAPI } from "../../../data/auth";
import { ReportAPI } from "../../../data/normalizers/reports";

export async function checkProfileUsernameAvailability(
  username: string,
  options: { signal?: AbortSignal } = {},
) {
  return AuthAPI.checkUsername(username, options);
}

export async function submitProfileReport(username: string, reason = "Uygunsuz profil") {
  return ReportAPI.submit({
    reason,
    targetId: username,
    targetType: "user",
    targetUsername: username,
  });
}
