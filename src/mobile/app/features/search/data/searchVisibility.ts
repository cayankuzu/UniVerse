type SearchEventVisibilityShape = {
  clubUsername?: string | null;
  club_username?: string | null;
  clubIsPrivate?: boolean | null;
  club_is_private?: boolean | null;
  feedActorUsername?: string | null;
  feed_actor_username?: string | null;
  joined?: boolean | null;
};

type SearchAlbumVisibilityShape = SearchEventVisibilityShape & {
  clubIsPrivate?: boolean | null;
  club_is_private?: boolean | null;
  showOnClubProfile?: boolean | null;
  show_on_club_profile?: boolean | null;
  uploaderIsPrivate?: boolean | null;
  uploader_is_private?: boolean | null;
  username?: string | null;
  uploader_username?: string | null;
};

type SearchVisibilityOptions = {
  excludeFollowedContent?: boolean | null;
  followingClubUsernames?: Iterable<string> | null;
  followingUsernames?: Iterable<string> | null;
  viewerUsername?: string | null;
};

type SearchUserVisibilityShape = {
  username?: string | null;
};

function normalizeUsername(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function toUsernameSet(values?: Iterable<string> | null) {
  const usernames = new Set<string>();
  if (!values) return usernames;
  for (const value of values) {
    const username = normalizeUsername(value);
    if (username) usernames.add(username);
  }
  return usernames;
}

function readUsernameSet(values?: Iterable<string> | null) {
  return values instanceof Set ? values : toUsernameSet(values);
}

function resolveClubUsername(item: SearchEventVisibilityShape) {
  return normalizeUsername(item.clubUsername ?? item.club_username);
}

function resolveAlbumUploaderUsername(item: SearchAlbumVisibilityShape) {
  return normalizeUsername(item.username ?? item.uploader_username);
}

function resolveFeedActorUsername(item: SearchEventVisibilityShape) {
  return normalizeUsername(item.feedActorUsername ?? item.feed_actor_username);
}

export function isSearchEventVisible(
  item: SearchEventVisibilityShape | null | undefined,
  options: SearchVisibilityOptions = {},
) {
  if (!item) return false;

  const viewerUsername = normalizeUsername(options.viewerUsername);
  const clubUsername = resolveClubUsername(item);
  if (viewerUsername && clubUsername === viewerUsername) return false;

  if (options.excludeFollowedContent === false) {
    return true;
  }

  const followingClubUsernames = readUsernameSet(
    options.followingClubUsernames || options.followingUsernames || null,
  );
  if (clubUsername && followingClubUsernames.has(clubUsername)) return false;

  const feedActorUsername = resolveFeedActorUsername(item);
  if (feedActorUsername && readUsernameSet(options.followingUsernames).has(feedActorUsername)) {
    return false;
  }

  return true;
}

export function isSearchAlbumVisible(
  item: SearchAlbumVisibilityShape | null | undefined,
  options: SearchVisibilityOptions = {},
) {
  if (!item) return false;
  if (item.uploaderIsPrivate ?? item.uploader_is_private) return false;
  if (item.clubIsPrivate ?? item.club_is_private) return false;

  const viewerUsername = normalizeUsername(options.viewerUsername);
  const uploaderUsername = resolveAlbumUploaderUsername(item);
  if (viewerUsername && uploaderUsername === viewerUsername) return false;

  if (options.excludeFollowedContent === false) {
    return true;
  }

  const clubUsername = resolveClubUsername(item);
  if (clubUsername && readUsernameSet(options.followingClubUsernames).has(clubUsername)) {
    return false;
  }

  if (uploaderUsername && readUsernameSet(options.followingUsernames).has(uploaderUsername)) {
    return false;
  }

  return true;
}

export function isSearchUserVisible(
  item: SearchUserVisibilityShape | null | undefined,
  options: SearchVisibilityOptions = {},
) {
  if (!item) return false;
  const username = normalizeUsername(item.username);
  if (!username) return false;
  const viewerUsername = normalizeUsername(options.viewerUsername);
  if (viewerUsername && username === viewerUsername) return false;
  if (options.excludeFollowedContent === false) return true;
  return !readUsernameSet(options.followingUsernames).has(username);
}
