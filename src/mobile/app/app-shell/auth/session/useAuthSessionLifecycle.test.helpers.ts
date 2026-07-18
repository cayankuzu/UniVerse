import type { Session } from "@supabase/supabase-js";

export function createSession(): Session {
  return {
    access_token: "token-abcdefghijklmnopqrstuvwxyz",
    expires_at: 1_893_456_000,
    expires_in: 3600,
    refresh_token: "refresh-token",
    token_type: "bearer",
    user: {
      app_metadata: {},
      aud: "authenticated",
      created_at: "2026-03-17T00:00:00.000Z",
      email: "alice@example.com",
      id: "user-1",
      role: "authenticated",
      updated_at: "2026-03-17T00:00:00.000Z",
      user_metadata: {
        accountType: "student",
        email: "alice@example.com",
        name: "Alice",
        username: "alice",
      },
    },
  } as Session;
}
