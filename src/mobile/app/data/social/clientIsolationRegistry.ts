export type BlockedActorIsolationParams = {
  targetUserId?: string | null;
  targetUsername?: string | null;
  viewerKey: string;
};

type BlockedActorIsolationHandler = (params: BlockedActorIsolationParams) => void;

const blockedActorIsolationHandlers = new Set<BlockedActorIsolationHandler>();

export function registerBlockedActorIsolationHandler(handler: BlockedActorIsolationHandler) {
  blockedActorIsolationHandlers.add(handler);
  return () => {
    blockedActorIsolationHandlers.delete(handler);
  };
}

export function runBlockedActorIsolationHandlers(params: BlockedActorIsolationParams) {
  blockedActorIsolationHandlers.forEach((handler) => {
    handler(params);
  });
}
