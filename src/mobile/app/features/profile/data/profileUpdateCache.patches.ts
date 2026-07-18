import type { QueryClient } from "@tanstack/react-query";
import type { UserProfile } from "../../../data/contracts/entities";
import {
  applyEntityPatches,
  hardResetProjectionScope,
} from "../../../data/projections/patchEnvelope";
import { getProfileSurfaceProjectionKeys } from "../../../data/profile/profileProjectionKeys";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import { refreshViewerPrivacySensitiveScreens } from "../../../data/projections/projectionRefresh";
import { profileToUserData } from "../../../data/normalizers/profileUserData";
import {
  normalizeProfileUsername,
  patchProfileOverviewRow,
  type ProfileUpdateUserData,
} from "./profileUpdateCache.shared";

interface ProfileUpdateStateContext {
  queryClient: QueryClient;
  updateUserData: (payload: Record<string, unknown>) => void;
  viewerKey: string;
}

function patchProjectedUserCards(queryClient: QueryClient, profile: UserProfile) {
  const normalizedId = String(profile.id || "").trim();
  const normalizedUsername = normalizeProfileUsername(profile.username);
  const ids = Array.from(new Set([normalizedId, normalizedUsername].filter(Boolean)));
  if (ids.length === 0) return;

  const changes = {
    accountType: profile.accountType,
    account_type: profile.accountType,
    bio: profile.bio || "",
    categories: Array.isArray(profile.categories) ? profile.categories : [],
    category: Array.isArray(profile.categories) ? profile.categories[0] || "" : "",
    clubName: profile.clubName || "",
    club_name: profile.clubName || "",
    coverImage: profile.coverImage || "",
    cover_image_path: profile.coverImage || "",
    department: profile.department || "",
    description: profile.description || "",
    gradeYear: profile.gradeYear || "",
    grade_year: profile.gradeYear || "",
    image: profile.profileImage || "",
    isPrivate: Boolean(profile.isPrivate),
    is_private: Boolean(profile.isPrivate),
    name: profile.name || profile.clubName || profile.username || "",
    profileImage: profile.profileImage || "",
    profile_image_path: profile.profileImage || "",
    university: profile.university || "",
    username: normalizedUsername,
    year: profile.gradeYear || "",
  };

  applyEntityPatches(
    queryClient,
    ids.flatMap((id) => [
      { changes, entity: "relationships", id },
      { changes, entity: "search-users", id },
    ]),
  );
}

function clearPreviousUsernameCaches(
  queryClient: QueryClient,
  previousUsername: string,
  viewerKey: string,
) {
  getProfileSurfaceProjectionKeys(previousUsername, viewerKey).forEach((queryKey) => {
    hardResetProjectionScope(queryClient, queryKey);
  });
}

export function applyOptimisticProfileState(
  params: ProfileUpdateStateContext & {
    optimisticUserData: ProfileUpdateUserData;
    previousUsername: string;
  },
) {
  const nextUsername = normalizeProfileUsername(params.optimisticUserData.username);
  const previousOverviewKey = projectionKeys.profileOverview(
    params.previousUsername,
    params.viewerKey,
  );
  const nextOverviewKey = projectionKeys.profileOverview(nextUsername, params.viewerKey);
  const overviewPatch = patchProfileOverviewRow(params.optimisticUserData, params.previousUsername);

  params.updateUserData(params.optimisticUserData as Record<string, unknown>);
  params.queryClient.setQueryData(previousOverviewKey, overviewPatch);
  params.queryClient.setQueryData(nextOverviewKey, overviewPatch);
}

export function restorePreviousProfileState(
  params: ProfileUpdateStateContext & {
    nextUsername: string;
    previousUserData: ProfileUpdateUserData;
    previousUsername: string;
  },
) {
  params.updateUserData(params.previousUserData as Record<string, unknown>);
  params.queryClient.setQueryData(
    projectionKeys.profileOverview(params.previousUsername, params.viewerKey),
    patchProfileOverviewRow(params.previousUserData, params.previousUsername),
  );
  if (params.nextUsername && params.nextUsername !== params.previousUsername) {
    hardResetProjectionScope(
      params.queryClient,
      projectionKeys.profileOverview(params.nextUsername, params.viewerKey),
    );
  }
}

export function applyResolvedProfileState(
  params: ProfileUpdateStateContext & {
    previousUsername: string;
    profile: UserProfile;
  },
) {
  const normalizedPreviousUsername = normalizeProfileUsername(params.previousUsername);
  const normalizedNextUsername = normalizeProfileUsername(params.profile.username);

  params.updateUserData(profileToUserData(params.profile) as unknown as Record<string, unknown>);
  params.queryClient.setQueryData(
    projectionKeys.profileOverview(
      normalizedPreviousUsername || normalizedNextUsername,
      params.viewerKey,
    ),
    patchProfileOverviewRow(
      params.profile as unknown as ProfileUpdateUserData,
      normalizedNextUsername,
    ),
  );
  params.queryClient.setQueryData(
    projectionKeys.profileOverview(normalizedNextUsername, params.viewerKey),
    patchProfileOverviewRow(
      params.profile as unknown as ProfileUpdateUserData,
      normalizedNextUsername,
    ),
  );
  patchProjectedUserCards(params.queryClient, params.profile);

  if (normalizedPreviousUsername && normalizedPreviousUsername !== normalizedNextUsername) {
    clearPreviousUsernameCaches(params.queryClient, normalizedPreviousUsername, params.viewerKey);
  }

  refreshViewerPrivacySensitiveScreens(
    params.queryClient,
    params.viewerKey,
    normalizedNextUsername,
  );
}
