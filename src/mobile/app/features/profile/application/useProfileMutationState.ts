import { useCallback, useState } from "react";

type ProfileMutationKind = "relationship" | "report";
type ProfileMutationErrors = Record<ProfileMutationKind, string | null>;

type RunProfileMutationParams<T> = {
  execute: () => Promise<T>;
  kind: ProfileMutationKind;
  rollback?: () => void;
};

function resolveMutationErrorMessage(error: unknown) {
  return String((error as { message?: string } | null)?.message || "profile-mutation-failed");
}

export function useProfileMutationState() {
  const [activeMutation, setActiveMutation] = useState<ProfileMutationKind | null>(null);
  const [errors, setErrors] = useState<ProfileMutationErrors>({
    relationship: null,
    report: null,
  });

  const clearError = useCallback(() => {
    setErrors({
      relationship: null,
      report: null,
    });
  }, []);

  const runMutation = useCallback(
    async <T>({ execute, kind, rollback }: RunProfileMutationParams<T>) => {
      setActiveMutation(kind);
      setErrors((current) =>
        current[kind]
          ? {
              ...current,
              [kind]: null,
            }
          : current,
      );
      try {
        return await execute();
      } catch (error) {
        rollback?.();
        setErrors((current) => ({
          ...current,
          [kind]: resolveMutationErrorMessage(error),
        }));
        throw error;
      } finally {
        setActiveMutation((current) => (current === kind ? null : current));
      }
    },
    [],
  );

  return {
    clearError,
    isRelationshipPending: activeMutation === "relationship",
    isReportPending: activeMutation === "report",
    relationshipError: errors.relationship,
    reportError: errors.report,
    runMutation,
  };
}
