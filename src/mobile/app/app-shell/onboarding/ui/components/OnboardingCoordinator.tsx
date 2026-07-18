import { useOnboarding } from "../../domain";
import { PermissionsScreen } from "./PermissionsScreen";

export function OnboardingCoordinator() {
  const { grantPermissions, showPermissions } = useOnboarding();

  return (
    <PermissionsScreen
      visible={showPermissions}
      onComplete={(snapshot, options) => grantPermissions(snapshot, options)}
    />
  );
}
