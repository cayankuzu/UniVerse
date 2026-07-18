import { useCallback, useEffect, useRef } from "react";
import { logScreenView, startObservedTimer } from "../../../platform/observability";
import { scheduleAfterInteractions } from "../../../shared/utils/scheduleAfterInteractions";
import { resolveProjectionPerformanceBudget, type ProjectionSurface } from "../performanceBudget";

type ScreenRefreshLane = "background" | "critical";

export interface ScreenRefreshTask {
  bestEffort?: boolean;
  id: string;
  lane?: ScreenRefreshLane;
  run: () => Promise<unknown> | unknown;
}

interface UseScreenRefreshOptions {
  enabled?: boolean;
  maxParallel?: number;
  screenKey: string;
  surface?: ProjectionSurface;
  tasks: ScreenRefreshTask[];
}

async function runRefreshLane(params: {
  lane: ScreenRefreshLane;
  maxParallel: number;
  tasks: ScreenRefreshTask[];
}) {
  const failures: Array<{ error: unknown; taskId: string }> = [];
  const workerCount = Math.max(1, Math.min(params.maxParallel, params.tasks.length));
  let cursor = 0;

  const runNext = async () => {
    while (cursor < params.tasks.length) {
      const taskIndex = cursor;
      cursor += 1;
      const task = params.tasks[taskIndex];
      try {
        await task.run();
      } catch (error) {
        failures.push({ error, taskId: task.id });
        if (params.lane === "critical" && !task.bestEffort) {
          throw error;
        }
      }
    }
  };

  if (!params.tasks.length) {
    return failures;
  }

  await Promise.all(Array.from({ length: workerCount }, () => runNext()));
  return failures;
}

export function useScreenRefresh({
  enabled = true,
  maxParallel,
  screenKey,
  surface,
  tasks,
}: UseScreenRefreshOptions) {
  const tasksRef = useRef(tasks);
  const backgroundScheduleRef = useRef<{ cancel: () => void } | null>(null);
  const inFlightRefreshRef = useRef<Promise<void> | null>(null);
  const projectionBudget = surface ? resolveProjectionPerformanceBudget(surface) : null;
  const resolvedMaxParallel = maxParallel ?? projectionBudget?.refreshMaxParallel ?? 2;
  const backgroundDelayMs = projectionBudget?.refreshBackgroundDelayMs ?? 120;

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(
    () => () => {
      backgroundScheduleRef.current?.cancel();
      backgroundScheduleRef.current = null;
    },
    [],
  );

  return useCallback(() => {
    if (!enabled) return Promise.resolve();
    backgroundScheduleRef.current?.cancel();
    backgroundScheduleRef.current = null;
    if (inFlightRefreshRef.current) {
      return inFlightRefreshRef.current;
    }
    const activeTasks = tasksRef.current.filter((task) => typeof task.run === "function");
    if (!activeTasks.length) return Promise.resolve();
    const criticalTasks = activeTasks.filter((task) => (task.lane || "critical") === "critical");
    const backgroundTasks = activeTasks.filter((task) => task.lane === "background");
    if (!criticalTasks.length && !backgroundTasks.length) return Promise.resolve();
    const startedAt = Date.now();

    const stopTelemetry = startObservedTimer({
      category: "screen",
      meta: {
        backgroundTaskCount: backgroundTasks.length,
        taskCount: criticalTasks.length,
      },
      name: `${screenKey}:refresh`,
      screenKey,
    });

    const runBackgroundLane = () => {
      if (backgroundTasks.length === 0) return;
      const backgroundStopTelemetry = startObservedTimer({
        category: "screen",
        meta: {
          delayMs: backgroundDelayMs,
          lane: "background",
          taskCount: backgroundTasks.length,
        },
        name: `${screenKey}:refresh:background`,
        screenKey,
      });
      backgroundScheduleRef.current?.cancel();
      backgroundScheduleRef.current = scheduleAfterInteractions(() => {
        void Promise.resolve()
          .then(() =>
            runRefreshLane({
              lane: "background",
              maxParallel: resolvedMaxParallel,
              tasks: backgroundTasks,
            }),
          )
          .then((backgroundFailures) => {
            backgroundStopTelemetry(backgroundFailures.length > 0 ? "rollback" : "ok", {
              failedTaskIds: backgroundFailures.map((item) => item.taskId),
            });
          })
          .catch((error) => {
            backgroundStopTelemetry("error", {
              message: String((error as { message?: string } | null)?.message || error || ""),
            });
          })
          .finally(() => {
            backgroundScheduleRef.current = null;
          });
      }, backgroundDelayMs);
    };

    const refreshPromise = (async () => {
      try {
        const failures = await runRefreshLane({
          lane: "critical",
          maxParallel: resolvedMaxParallel,
          tasks: criticalTasks,
        });
        logScreenView({
          durationMs: Math.max(0, Date.now() - startedAt),
          meta: {
            backgroundTaskCount: backgroundTasks.length,
            failedTaskIds: failures.map((item) => item.taskId),
            taskCount: criticalTasks.length,
          },
          name: "manual_refresh_latency",
          screenKey,
          status: failures.length > 0 ? "rollback" : "ok",
        });
        stopTelemetry(failures.length > 0 ? "rollback" : "ok", {
          failedTaskIds: failures.map((item) => item.taskId),
        });
        runBackgroundLane();
      } catch (error) {
        stopTelemetry("error", {
          message: String((error as { message?: string } | null)?.message || error || ""),
        });
        throw error;
      }
    })().finally(() => {
      if (inFlightRefreshRef.current === refreshPromise) {
        inFlightRefreshRef.current = null;
      }
    });

    inFlightRefreshRef.current = refreshPromise;
    return refreshPromise;
  }, [backgroundDelayMs, enabled, resolvedMaxParallel, screenKey]);
}
