# Performance Verification Checklist

Use release or profile builds for performance measurements. Debug builds are suitable only for functional smoke testing.

## Automated Gates

- Run `npm run check`, `npm run lint`, `npm run format:check:all`, and the complete test suite.
- Run `npm run security:verify:internal` for security or release-hardening changes.
- Run `npm run android:benchmark:startup` on a supported Android device to capture cold, warm, hot, and critical-journey metrics.
- Generate and verify the Android baseline profile with `npm run android:baseline-profile` before release.
- Keep all thresholds in `config/performance-budgets.json`; do not relax them to make a regression pass.

## Startup and Interaction Acceptance

- Cold startup p95: at most 2,500 ms.
- Warm startup p95: at most 1,000 ms.
- First frame p95: at most 700 ms.
- Cached content p95: at most 850 ms.
- Interactive p95: at most 1,200 ms.
- Tap feedback p95: at most 100 ms.
- Navigation response p95: at most 300 ms.
- Splash wait: at most 900 ms; cache restore and warmup must remain bounded and non-blocking.

## Feed and Media Acceptance

- Feed median: at least 55 FPS, with no more than 1% jank.
- Blank area p95: at most 8 px.
- Media cache hit rate: at least 65%.
- Only visible or near-visible media may resolve eagerly; inactive video must remain deferred and paused.
- Offline, poor-network, memory-pressure, and low-power states must suppress speculative image and next-page prefetch.
- Verify that reduced-motion mode removes nonessential tab and modal transitions.

## Projection and SQL Acceptance

- Apply pagination and cursor migrations to staging before measuring.
- Run `supabase/validation/01_hot_path_explain.sql` and `supabase/validation/06_projection_cursor_paths.sql`.
- Projection RPC p95: at most 1,200 ms; p99: at most 2,500 ms.
- Projection response p95: at most 180,000 bytes.
- Keep initial first-fold pages at their intentionally small limits: Home 5, Notifications 15, Profile/Search/Album 12, Relationships/Blocked 20.
- Keep subsequent pages cursor-based at 33 items; never replace the whole list during append.
- Keep Home, Profile, Search, Notifications, follow, block, and status reads projection-first. Compatibility GET reads remain rollback-only.

## Upload Acceptance

- Confirm image preparation concurrency is 2, video preparation concurrency is 1, and media upload concurrency is 2.
- Confirm large uploads resume after interruption and finalized sessions verify checksum, size, and scan state before publication.
- Verify progress remains monotonic, cancellation releases native work, and a failed queue entry exposes retry and cancel actions.

## Device Scenarios

- Measure Home, Profile, Notifications, and Search first meaningful render on a representative low-tier and current device.
- Verify cached return navigation renders immediately while stale data refreshes in the background.
- Verify pull-to-refresh, cursor append, empty, error/retry, offline, expired-session, and long-idle return states.
- Verify no scroll jump, full-screen loading replacement, eager off-screen video, duplicate request, or repeated-tap mutation occurs.
- Verify VoiceOver/TalkBack focus, labels, 48 dp touch targets, dynamic text behavior, and modal focus restoration.

## Load and Telemetry Acceptance

- Run `npm run loadtest:smoke` and, when credentials are available, `npm run loadtest:sustained`.
- Require `http_req_failed < 1%`, projection hot-path p95 below 500 ms, and general HTTP p95 below 1,000 ms.
- Keep auth and projection latency in separate metrics.
- Confirm `*:first-visible`, `*:refresh`, `*:load-more`, cache-path, cache-hit, startup, and warmup-usefulness events are emitted.
- Require warmup usefulness of at least 40%; remove speculative work that does not meet the threshold.
