import type { CommentItem, LikeResponse, SearchUserResult } from "../../contracts/api";
import { post } from "../../../platform/api/core";
import { startObservedTimer } from "../../../platform/observability";
import { supabase } from "../../../platform/supabase";
import { createClientMutationId } from "../../mutations/clientMutation";
import { toDisplayName } from "../../profile/profileDisplay";
import {
  filterBlockedComments,
  filterBlockedSearchUsers,
  filterBlockedUserIds,
  loadViewerBlockedVisibility,
} from "../../social/blockedVisibility";
import { formatAbsoluteDateTime, timeAgo } from "../../../shared/utils/dateTime";
import { buildHiddenLikeUser, mapFollowUser } from "../events/events.models";
import { triggerPushDispatchWakeup } from "../../notifications/pushDispatchWakeup";

// ---------------------------------------------------------------------------
// Configuration types
// ---------------------------------------------------------------------------

type CommentRow = {
  body: string;
  created_at: string;
  id: string;
  parent_id: string | null;
  user_id: string;
};

export interface CommentTableConfig {
  /** Table storing comments, e.g. "event_comments" or "album_photo_comments" */
  commentsTable: string;
  /** Foreign key column in the comments table, e.g. "event_id" or "photo_id" */
  foreignKeyColumn: string;
  /** Table storing comment likes */
  commentLikesTable: string;
  /** RPC name for creating a comment with patch */
  createCommentRpc: string;
  /** RPC parameter name for the target id, e.g. "target_event_id" or "target_photo_id" */
  createCommentTargetParam: string;
  /** RPC name for setting a comment like */
  setCommentLikeRpc: string;
  /** REST endpoint prefix for fallback, e.g. "/events" or "/albums" */
  restEndpointPrefix: string;
  /** Telemetry target label for comments, e.g. "event-comment" or "album-comment" */
  commentTelemetryTarget: string;
  /** Telemetry target label for comment likes, e.g. "event-comment-like" or "album-comment-like" */
  commentLikeTelemetryTarget: string;
  /** Client mutation id prefix for comments */
  commentMutationPrefix: string;
  /** Client mutation id prefix for comment likes */
  commentLikeMutationPrefix: string;
  /** Assertion function to check if comment creation is allowed */
  assertCommentCreateAllowed: (
    targetId: string,
    parentId: string | null | undefined,
    viewerIdHint: string,
  ) => Promise<unknown>;
  /** Assertion function to check if comment like is allowed */
  assertCommentLikeAllowed: (params: {
    commentId: string;
    viewerIdHint?: string | null;
  }) => Promise<unknown>;
  /** Fallback function to fetch comments from API when DB query fails */
  fetchCommentsFromApiFallback: (targetId: string) => Promise<CommentItem[]>;
}

// ---------------------------------------------------------------------------
// Shared implementations
// ---------------------------------------------------------------------------

export async function loadCommentLikeState(
  config: Pick<CommentTableConfig, "commentLikesTable">,
  commentIds: string[],
  viewerId: string | null,
) {
  const counts = new Map<string, number>();
  const likedByViewer = new Set<string>();
  if (commentIds.length === 0) return { counts, likedByViewer };

  const { data, error } = await supabase
    .from(config.commentLikesTable)
    .select("comment_id,user_id")
    .in("comment_id", commentIds);

  if (error || !Array.isArray(data)) return { counts, likedByViewer };

  (data as Array<{ comment_id: string; user_id: string }>).forEach((row) => {
    const commentId = String(row.comment_id || "").trim();
    const userId = String(row.user_id || "").trim();
    if (!commentId) return;
    counts.set(commentId, (counts.get(commentId) || 0) + 1);
    if (viewerId && userId === viewerId) likedByViewer.add(commentId);
  });

  return { counts, likedByViewer };
}

