import type { CommentItem } from "../../contracts/api";
import { timeAgo } from "../../../shared/utils/dateTime";

export function normalizeCommentItem(row: unknown): CommentItem | null {
  if (!row || typeof row !== "object") return null;
  const item = row as Record<string, unknown>;
  const id = String(item.id || "").trim();
  if (!id) return null;
  const username = String(item.username || "").trim();
  const createdAt = String(item.createdAt || item.created_at || new Date().toISOString());
  const parentIdRaw = item.parentId ?? item.parent_id ?? null;
  const text = String(
    item.text || item.body || item.comment || item.content || item.message || "",
  ).trim();

  return {
    id,
    userId: String(item.userId || item.user_id || username || id),
    username: username || "kullanıcı",
    name: String(item.name || item.displayName || username || "Kullanıcı"),
    image: String(item.image || item.profileImage || item.profile_image_path || ""),
    university: String(item.university || ""),
    text,
    parentId:
      parentIdRaw === null || String(parentIdRaw || "").trim() === "" ? null : String(parentIdRaw),
    createdAt,
    time: String(item.time || timeAgo(createdAt)),
    likesCount: Number(item.likesCount || item.likes_count || 0),
    likedByViewer: Boolean(item.likedByViewer ?? item.liked_by_viewer),
  };
}

export async function fetchEventCommentsFromApi(id: string): Promise<CommentItem[]> {
  void id;
  return [];
}
