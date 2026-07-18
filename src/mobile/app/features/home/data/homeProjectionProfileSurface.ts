import type { ProjectionEnvelope } from "../../../data/query/contracts";
import { AlbumAPI, EventAPI, getLocalEventShadowByClubUserId } from "../../../data/content";
import type { EventWithMeta } from "../../../data/contracts/content";
import { debugWarn } from "../../../platform/logging/logger";
import { supabase } from "../../../platform/supabase";
import { getFollowingProfiles } from "../../../data/social/profileFollowing";
import {
  buildHomeProjectionItems,
  filterLegacyHomeItems,
  nowEnvelope,
} from "../../../data/projections/projections.api.helpers";
import { mergeAlbumCollections } from "../../../data/normalizers/albums";
import { normalizeProjectionValue } from "../../../data/projections/projections.common";
import type {
  HomeProjectionParams,
  ProjectionHomeFeedItem,
} from "../../../data/projections/projections.types";
import { mergeProjectionItemsById } from "./homeProjectionFallback";
import { prepareHomeFeedItems } from "./homeFeedAdapters";

const MAX_HOME_PROFILE_SURFACE_FALLBACK_PROFILES = 8;

export type HomeProfileSurfaceFallback = {
  accountType: "club" | "student";
  source: "following" | "own";
  username: string;
};

export type HomeProfileSurfaceContext = {
  canonicalViewerUsername: string;
  profiles: HomeProfileSurfaceFallback[];
};

type HomeProfileSurfaceSeed = {
  seedProfiles?: HomeProfileSurfaceFallback[];
};

function normalizeFallbackAccountType(value: unknown, fallback: "club" | "student") {
  return value === "club" ? "club" : value === "student" ? "student" : fallback;
}

export async function buildOwnClubShadowItems(
  params: HomeProjectionParams,
): Promise<ProjectionHomeFeedItem[]> {
  if (params.viewerAccountType !== "club" || !params.viewerId || params.typeFilter === "albums") {
    return [];
  }

  const localOwnEvents = await getLocalEventShadowByClubUserId(params.viewerId);
  if (localOwnEvents.length === 0) {
    return [];
  }

  return prepareHomeFeedItems(
    filterLegacyHomeItems(
      buildHomeProjectionItems({
        albums: [],
        events: localOwnEvents,
        viewerUsername: params.viewerUsername,
      }),
      params,
    ),
    params.sortOption || "newest",
  );
}

