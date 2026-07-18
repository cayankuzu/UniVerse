export type ViewerKeyIdentity = {
  id?: string | null;
  username?: string | null;
};

export function getViewerKey(identity?: ViewerKeyIdentity | null) {
  const viewerKey = String(identity?.id || identity?.username || "guest")
    .trim()
    .toLowerCase();
  return viewerKey || "guest";
}
