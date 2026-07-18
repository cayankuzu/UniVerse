import { t } from "../../../shared/i18n";
import type { AlbumPhotoWithMeta, EventWithMeta } from "../../../data/contracts/content";
import type { ProfileTab, ProfileTabItem } from "../domain/profileConstants";

export function buildProfileTabs(params: {
  accountType: "student" | "club";
  albumsCount: number;
  eventsCount: number;
}): ProfileTabItem[] {
  return [
    { key: "album", label: t("search.tab.albums"), count: params.albumsCount },
    { key: "events", label: t("search.tab.events"), count: params.eventsCount },
  ];
}

export function resolveProfileTileData(params: {
  tab: ProfileTab;
  albums: AlbumPhotoWithMeta[];
  events: EventWithMeta[];
}) {
  if (params.tab === "album") return params.albums;
  return params.events;
}

export function getProfileEmptyText(tab: ProfileTab, accountType: "student" | "club") {
  if (tab === "album") return t("profile.empty.albums");
  return accountType === "club"
    ? t("profile.empty.events.club")
    : t("profile.empty.events.student");
}
