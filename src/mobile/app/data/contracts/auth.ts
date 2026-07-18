import type { AccountType } from "./api";

export type PendingVerification = {
  email: string;
  type: AccountType;
  data: unknown;
} | null;
