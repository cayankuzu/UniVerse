type ViewerIdentity = {
  userId?: string | null;
  username?: string | null;
};

type SearchEventLike = {
  clubUserId?: string | null;
  clubUsername?: string | null;
};

type SearchAlbumLike = {
  userId?: string | null;
  username?: string | null;
};

type SearchUserLike = {
  id?: string | null;
  username?: string | null;
};

function normalize(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isSameViewerIdentity(
  candidateId: unknown,
  candidateUsername: unknown,
  viewer: ViewerIdentity,
) {
  const viewerId = normalize(viewer.userId);
  const viewerUsername = normalize(viewer.username);
  const normalizedCandidateId = normalize(candidateId);
  const normalizedCandidateUsername = normalize(candidateUsername);

  return Boolean(
    (viewerId && normalizedCandidateId && viewerId === normalizedCandidateId) ||
    (viewerUsername &&
      normalizedCandidateUsername &&
      viewerUsername === normalizedCandidateUsername),
  );
}

export function isOwnSearchEvent(item: SearchEventLike, viewer: ViewerIdentity) {
  return isSameViewerIdentity(item.clubUserId, item.clubUsername, viewer);
}

export function isOwnSearchAlbum(item: SearchAlbumLike, viewer: ViewerIdentity) {
  return isSameViewerIdentity(item.userId, item.username, viewer);
}

export function isOwnSearchUser(item: SearchUserLike, viewer: ViewerIdentity) {
  return isSameViewerIdentity(item.id, item.username, viewer);
}
