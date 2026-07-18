function normalizeScopePart(value: unknown, lowerCase = true) {
  const normalized = String(value || "").trim();
  return lowerCase ? normalized.toLowerCase() : normalized;
}

export const projectionKeys = {
  screen: (domain: string, ...params: unknown[]) => ["screen", domain, ...params] as const,
  entity: (domain: string, id: string) => ["entity", domain, id] as const,
  badge: (domain: string, viewerKey: string) => ["badge", domain, viewerKey] as const,
  home: (viewerKey: string, filtersScope: string) =>
    [
      "screen",
      "home",
      normalizeScopePart(viewerKey),
      normalizeScopePart(filtersScope, false),
    ] as const,
  notifications: (viewerKey: string, filter: string) =>
    ["screen", "notifications", normalizeScopePart(viewerKey), normalizeScopePart(filter)] as const,
  notificationBadge: (viewerKey: string) =>
    ["badge", "notifications", normalizeScopePart(viewerKey)] as const,
  profileOverview: (username: string, viewerKey: string) =>
    [
      "screen",
      "profile-overview",
      normalizeScopePart(username),
      normalizeScopePart(viewerKey),
    ] as const,
  profileScreen: (username: string, tab: string, viewerKey: string) =>
    [
      "screen",
      "profile-screen",
      normalizeScopePart(username),
      normalizeScopePart(tab),
      normalizeScopePart(viewerKey),
    ] as const,
  profileContent: (username: string, tab: string, viewerKey: string) =>
    [
      "screen",
      "profile-content",
      normalizeScopePart(username),
      normalizeScopePart(tab),
      normalizeScopePart(viewerKey),
    ] as const,
  relationships: (username: string, kind: string, viewerKey: string) =>
    [
      "screen",
      "relationships",
      normalizeScopePart(username),
      normalizeScopePart(kind),
      normalizeScopePart(viewerKey),
    ] as const,
  eventDetail: (eventId: string, viewerKey: string) =>
    ["screen", "event-detail", normalizeScopePart(eventId), normalizeScopePart(viewerKey)] as const,
  albumEvent: (eventId: string, viewerKey: string) =>
    ["screen", "album-event", normalizeScopePart(eventId), normalizeScopePart(viewerKey)] as const,
  search: (kind: string, viewerKey: string, queryHash: string) =>
    [
      "screen",
      "search",
      normalizeScopePart(kind),
      normalizeScopePart(viewerKey),
      normalizeScopePart(queryHash, false),
    ] as const,
  blockedUsers: (viewerKey: string) =>
    ["screen", "blocked-users", normalizeScopePart(viewerKey)] as const,
  eventComments: (eventId: string) => ["screen", "event-comments", eventId] as const,
  eventLikers: (eventId: string) => ["screen", "event-likers", eventId] as const,
  eventAttendees: (eventId: string) => ["screen", "event-attendees", eventId] as const,
  albumComments: (photoId: string) => ["screen", "album-comments", photoId] as const,
};
