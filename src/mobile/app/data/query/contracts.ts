export interface CursorPageMeta {
  nextCursor: string | null;
  serverTime: string;
  deltaToken?: string | null;
}

export interface DeltaState {
  serverTime: string | null;
  deltaToken: string | null;
}

export interface ProjectionEnvelope<T> {
  items: T[];
  updatedItems?: T[];
  deletedIds?: string[];
  nextCursor: string | null;
  serverTime: string;
  deltaToken?: string | null;
}

export interface EntityPatch<T> {
  entity: string;
  id: string;
  changes: Partial<T>;
  syncVersion?: number;
}

export interface MutationPatchEnvelope {
  patches: EntityPatch<unknown>[];
  deletedIds?: string[];
  serverTime: string;
}
