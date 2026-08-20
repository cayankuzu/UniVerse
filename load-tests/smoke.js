import {
  callOptionalMutationSet,
  callOptionalProjectionSet,
  idle,
  getAccessToken,
  callRpc,
  callRpcWithCursor,
  callTrackedProjection,
  callTrackedProjectionWithCursor,
  createProjectionTracker,
  randomQuery,
  readIntEnv,
  rehearsalProfile,
} from "./common.js";

const profile = rehearsalProfile();
const defaultSmokeVus = profile === "full" ? 5 : 1;
const defaultSmokeIterations = profile === "full" ? 10 : 8;
const thresholds = {
  checks: ["rate>0.99"],
  http_req_failed: ["rate<0.01"],
};
if (profile === "full") {
  thresholds["http_req_duration{request_kind:projection}"] = ["p(95)<800"];
}

export const options = {
  vus: readIntEnv("K6_SMOKE_VUS", defaultSmokeVus),
  iterations: readIntEnv("K6_SMOKE_ITERATIONS", defaultSmokeIterations),
  thresholds,
};
let warmedUp = false;
const homeTracker = createProjectionTracker({ appendEvery: 4, fullRefreshEvery: 4 });
const notificationsTracker = createProjectionTracker({ fullRefreshEvery: 4 });

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
  callRpc(
    token,
    "search_results_projection",
    {
      category_filter: null,
      cursor: null,
      fee_filter: null,
      kind_name: "events",
      limit_count: 12,
      query_text: randomQuery(),
      since: null,
      sort_mode: "newest",
      university_filter: null,
      viewer_id: null,
      visibility_filter: null,
    },
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
  callRpcWithCursor(
    token,
    "search_results_projection",
    {
      category_filter: null,
      cursor: null,
      fee_filter: null,
      kind_name: "events",
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
  callOptionalProjectionSet(token);
  callOptionalMutationSet(token);
  idle(1);
}
