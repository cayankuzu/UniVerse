import type { QueryClient } from "@tanstack/react-query";
import type { AccountType } from "../contracts/api";
import type { AuthUserData } from "../contracts/entities";

export interface MutationQueueProcessorContext {
  ownerId: string;
  queryClient: QueryClient;
}

export interface UploadQueueProcessorContext {
  accountType: AccountType;
  ownerId: string;
  queryClient: QueryClient;
  updateUserData: (payload: Partial<AuthUserData>) => void;
  userData: AuthUserData;
  viewerKey: string;
}

export interface RegisteredMutationQueueProcessor {
  id: string;
  process: (params: MutationQueueProcessorContext) => Promise<void> | void;
}

export interface RegisteredUploadQueueProcessor {
  id: string;
  process: (params: UploadQueueProcessorContext) => Promise<void> | void;
}
