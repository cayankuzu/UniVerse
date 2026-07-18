import { logError } from "../logging.ts";
import type { ServerRouteDeps } from "../types.ts";

type StorageRemoveClient = {
  remove: (paths: string[]) => Promise<{ error: { message?: string } | null }>;
};

export async function removeStorageObjectsOrQueue(params: {
  adminSupabase: ServerRouteDeps["adminSupabase"];
  objectPaths: string[];
  ownerId: string;
  reason: string;
  storage: StorageRemoveClient;
}) {
  const objectPaths = Array.from(
    new Set(params.objectPaths.map((path) => String(path || "").trim()).filter(Boolean)),
  );
  if (objectPaths.length === 0) return { queued: 0, removed: 0 };

  let removalMessage = "storage_remove_failed";
  try {
    const { error } = await params.storage.remove(objectPaths);
    if (!error) return { queued: 0, removed: objectPaths.length };
    removalMessage = String(error.message || removalMessage);
  } catch (error) {
    removalMessage = String((error as { message?: string })?.message || error || removalMessage);
  }

  const enqueueResults = await Promise.all(
    objectPaths.map((objectPath) =>
      params.adminSupabase.rpc("enqueue_storage_cleanup_job", {
        target_object_path: objectPath,
        target_owner_id: params.ownerId,
        target_reason: params.reason,
      }),
    ),
  );
  const enqueueError = enqueueResults.find((result) => result.error)?.error;
  if (enqueueError) {
    throw new Error(`Storage cleanup could not be queued: ${enqueueError.message}`);
  }
  logError("storage/cleanup", "storage-remove-queued-for-retry", new Error(removalMessage), {
    count: objectPaths.length,
    ownerId: params.ownerId,
    reason: params.reason,
  });
  return { queued: objectPaths.length, removed: 0 };
}
