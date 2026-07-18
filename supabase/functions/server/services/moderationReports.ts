import he from "npm:he";
import type { SupabaseClient } from "npm:@supabase/supabase-js";
import {
  deliverModerationReportEmail,
  type ModerationMailDeliveryResult,
} from "./moderationReportDelivery.ts";

export type ReportTargetInsertShape = {
  target_type: "album" | "album_comment" | "event" | "event_comment" | "user";
  target_album_comment_id?: string;
  target_event_comment_id?: string;
  target_event_id?: string;
  target_photo_id?: string;
  target_user_id?: string;
};

export type { ModerationMailDeliveryResult } from "./moderationReportDelivery.ts";

function trimText(value: unknown) {
  return String(value || "").trim();
}

function truncateText(value: unknown, maxLength: number) {
  const normalized = trimText(value);
  if (!normalized || normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

function escapeHtml(value: unknown) {
  return he.escape(String(value || ""));
}

function compactRecord(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, item]) =>
        item !== undefined &&
        item !== null &&
        !(typeof item === "string" && item.trim() === "") &&
        !(Array.isArray(item) && item.length === 0),
    ),
  );
}

function normalizeProfileSnapshot(row: Record<string, unknown> | null) {
  if (!row) return {};
  return compactRecord({
    accountType: trimText(row.account_type),
    bio: truncateText(row.bio, 600),
    categories: Array.isArray(row.categories) ? row.categories : [],
    clubName: trimText(row.club_name),
    coverImagePath: trimText(row.cover_image_path),
    createdAt: trimText(row.created_at),
    department: trimText(row.department),
    description: truncateText(row.description, 800),
    email: trimText(row.email),
    gradeYear: trimText(row.grade_year),
    hideEmail: row.hide_email === true,
    id: trimText(row.user_id),
    isPrivate: row.is_private === true,
    name: trimText(row.name),
    profileImagePath: trimText(row.profile_image_path),
    university: trimText(row.university),
    updatedAt: trimText(row.updated_at),
    username: trimText(row.username),
  });
}

function normalizeEventSnapshot(row: Record<string, unknown> | null) {
  if (!row) return {};
  return compactRecord({
    accessLabel: trimText(row.access_label),
    address: trimText(row.address),
    category: trimText(row.category),
    clubId: trimText(row.club_id),
    coverImagePath: trimText(row.cover_image_path),
    createdAt: trimText(row.created_at),
    description: truncateText(row.description, 1200),
    endsAt: trimText(row.ends_at),
    id: trimText(row.id),
    isCancelled: row.is_cancelled === true,
    locationName: trimText(row.location_name),
    startsAt: trimText(row.starts_at),
    title: trimText(row.title),
    visibility: trimText(row.visibility),
  });
}

function normalizeAlbumSnapshot(row: Record<string, unknown> | null) {
  if (!row) return {};
  return compactRecord({
    caption: truncateText(row.caption, 800),
    createdAt: trimText(row.created_at),
    eventId: trimText(row.event_id),
    id: trimText(row.id),
    mediaPaths: Array.isArray(row.media_paths) ? row.media_paths : [],
    showOnClubProfile: row.show_on_club_profile === true,
    showOnProfile: row.show_on_profile === true,
    showOnUserProfile: row.show_on_user_profile === true,
    storagePath: trimText(row.storage_path),
    title: trimText(row.title),
    uploaderId: trimText(row.user_id),
  });
}

function normalizeCommentSnapshot(row: Record<string, unknown> | null) {
  if (!row) return {};
  return compactRecord({
    body: truncateText(row.body, 1500),
    createdAt: trimText(row.created_at),
    id: trimText(row.id),
    parentId: trimText(row.parent_id),
    updatedAt: trimText(row.updated_at),
    userId: trimText(row.user_id),
  });
}

async function loadProfileRow(adminSupabase: SupabaseClient, userId: string) {
  if (!userId) return null;
  const { data, error } = await adminSupabase
    .from("profiles")
    .select(
      "user_id,username,email,name,club_name,account_type,university,department,grade_year,bio,description,is_private,hide_email,profile_image_path,cover_image_path,categories,created_at,updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data || null) as Record<string, unknown> | null;
}

async function loadEventRow(adminSupabase: SupabaseClient, eventId: string) {
  if (!eventId) return null;
  const { data, error } = await adminSupabase
    .from("events")
    .select(
      "id,club_id,title,description,starts_at,ends_at,location_name,address,category,access_label,visibility,cover_image_path,is_cancelled,created_at",
    )
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data || null) as Record<string, unknown> | null;
}

