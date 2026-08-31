import type { ZodType } from "zod";
import {
  registerDirectSchema,
  registerSchema,
  reportSchema,
  uploadSessionCreateSchema,
  uploadSessionIdSchema,
} from "./schemas";

export type AuthPolicy = "none" | "required";
export type RateLimitPolicy = "auth" | "none" | "report" | "upload";

export type RoutePolicy = {
  readonly auth: AuthPolicy;
  readonly bodySchema?: ZodType;
  readonly id: string;
  readonly matcher: RegExp;
  readonly maxBodyBytes: number;
  readonly methods: readonly ("GET" | "POST")[];
  readonly rateLimit: RateLimitPolicy;
  readonly retryGet: boolean;
};

export const ROUTE_POLICIES: readonly RoutePolicy[] = [
  {
    auth: "none",
    id: "health",
    matcher: /^\/health$/,
    maxBodyBytes: 0,
    methods: ["GET"],
    rateLimit: "none",
    retryGet: false,
  },
  {
    auth: "none",
    id: "auth.check-username",
    matcher: /^\/auth\/check-username\/[a-z0-9_]{3,24}$/,
    maxBodyBytes: 0,
    methods: ["GET"],
    rateLimit: "auth",
    retryGet: true,
  },
  {
    auth: "none",
    id: "auth.check-email",
    matcher: /^\/auth\/check-email$/,
    maxBodyBytes: 0,
    methods: ["GET"],
    rateLimit: "auth",
    retryGet: true,
  },
  {
    auth: "none",
    bodySchema: registerDirectSchema,
    id: "auth.register-direct",
    matcher: /^\/auth\/register-direct$/,
    maxBodyBytes: 16_384,
    methods: ["POST"],
    rateLimit: "auth",
    retryGet: false,
  },
  {
    auth: "required",
    bodySchema: registerSchema,
    id: "auth.register",
    matcher: /^\/auth\/register$/,
    maxBodyBytes: 16_384,
    methods: ["POST"],
    rateLimit: "auth",
    retryGet: false,
  },
  {
    auth: "required",
    bodySchema: reportSchema,
    id: "reports.create",
    matcher: /^\/reports$/,
    maxBodyBytes: 4096,
    methods: ["POST"],
    rateLimit: "report",
    retryGet: false,
  },
  {
    auth: "required",
    bodySchema: uploadSessionCreateSchema,
    id: "storage.upload-session.create",
    matcher: /^\/storage\/upload-session\/create$/,
    maxBodyBytes: 16_384,
    methods: ["POST"],
    rateLimit: "upload",
    retryGet: false,
  },
  {
    auth: "required",
    bodySchema: uploadSessionIdSchema,
    id: "storage.upload-session.finalize",
    matcher: /^\/storage\/upload-session\/finalize$/,
    maxBodyBytes: 1024,
    methods: ["POST"],
    rateLimit: "upload",
    retryGet: false,
  },
  {
    auth: "required",
    bodySchema: uploadSessionIdSchema,
    id: "storage.upload-session.cancel",
    matcher: /^\/storage\/upload-session\/cancel$/,
    maxBodyBytes: 1024,
    methods: ["POST"],
    rateLimit: "upload",
    retryGet: false,
  },
] as const;

export function findRoutePolicy(pathname: string): RoutePolicy | null {
  return ROUTE_POLICIES.find((policy) => policy.matcher.test(pathname)) ?? null;
}

export function validateRouteQuery(policy: RoutePolicy, url: URL): void {
  const keys = [...new Set(url.searchParams.keys())];
  if (policy.id === "auth.check-email") {
    if (keys.length !== 1 || keys[0] !== "email") {
      throw new Error("invalid_query");
    }
    const email = String(url.searchParams.get("email") || "")
      .trim()
      .toLowerCase();
    if (email.length < 3 || email.length > 160 || !/^\S+@\S+\.\S+$/.test(email)) {
      throw new Error("invalid_query");
    }
    return;
  }

  if (keys.length > 0) {
    throw new Error("invalid_query");
  }
}