export async function getComments(
  config: CommentTableConfig,
  targetId: string,
  viewerIdOverride?: string | null,
): Promise<CommentItem[]> {
  let viewerId = String(viewerIdOverride || "").trim() || null;
  if (!viewerId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    viewerId = user?.id || null;
  }
  const blockedVisibility = await loadViewerBlockedVisibility(viewerId);
  const { data: rows, error } = await supabase
    .from(config.commentsTable)
    .select("id,user_id,parent_id,body,created_at")
    .eq(config.foreignKeyColumn, targetId)
    .order("created_at", { ascending: true });

  if (!error && rows) {
    const typedRows = rows as unknown as CommentRow[];
    const visibleRows = typedRows.filter(
      (row) => !blockedVisibility.blockedIds.has(String(row.user_id || "").trim()),
    );
    const userIds = filterBlockedUserIds(
      visibleRows.map((row) => row.user_id),
      blockedVisibility,
    );
    const commentIds = visibleRows.map((row) => String(row.id || "").trim()).filter(Boolean);
    const [{ counts, likedByViewer }, { data: profiles }] = await Promise.all([
      loadCommentLikeState(config, commentIds, viewerId),
      userIds.length
        ? supabase
            .from("profiles")
            .select("user_id,username,name,club_name,profile_image_path,university")
            .in("user_id", userIds)
        : Promise.resolve({
            data: [] as Array<{
              user_id: string;
              username: string;
              name: string;
              club_name: string;
              profile_image_path: string;
              university: string;
            }>,
          }),
    ]);

    const profileMap = new Map(
      (profiles || []).map((profile) => [(profile as { user_id: string }).user_id, profile]),
    );
    return filterBlockedComments(
      visibleRows.map((row) => {
        const profile = profileMap.get(row.user_id) as Record<string, unknown> | undefined;
        return {
          id: row.id,
          userId: row.user_id,
          username: (profile?.username as string) || "kullanıcı",
          name: profile ? toDisplayName(profile) : "Kullanıcı",
          image: (profile?.profile_image_path as string) || "",
          university: (profile?.university as string) || "",
          text: row.body,
          parentId: row.parent_id,
          createdAt: row.created_at,
          time: timeAgo(row.created_at),
          likesCount: counts.get(String(row.id || "").trim()) || 0,
          likedByViewer: likedByViewer.has(String(row.id || "").trim()),
        } satisfies CommentItem;
      }),
      blockedVisibility,
    );
  }

  return filterBlockedComments(
    await config.fetchCommentsFromApiFallback(targetId),
    blockedVisibility,
  );
}

