import { projectionKeys } from "../projections/projectionKeys";

export function getProfileContentProjectionKeys(username: string, viewerCacheKey: string) {
  return [
    projectionKeys.profileContent(username, "album", viewerCacheKey),
    projectionKeys.profileContent(username, "events", viewerCacheKey),
  ] as const;
}

export function getProfileRelationshipProjectionKeys(username: string, viewerCacheKey: string) {
  return [
    projectionKeys.relationships(username, "followers", viewerCacheKey),
    projectionKeys.relationships(username, "following", viewerCacheKey),
  ] as const;
}

export function getProfileSurfaceProjectionKeys(username: string, viewerCacheKey: string) {
  return [
    projectionKeys.profileOverview(username, viewerCacheKey),
    ...getProfileContentProjectionKeys(username, viewerCacheKey),
    ...getProfileRelationshipProjectionKeys(username, viewerCacheKey),
  ] as const;
}
