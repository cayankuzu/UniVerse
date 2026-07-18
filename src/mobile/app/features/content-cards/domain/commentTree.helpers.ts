export function collectCommentCascadeIds<T extends { id: string; parentId?: string | null }>(
  items: T[],
  rootId: string,
) {
  const pending = [String(rootId || "").trim()];
  const removedIds = new Set<string>();
  while (pending.length > 0) {
    const currentId = pending.pop() || "";
    if (!currentId || removedIds.has(currentId)) continue;
    removedIds.add(currentId);
    items.forEach((item) => {
      if (String(item.parentId || "").trim() === currentId && !removedIds.has(item.id)) {
        pending.push(item.id);
      }
    });
  }
  return removedIds;
}
