import { useEffect } from "react";
import { runRuntimeSecurityChecks } from "../../platform/security/runtimeSecurity";
import { scheduleAfterInteractions } from "../../shared/utils/scheduleAfterInteractions";

export function AppSecurityBridge() {
  useEffect(() => {
    const task = scheduleAfterInteractions(() => {
      void runRuntimeSecurityChecks();
    }, 96);
    return () => {
      task.cancel();
    };
  }, []);

  return null;
}