async function loadAlbumRow(adminSupabase: SupabaseClient, photoId: string) {
  if (!photoId) return null;
  const { data, error } = await adminSupabase
    .from("album_photos")
    .select(
      "id,event_id,user_id,title,caption,storage_path,media_paths,show_on_profile,show_on_user_profile,show_on_club_profile,created_at",
    )
    .eq("id", photoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data || null) as Record<string, unknown> | null;
}

async function loadEventCommentRow(adminSupabase: SupabaseClient, commentId: string) {
  if (!commentId) return null;
  const { data, error } = await adminSupabase
    .from("event_comments")
    .select("id,event_id,user_id,parent_id,body,created_at,updated_at")
    .eq("id", commentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data || null) as Record<string, unknown> | null;
}

async function loadAlbumCommentRow(adminSupabase: SupabaseClient, commentId: string) {
  if (!commentId) return null;
  const { data, error } = await adminSupabase
    .from("album_photo_comments")
    .select("id,photo_id,user_id,parent_id,body,created_at,updated_at")
    .eq("id", commentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data || null) as Record<string, unknown> | null;
}

function renderSectionHtml(title: string, value: unknown) {
  return [
    `<h2 style="margin:24px 0 8px;font-size:16px;color:#0f172a;">${escapeHtml(title)}</h2>`,
    `<pre style="margin:0;padding:14px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.6;color:#0f172a;">${escapeHtml(JSON.stringify(value, null, 2))}</pre>`,
  ].join("");
}

function buildModerationMailSubject(params: {
  reportId: string;
  targetSnapshot: Record<string, unknown>;
  targetType: ReportTargetInsertShape["target_type"];
}) {
  const targetLabel = {
    album: "album",
    album_comment: "album yorumu",
    event: "etkinlik",
    event_comment: "etkinlik yorumu",
    user: "profil",
  }[params.targetType];
  const username =
    trimText((params.targetSnapshot.profile as Record<string, unknown> | undefined)?.username) ||
    trimText((params.targetSnapshot.owner as Record<string, unknown> | undefined)?.username) ||
    trimText((params.targetSnapshot.uploader as Record<string, unknown> | undefined)?.username) ||
    trimText((params.targetSnapshot.author as Record<string, unknown> | undefined)?.username);
  const title =
    trimText((params.targetSnapshot.event as Record<string, unknown> | undefined)?.title) ||
    trimText((params.targetSnapshot.album as Record<string, unknown> | undefined)?.title);
  const suffix = username || title || params.reportId;
  return `[UniVerse] Yeni ${targetLabel} sikayeti - ${suffix}`;
}

export async function buildModerationReportSnapshots(params: {
  adminSupabase: SupabaseClient;
  reportTarget: ReportTargetInsertShape;
  reporterId: string;
  targetUsernameHint?: string;
}) {
  const reporterRow = await loadProfileRow(params.adminSupabase, params.reporterId);
  const reporterSnapshot = {
    profile: normalizeProfileSnapshot(reporterRow),
  };

  if (params.reportTarget.target_type === "user") {
    const targetRow = await loadProfileRow(
      params.adminSupabase,
      trimText(params.reportTarget.target_user_id),
    );
    return {
      reporterSnapshot,
      targetSnapshot: compactRecord({
        profile: {
          ...normalizeProfileSnapshot(targetRow),
          ...(params.targetUsernameHint ? { usernameHint: params.targetUsernameHint } : {}),
        },
        targetType: "user",
      }),
    };
  }

  if (params.reportTarget.target_type === "event") {
    const eventRow = await loadEventRow(
      params.adminSupabase,
      trimText(params.reportTarget.target_event_id),
    );
    const ownerRow = await loadProfileRow(params.adminSupabase, trimText(eventRow?.club_id));
    return {
      reporterSnapshot,
      targetSnapshot: compactRecord({
        event: normalizeEventSnapshot(eventRow),
        owner: normalizeProfileSnapshot(ownerRow),
        targetType: "event",
      }),
    };
  }

  if (params.reportTarget.target_type === "album") {
    const albumRow = await loadAlbumRow(
      params.adminSupabase,
      trimText(params.reportTarget.target_photo_id),
    );
    const [eventRow, uploaderRow] = await Promise.all([
      loadEventRow(params.adminSupabase, trimText(albumRow?.event_id)),
      loadProfileRow(params.adminSupabase, trimText(albumRow?.user_id)),
    ]);
    return {
      reporterSnapshot,
      targetSnapshot: compactRecord({
        album: normalizeAlbumSnapshot(albumRow),
        event: normalizeEventSnapshot(eventRow),
        targetType: "album",
        uploader: normalizeProfileSnapshot(uploaderRow),
      }),
    };
  }

  if (params.reportTarget.target_type === "event_comment") {
    const commentRow = await loadEventCommentRow(
      params.adminSupabase,
      trimText(params.reportTarget.target_event_comment_id),
    );
    const [authorRow, eventRow] = await Promise.all([
      loadProfileRow(params.adminSupabase, trimText(commentRow?.user_id)),
      loadEventRow(params.adminSupabase, trimText(commentRow?.event_id)),
    ]);
    return {
      reporterSnapshot,
      targetSnapshot: compactRecord({
        author: normalizeProfileSnapshot(authorRow),
        comment: normalizeCommentSnapshot(commentRow),
        event: normalizeEventSnapshot(eventRow),
        targetType: "event_comment",
      }),
    };
  }

  const commentRow = await loadAlbumCommentRow(
    params.adminSupabase,
    trimText(params.reportTarget.target_album_comment_id),
  );
  const albumRow = await loadAlbumRow(params.adminSupabase, trimText(commentRow?.photo_id));
  const [authorRow, eventRow] = await Promise.all([
    loadProfileRow(params.adminSupabase, trimText(commentRow?.user_id)),
    loadEventRow(params.adminSupabase, trimText(albumRow?.event_id)),
  ]);
  return {
    reporterSnapshot,
    targetSnapshot: compactRecord({
      album: normalizeAlbumSnapshot(albumRow),
      author: normalizeProfileSnapshot(authorRow),
      comment: normalizeCommentSnapshot(commentRow),
      event: normalizeEventSnapshot(eventRow),
      targetType: "album_comment",
    }),
  };
}

