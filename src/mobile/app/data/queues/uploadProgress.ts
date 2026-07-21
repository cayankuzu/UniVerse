const UPLOAD_PROGRESS_PAYLOAD_KEY = "__uploadProgress";

export type UploadProgressTarget =
  | {
      eventId: string;
      kind: "album-view";
    }
  | {
      kind: "event-feed";
    }
  | {
      kind: "profile";
    };

export type UploadProgressState = {
  hint?: string;
  percent: number;
  stage: string;
  target?: UploadProgressTarget;
  title: string;
};

function clampUploadPercent(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeUploadProgressText(value: unknown, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function isUploadProgressTarget(value: unknown): value is UploadProgressTarget {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { eventId?: unknown; kind?: unknown };
  if (candidate.kind === "album-view") {
    return normalizeUploadProgressText(candidate.eventId).length > 0;
  }
  return candidate.kind === "event-feed" || candidate.kind === "profile";
}

export function readUploadProgress(
  payload: Record<string, unknown> | null | undefined,
): UploadProgressState | null {
  const rawValue = payload?.[UPLOAD_PROGRESS_PAYLOAD_KEY];
  if (!rawValue || typeof rawValue !== "object") return null;

  const candidate = rawValue as Partial<UploadProgressState>;
  const title = normalizeUploadProgressText(candidate.title);
  const stage = normalizeUploadProgressText(candidate.stage);
  if (!title || !stage) return null;

  return {
    hint: normalizeUploadProgressText(candidate.hint) || undefined,
    percent: clampUploadPercent(candidate.percent),
    stage,
    target: isUploadProgressTarget(candidate.target) ? candidate.target : undefined,
    title,
  };
}

export function writeUploadProgress(
  payload: Record<string, unknown>,
  patch: Partial<UploadProgressState>,
) {
  const current = readUploadProgress(payload);
  const nextState: UploadProgressState = {
    hint: normalizeUploadProgressText(patch.hint, current?.hint || "") || undefined,
    percent: clampUploadPercent(patch.percent ?? current?.percent ?? 0),
    stage: normalizeUploadProgressText(patch.stage, current?.stage || ""),
    target: patch.target ?? current?.target,
    title: normalizeUploadProgressText(patch.title, current?.title || ""),
  };

  return {
    ...payload,
    [UPLOAD_PROGRESS_PAYLOAD_KEY]: nextState,
  };
}

export function createAlbumUploadProgress(eventId: string): UploadProgressState {
  return {
    hint: "Uygulamayi kullanmaya devam edebilirsin; kapanirsa sonraki acilista surer.",
    percent: 5,
    stage: "Sıraya alındı",
    target: {
      eventId,
      kind: "album-view",
    },
    title: "Album karti paylasiliyor",
  };
}

export function createEventCreateProgress(): UploadProgressState {
  return {
    hint: "Uygulamayi kullanmaya devam edebilirsin; kapanirsa sonraki acilista surer.",
    percent: 5,
    stage: "Sıraya alındı",
    target: {
      kind: "event-feed",
    },
    title: "Etkinlik paylasiliyor",
  };
}
