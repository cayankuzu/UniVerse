import {
  callOptionalMutationSet,
  callOptionalProjectionSet,
  callRpc,
  callRpcWithCursor,
  callTrackedProjection,
  callTrackedProjectionWithCursor,
  createProjectionTracker,
  idle,
  randomQuery,
  getAccessToken,
  readDurationEnv,
  readIntEnv,
  rehearsalProfile,
} from "./common.js";

const profile = rehearsalProfile();
const defaultVus = profile === "full" ? 300 : 3;
const defaultDuration = profile === "full" ? "5m" : "20s";
const projectionP95ThresholdMs = profile === "full" ? 900 : 1500;

export const options = {
  scenarios: {
    sustained_users: {
      executor: "constant-vus",
      vus: readIntEnv("K6_SUSTAINED_VUS", defaultVus),
      duration: readDurationEnv("K6_SUSTAINED_DURATION", defaultDuration),
    },
  },
  thresholds: {
    checks: ["rate>0.99"],
    http_req_failed: ["rate<0.01"],
    "http_req_duration{request_kind:projection}": [`p(95)<${projectionP95ThresholdMs}`],
  },
};
let warmedUp = false;
const homeTracker = createProjectionTracker({ appendEvery: 4, fullRefreshEvery: 10 });
const notificationsTracker = createProjectionTracker({ fullRefreshEvery: 8 });

function ensureWarmup(token) {
  if (warmedUp) return;
  callTrackedProjection(
    token,
    "home_feed_projection",
    {
      cursor: null,
      entity_filter: "all",
      limit_count: 12,
      since: null,
      sort_mode: "newest",
      source_filter: "all",
      type_filter: "all",
      viewer_id: null,
    },
    homeTracker,
    {
      tags: {
        request_kind: "warmup",
      },
    },
  );
  callTrackedProjection(
    token,
    "notifications_projection",
    {
      cursor: null,
      filter_name: "all",
      limit_count: 15,
      since: null,
      viewer_id: null,
    },
    notificationsTracker,
    {
      tags: {
        request_kind: "warmup",
      },
    },
  );
  warmedUp = true;
}

export default function () {
  const token = getAccessToken();
  ensureWarmup(token);
  callTrackedProjectionWithCursor(
    token,
    "home_feed_projection",
    {
      cursor: null,
      entity_filter: "all",
      limit_count: 12,
      since: null,
      sort_mode: "newest",
      source_filter: "all",
      type_filter: "all",
      viewer_id: null,
    },
    homeTracker,
  );
  if (__ENV.K6_PROFILE_USERNAME) {
    callRpc(token, "profile_overview_projection", {
      since: null,
      target_username: __ENV.K6_PROFILE_USERNAME || "",
      viewer_id: null,
    });
  }
  callRpcWithCursor(
    token,
    "search_results_projection",
    {
      category_filter: null,
      cursor: null,
      fee_filter: null,
      kind_name: "clubs",
      limit_count: 12,
      query_text: randomQuery(),
      since: null,
      sort_mode: "newest",
      university_filter: null,
      viewer_id: null,
      visibility_filter: null,
    },
    { append: true },
  );
  callTrackedProjection(
    token,
    "notifications_projection",
    {
      cursor: null,
      filter_name: "all",
      limit_count: 15,
      since: null,
      viewer_id: null,
    },
    notificationsTracker,
  );
  callOptionalProjectionSet(token);
  callOptionalMutationSet(token);
  idle(1);
}
