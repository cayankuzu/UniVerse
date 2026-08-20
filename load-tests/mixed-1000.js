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
  readJsonEnv,
  rehearsalProfile,
} from "./common.js";

const profile = rehearsalProfile();
const defaultHomeStages =
  profile === "full"
    ? [
        { duration: "2m", target: 300 },
        { duration: "3m", target: 700 },
        { duration: "5m", target: 1000 },
        { duration: "2m", target: 0 },
      ]
    : [
        { duration: "12s", target: 3 },
        { duration: "16s", target: 6 },
        { duration: "18s", target: 8 },
        { duration: "12s", target: 0 },
      ];
const homeStages = readJsonEnv("K6_MIXED_HOME_STAGES_JSON", defaultHomeStages);

export const options = {
  scenarios: {
    mixed_home: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: homeStages,
      exec: "homeScenario",
    },
    mixed_notifications: {
      executor: "constant-vus",
      vus: readIntEnv("K6_MIXED_NOTIFICATIONS_VUS", profile === "full" ? 150 : 3),
      duration: readDurationEnv(
        "K6_MIXED_NOTIFICATIONS_DURATION",
        profile === "full" ? "10m" : "45s",
      ),
      exec: "notificationScenario",
    },
    mixed_search: {
      executor: "constant-vus",
      vus: readIntEnv("K6_MIXED_SEARCH_VUS", profile === "full" ? 150 : 3),
      duration: readDurationEnv("K6_MIXED_SEARCH_DURATION", profile === "full" ? "10m" : "45s"),
      exec: "searchScenario",
    },
  },
  thresholds: {
    checks: ["rate>0.99"],
    http_req_failed: ["rate<0.01"],
    "http_req_duration{request_kind:projection}": ["p(95)<1000", "p(99)<1500"],
  },
};
let homeWarmedUp = false;
let notificationWarmedUp = false;
let searchWarmedUp = false;
const homeTracker = createProjectionTracker({ appendEvery: 4, fullRefreshEvery: 10 });
const notificationsTracker = createProjectionTracker({ fullRefreshEvery: 8 });

function warmupHome(token) {
  if (homeWarmedUp) return;
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
  homeWarmedUp = true;
}

function warmupNotifications(token) {
  if (notificationWarmedUp) return;
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
  notificationWarmedUp = true;
}

function warmupSearch(token) {
  if (searchWarmedUp) return;
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
  searchWarmedUp = true;
}

export function homeScenario() {
  const token = getAccessToken();
  warmupHome(token);
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
  callRpc(token, "home_feed_projection", {
    cursor: null,
    entity_filter: "all",
    limit_count: 12,
    since: null,
    sort_mode: "oldest",
    source_filter: "all",
    type_filter: "all",
    viewer_id: null,
  });
  callOptionalProjectionSet(token);
  idle(1);
}

export function notificationScenario() {
  const token = getAccessToken();
  warmupNotifications(token);
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
  callRpc(token, "notification_badge_projection", {
    since: null,
    viewer_id: null,
  });
  callOptionalMutationSet(token);
  idle(1);
}

export function searchScenario() {
  const token = getAccessToken();
  warmupSearch(token);
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
  idle(1);
}
