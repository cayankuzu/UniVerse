import type { RelationSnapshot } from "../../../features/content-cards/public/types";
import type { HomeFeedItem } from "../data/homeFeedAdapters";

export function buildHomeRowKey(item: Pick<HomeFeedItem, "id" | "kind">) {
  return `${item.kind}:${item.id}`;
}

export function getHomeRowSignature(item: HomeFeedItem) {
  return item.rowSignature || `${item.kind}:${item.id}:${item.sortDate}`;
}

export function getRelationSignature(relations?: RelationSnapshot) {
  if (!relations) return "";
  return [
    relations.followsClub ? "club" : "no-club",
    relations.clubIsPrivate ? "club-private" : "club-open",
    relations.followsUploader ? "uploader" : "no-uploader",
    relations.uploaderIsPrivate ? "uploader-private" : "uploader-open",
    Array.isArray(relations.followingUsernames) ? relations.followingUsernames.join("|") : "",
  ].join(":");
}
