import type { UserProfile } from "../../../data/contracts/entities";

export type ProfileUpdateUserData = Record<string, unknown>;

export function normalizeProfileUsername(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function patchProfileOverviewRow(
  optimisticUserData: ProfileUpdateUserData,
  fallbackUsername: string,
) {
  return (current: unknown) => {
    const row =
      current && typeof current === "object"
        ? (current as {
            capabilities?: unknown;
            followStatus?: "none" | "requested" | "following";
            id?: string;
            profile?: Record<string, unknown>;
            username?: string;
          })
        : null;
    const nextUsername = normalizeProfileUsername(
      optimisticUserData.username || fallbackUsername || "",
    );
    const nextProfileId = String(
      optimisticUserData.id || row?.profile?.id || row?.profile?.userId || row?.id || nextUsername,
    );
    return {
      ...(row || {}),
      capabilities: row?.capabilities ?? null,
      followStatus: row?.followStatus ?? "none",
      id: nextUsername || nextProfileId || row?.id,
      profile: {
        ...(row?.profile || {}),
        ...optimisticUserData,
        id: nextProfileId,
        username: nextUsername,
      },
      username: nextUsername || row?.username,
    };
  };
}

export function patchUserProfileRow(profile: Partial<UserProfile>) {
  return (current: unknown) => {
    if (!current || typeof current !== "object") return { ...profile };
    return { ...(current as Record<string, unknown>), ...profile };
  };
}