export async function sendModerationReportEmail(params: {
  detail?: string | null;
  reason: string;
  reportId: string;
  reporterSnapshot: Record<string, unknown>;
  targetSnapshot: Record<string, unknown>;
  targetType: ReportTargetInsertShape["target_type"];
}): Promise<ModerationMailDeliveryResult> {
  const subject = buildModerationMailSubject({
    reportId: params.reportId,
    targetSnapshot: params.targetSnapshot,
    targetType: params.targetType,
  });
  const submittedDetail = truncateText(params.detail, 4000) || "Yok";
  const reporterEmail = trimText(
    (params.reporterSnapshot.profile as Record<string, unknown> | undefined)?.email,
  );
  const textContent = [
    "UniVerse moderation report",
    `Report ID: ${params.reportId}`,
    `Target Type: ${params.targetType}`,
    `Reason: ${params.reason}`,
    "",
    "User supplied detail:",
    submittedDetail,
    "",
    "Reporter snapshot:",
    JSON.stringify(params.reporterSnapshot, null, 2),
    "",
    "Target snapshot:",
    JSON.stringify(params.targetSnapshot, null, 2),
  ].join("\n");
  const htmlContent = [
    '<div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">',
    '<div style="max-width:840px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:24px;">',
    '<div style="margin-bottom:20px;">',
    '<div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#475569;">UniVerse moderation report</div>',
    `<h1 style="margin:8px 0 4px;font-size:24px;line-height:1.3;">${escapeHtml(subject)}</h1>`,
    `<p style="margin:0;color:#475569;font-size:14px;">Report ID: <strong>${escapeHtml(params.reportId)}</strong> | Target: <strong>${escapeHtml(params.targetType)}</strong></p>`,
    "</div>",
    '<div style="padding:16px;border-radius:14px;background:#fff7ed;border:1px solid #fdba74;">',
    `<div style="font-size:13px;color:#9a3412;font-weight:700;margin-bottom:6px;">Reason</div><div style="font-size:15px;color:#7c2d12;">${escapeHtml(params.reason)}</div>`,
    '<div style="font-size:13px;color:#9a3412;font-weight:700;margin:14px 0 6px;">User supplied detail</div>',
    `<div style="font-size:14px;color:#7c2d12;white-space:pre-wrap;">${escapeHtml(submittedDetail)}</div>`,
    "</div>",
    renderSectionHtml("Reporter snapshot", params.reporterSnapshot),
    renderSectionHtml("Target snapshot", params.targetSnapshot),
    "</div>",
    "</div>",
  ].join("");

  return deliverModerationReportEmail({
    htmlContent,
    reportId: params.reportId,
    reporterEmail,
    subject,
    targetType: params.targetType,
    textContent,
  });
}