export async function addComment(
  config: CommentTableConfig,
  targetId: string,
  text: string,
  parentId?: string | null,
  options?: { clientMutationId?: string | null },
): Promise<CommentItem> {
  const stopTelemetry = startObservedTimer({
    category: "mutation",
    meta: { targetId, target: config.commentTelemetryTarget },
    name: `${config.commentTelemetryTarget}-create`,
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    stopTelemetry("error", { reason: "unauthorized" });
    throw new Error("Unauthorized");
  }
  await config.assertCommentCreateAllowed(targetId, parentId, user.id);
  const clientMutationId =
    options?.clientMutationId || createClientMutationId(config.commentMutationPrefix);

  const { data, error } = await supabase.rpc(config.createCommentRpc, {
    client_mutation_id: clientMutationId,
    comment_body: text,
    parent_comment_id: parentId || null,
    [config.createCommentTargetParam]: targetId,
  });

  if (!error && data) {
    const row = data as {
      body?: string | null;
      created_at?: string | null;
      id?: string | null;
      parent_id?: string | null;
      user_id?: string | null;
    };
    const { data: profile } = await supabase
      .from("profiles")
      .select("username,name,club_name,profile_image_path,university")
      .eq("user_id", user.id)
      .maybeSingle();

    const nextComment = {
      id: String(row.id || ""),
      userId: String(row.user_id || user.id),
      username: profile?.username || "kullanıcı",
      name: profile ? toDisplayName(profile) : "Kullanıcı",
      image: profile?.profile_image_path || "",
      university: profile?.university || "",
      text: String(row.body || ""),
      parentId: row.parent_id ? String(row.parent_id) : null,
      createdAt: String(row.created_at || new Date().toISOString()),
      time:
        formatAbsoluteDateTime(String(row.created_at || new Date().toISOString())) ||
        "Tarih bilinmiyor",
      likesCount: 0,
      likedByViewer: false,
    };
    triggerPushDispatchWakeup(`${config.commentTelemetryTarget}-create`);
    stopTelemetry("ok", { source: "rpc" });
    return nextComment;
  }

  try {
    const nextComment = await post<CommentItem>(
      `${config.restEndpointPrefix}/${targetId}/comments`,
      {
        clientMutationId,
        parentId: parentId || null,
        text,
      },
    );
    triggerPushDispatchWakeup(`${config.commentTelemetryTarget}-create`);
    stopTelemetry("ok", { source: "edge" });
    return nextComment;
  } catch (error) {
    stopTelemetry("error", {
      message: String((error as { message?: string })?.message || error || ""),
      source: "edge",
    });
    throw error;
  }
}

export async function toggleCommentLike(
  config: CommentTableConfig,
  commentId: string,
  options?: {
    clientMutationId?: string | null;
    desiredLiked?: boolean | null;
  },
): Promise<LikeResponse> {
  const stopTelemetry = startObservedTimer({
    category: "mutation",
    meta: { commentId, target: config.commentLikeTelemetryTarget },
    name: `${config.commentLikeTelemetryTarget}-toggle`,
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    stopTelemetry("error", { reason: "unauthorized" });
    throw new Error("Unauthorized");
  }
  await config.assertCommentLikeAllowed({
    commentId,
    viewerIdHint: user.id,
  });

  const desiredLiked = typeof options?.desiredLiked === "boolean" ? options.desiredLiked : true;
  const clientMutationId =
    options?.clientMutationId || createClientMutationId(config.commentLikeMutationPrefix);

  const { data, error } = await supabase.rpc(config.setCommentLikeRpc, {
    client_mutation_id: clientMutationId,
    desired_liked: desiredLiked,
    target_comment_id: commentId,
  });

  if (!error) {
    const row = Array.isArray(data) ? data[0] : data;
    const result = {
      count: Number((row as Record<string, unknown> | null)?.likes_count || 0),
      liked: Boolean((row as Record<string, unknown> | null)?.liked),
    };
    triggerPushDispatchWakeup(`${config.commentLikeTelemetryTarget}-toggle`);
    stopTelemetry("ok", { liked: result.liked, source: "rpc" });
    return result;
  }

  stopTelemetry("error", { source: "rpc", message: error.message });
  throw error;
}

export async function getFilteredLikeUsers(params: {
  column: string;
  relationTable: string;
  targetId: string;
}): Promise<SearchUserResult[]> {
  const blockedVisibility = await loadViewerBlockedVisibility();
  const { data: likes, error } = await supabase
    .from(params.relationTable)
    .select("user_id")
    .eq(params.column, params.targetId);

  if (error || !Array.isArray(likes)) return [];

  const userIds = filterBlockedUserIds(
    (likes as Array<{ user_id: string }>).map((item) => String(item.user_id || "").trim()),
    blockedVisibility,
  );
  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "user_id,username,name,club_name,profile_image_path,cover_image_path,university,is_private,department,grade_year,categories,description,account_type,bio",
    )
    .in("user_id", userIds);

  const mappedProfiles = filterBlockedSearchUsers(
    ((profiles || []) as unknown[]).map((profile) =>
      mapFollowUser(profile as Record<string, unknown>),
    ) as SearchUserResult[],
    blockedVisibility,
  );
  if (mappedProfiles.length >= userIds.length) return mappedProfiles;

  const visibleIds = new Set(mappedProfiles.map((profile) => profile.id));
  const hiddenUsers = userIds
    .filter((userId) => !visibleIds.has(userId))
    .map((userId, index) => buildHiddenLikeUser(userId, index));
  return [...mappedProfiles, ...hiddenUsers];
}
