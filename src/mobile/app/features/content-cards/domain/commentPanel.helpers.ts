type OptimisticCommentAuthor = {
  clubName?: string;
  id?: string;
  name?: string;
  profileImage?: string;
  university?: string;
  username?: string;
};

type CommentLikeable = {
  like_count?: unknown;
  likesCount?: unknown;
};

type CommentTreeItem = {
  createdAt: string;
  id: string;
  image: string;
  likedByViewer?: boolean;
  likesCount?: number;
  name: string;
  parentId: string | null;
  text: string;
  time: string;
  university?: string;
  userId: string;
  username: string;
};

export function normalizeParentId(parentId: string | null | undefined): string | null {
  const raw = String(parentId ?? "").trim();
  if (!raw) return null;
  const lowered = raw.toLowerCase();
  if (lowered === "null" || lowered === "undefined") return null;
  return raw;
}

export function getCommentLikeCount(comment: CommentLikeable): number {
  const raw = comment.likesCount ?? comment.like_count;
  const count = Number(raw ?? 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

export function normalizeComments<T extends { parentId?: string | null }>(comments: T[]) {
  return comments.map((item) => ({
    ...item,
    parentId: normalizeParentId(item.parentId),
  }));
}

export function buildOptimisticComment(params: {
  parentId: string | null;
  text: string;
  user: OptimisticCommentAuthor;
}): CommentTreeItem {
  const createdAt = new Date().toISOString();
  return {
    createdAt,
    id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    image: params.user.profileImage || "",
    likedByViewer: false,
    likesCount: 0,
    name: params.user.name || params.user.clubName || params.user.username || "Kullanıcı",
    parentId: normalizeParentId(params.parentId),
    text: params.text,
    time: formatAbsoluteDateTime(createdAt) || "Tarih bilinmiyor",
    university: params.user.university || "",
    userId: params.user.id || params.user.username || "",
    username: params.user.username || "",
  };
}

export function buildRepliesByParentId<T extends { id: string; parentId?: string | null }>(
  comments: T[],
) {
  const grouped = new Map<string, T[]>();
  for (const item of comments) {
    const parentId = normalizeParentId(item.parentId);
    if (!parentId) continue;
    const bucket = grouped.get(parentId);
    if (bucket) bucket.push(item);
    else grouped.set(parentId, [item]);
  }
  return grouped;
}
import { formatAbsoluteDateTime } from "../../../shared/utils/dateTime";
