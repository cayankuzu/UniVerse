import { useCallback } from "react";
import { submitProfileReport } from "../data";
import { useProfileMutationState } from "./useProfileMutationState";

type UseProfileReportActionsParams = {
  mutationState: ReturnType<typeof useProfileMutationState>;
  username: string;
};

export function useProfileReportActions(params: UseProfileReportActionsParams) {
  const { isReportPending, reportError, runMutation } = params.mutationState;
  const runReport = useCallback(
    (reason?: string) =>
      runMutation({
        execute: () => submitProfileReport(params.username, reason),
        kind: "report",
      }),
    [params.username, runMutation],
  );

  return {
    isReportPending,
    reportError,
    runReport,
  };
}