export async function loadProfileSurfaceContext(
  params: HomeProjectionParams,
  options: HomeProfileSurfaceSeed = {},
): Promise<HomeProfileSurfaceContext> {
  const fallbackProfiles: HomeProfileSurfaceFallback[] = [];
  const fallbackProfileKeys = new Set<string>();
  const pushProfileFallback = (profile: HomeProfileSurfaceFallback) => {
    const normalizedUsername = normalizeProjectionValue(profile.username || "");
    if (!normalizedUsername) {
      return;
    }
    const cacheKey = `${profile.source}:${normalizedUsername}`;
    if (fallbackProfileKeys.has(cacheKey)) {
      return;
    }
    fallbackProfileKeys.add(cacheKey);
    fallbackProfiles.push({
      ...profile,
      username: normalizedUsername,
    });
  };

  const hasSeedProfiles = Array.isArray(options.seedProfiles);
  const seededProfiles = hasSeedProfiles ? options.seedProfiles || [] : [];

  let canonicalViewerUsername = normalizeProjectionValue(params.viewerUsername || "");
  let canonicalViewerAccountType = normalizeFallbackAccountType(
    params.viewerAccountType,
    "student",
  );

  const shouldResolveViewerProfile =
    Boolean(params.viewerId) && (!canonicalViewerUsername || !params.viewerAccountType);

  if (shouldResolveViewerProfile) {
    const { data: viewerProfile } = await supabase
      .from("profiles")
      .select("username,account_type")
      .eq("user_id", params.viewerId)
      .is("deleted_at", null)
      .maybeSingle();

    canonicalViewerUsername = normalizeProjectionValue(
      viewerProfile?.username || canonicalViewerUsername,
    );
    canonicalViewerAccountType = normalizeFallbackAccountType(
      viewerProfile?.account_type,
      canonicalViewerAccountType,
    );
  }

  seededProfiles.forEach((profile) => {
    if (profile.source !== "following") {
      return;
    }
    pushProfileFallback({
      accountType: normalizeFallbackAccountType(profile.accountType, "student"),
      source: "following",
      username: profile.username,
    });
  });

  if (params.viewerId && !hasSeedProfiles) {
    if (params.sourceFilter !== "own") {
      const { data: followRows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", params.viewerId)
        .eq("status", "accepted")
        .is("deleted_at", null);

      const followingIds = Array.from(
        new Set(
          ((followRows as Array<{ following_id?: string }> | null) || [])
            .map((row) => String(row.following_id || "").trim())
            .filter(Boolean),
        ),
      );

      if (followingIds.length > 0) {
        const { data: followingProfiles } = await supabase
          .from("profiles")
          .select("username,account_type")
          .in("user_id", followingIds)
          .is("deleted_at", null);

        ((followingProfiles as Array<{ username?: string; account_type?: unknown }> | null) || [])
          .slice(0, MAX_HOME_PROFILE_SURFACE_FALLBACK_PROFILES)
          .forEach((profile) => {
            pushProfileFallback({
              accountType: normalizeFallbackAccountType(profile.account_type, "student"),
              source: "following",
              username: String(profile.username || ""),
            });
          });
      }
    }
  }

  if (canonicalViewerUsername) {
    pushProfileFallback({
      accountType: canonicalViewerAccountType,
      source: "own",
      username: canonicalViewerUsername,
    });
  }

  if (
    params.sourceFilter !== "own" &&
    !hasSeedProfiles &&
    fallbackProfiles.filter((profile) => profile.source === "following").length === 0 &&
    canonicalViewerUsername
  ) {
    const followingProfiles = await getFollowingProfiles(canonicalViewerUsername).catch((error) => {
      debugWarn("HOME/PROFILE-SURFACE", "following-profile-fallback-load-failed", {
        message: String(
          (error as { message?: string } | null)?.message ||
            "following-profile-fallback-load-failed",
        ),
        viewerUsername: canonicalViewerUsername,
      });
      return [];
    });
    followingProfiles.slice(0, MAX_HOME_PROFILE_SURFACE_FALLBACK_PROFILES).forEach((profile) => {
      pushProfileFallback({
        accountType: normalizeFallbackAccountType(profile.accountType, "student"),
        source: "following",
        username: String(profile.username || ""),
      });
    });
  }

  return {
    canonicalViewerUsername,
    profiles: fallbackProfiles,
  };
}

function annotateProfileSurfaceEvents(
  events: EventWithMeta[],
  profile: HomeProfileSurfaceFallback,
): EventWithMeta[] {
  if (events.length === 0) {
    return events;
  }

  const actorType = profile.accountType === "student" ? "student" : "club";
  const feedSource =
    profile.source === "own"
      ? "own"
      : actorType === "student"
        ? "following_student"
        : "following_club";

  return events.map((event) => ({
    ...event,
    feedActorType: event.feedActorType || actorType,
    feedActorUsername: event.feedActorUsername || profile.username,
    feedSource: event.feedSource || feedSource,
  }));
}

export async function buildProfileSurfaceFallbackEnvelope(
  params: HomeProjectionParams,
  profileSurfaceContext: HomeProfileSurfaceContext,
): Promise<ProjectionEnvelope<ProjectionHomeFeedItem>> {
  if (profileSurfaceContext.profiles.length === 0) {
    return nowEnvelope([]);
  }

  const profileResults = await Promise.all(
    profileSurfaceContext.profiles.map(async (profile) => {
      const shouldLoadEvents = params.typeFilter !== "albums" && profile.accountType === "club";
      const shouldLoadAlbums = params.typeFilter !== "events";

      const [events, albums] = await Promise.all([
        shouldLoadEvents
          ? profile.accountType === "club"
            ? EventAPI.getByClub(profile.username)
            : EventAPI.getProfileEvents(profile.username)
          : Promise.resolve([] as EventWithMeta[]),
        shouldLoadAlbums ? AlbumAPI.getPhotos(profile.username) : Promise.resolve([]),
      ]);

      return {
        albums,
        events: annotateProfileSurfaceEvents(events, profile),
      };
    }),
  );

  const mergedEvents = mergeProjectionItemsById(...profileResults.map((result) => result.events));
  const mergedAlbums = mergeAlbumCollections(...profileResults.map((result) => result.albums));

  return nowEnvelope(
    prepareHomeFeedItems(
      filterLegacyHomeItems(
        buildHomeProjectionItems({
          albums: mergedAlbums,
          events: mergedEvents,
          viewerUsername: profileSurfaceContext.canonicalViewerUsername || params.viewerUsername,
        }),
        params,
      ),
      params.sortOption || "newest",
    ),
  );
}

export async function getHomeProfileSurfaceSupplement(
  params: HomeProjectionParams & HomeProfileSurfaceSeed,
): Promise<ProjectionEnvelope<ProjectionHomeFeedItem>> {
  return buildProfileSurfaceFallbackEnvelope(
    params,
    await loadProfileSurfaceContext(params, {
      seedProfiles: params.seedProfiles,
    }),
  );
}
