/**
 * App warmup runtime composition boundary.
 *
 * App shell consumers import the warmup runtime API from here so the shell
 * keeps a single stable entrypoint while the focused warmup modules stay small.
 */

export type { IdleWarmupParams } from "./appWarmupIdleTasks";
export type { WarmupSharedParams } from "./appWarmup.shared";
export { runAppWarmupIdleTasks } from "./appWarmupIdleTasks";
export { seedAppWarmupBundle } from "./appWarmupSeeding";
export { buildImagePrefetchTask } from "./appWarmupImages";
