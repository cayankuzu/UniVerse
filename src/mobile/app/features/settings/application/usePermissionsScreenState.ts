import { useCallback, useMemo, useRef, useState } from "react";
import { AppState, Linking } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  DEVICE_PERMISSION_DETAILS,
  devicePermissionStateFromSnapshot,
  type DevicePermissionKey,
  type DevicePermissionState,
  readDevicePermissionStateProgressively,
  requestDevicePermission,
  toPermissionSnapshot,
} from "../../../platform/permissions/devicePermissions";
import {
  persistPermissionSnapshot,
  readPermissionSnapshot,
} from "../../../data/preferences/permissionStorage";

function statusTitle(status: "denied" | "granted" | "undetermined") {
  if (status === "granted") return "Açık";
  if (status === "denied") return "Kapalı";
  return "Henüz sorulmadı";
}

function actionLabel(status: "denied" | "granted" | "undetermined") {
  return status === "undetermined" ? "İzin Ver" : "Ayarlar";
}

const DEFAULT_PERMISSION_STATE: DevicePermissionState = {
  camera: "undetermined",
  location: "undetermined",
  microphone: "undetermined",
  notifications: "undetermined",
  photos: "undetermined",
};

export function usePermissionsScreenState(params: { goBack: () => void }) {
  const refreshSequenceRef = useRef(0);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingPermission, setPendingPermission] = useState<DevicePermissionKey | null>(null);
  const [state, setState] = useState<DevicePermissionState>(DEFAULT_PERMISSION_STATE);

  const hydrateStoredPermissions = useCallback(async () => {
    const snapshot = await readPermissionSnapshot();
    if (!snapshot) return false;
    setState(devicePermissionStateFromSnapshot(snapshot));
    return true;
  }, []);

  const refreshPermissions = useCallback(async (options?: { showSpinner?: boolean }) => {
    const showSpinner = options?.showSpinner !== false;
    if (showSpinner) {
      setIsLoading(true);
    }
    try {
      const refreshSequence = refreshSequenceRef.current + 1;
      refreshSequenceRef.current = refreshSequence;
      const nextState = await readDevicePermissionStateProgressively((partialState) => {
        if (refreshSequenceRef.current !== refreshSequence) return;
        setState((current) => ({ ...current, ...partialState }));
      });
      if (refreshSequenceRef.current !== refreshSequence) return;
      setState(nextState);
      await persistPermissionSnapshot(toPermissionSnapshot(nextState));
    } finally {
      if (showSpinner) {
        setIsLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const hasSnapshot = await hydrateStoredPermissions();
        if (!active) return;
        setIsLoading(!hasSnapshot);
        try {
          await refreshPermissions({ showSpinner: !hasSnapshot });
        } finally {
          if (active) {
            setIsLoading(false);
          }
        }
      })();

      const subscription = AppState.addEventListener("change", (nextState) => {
        if (nextState === "active") {
          void refreshPermissions({ showSpinner: false });
        }
      });

      return () => {
        active = false;
        subscription.remove();
      };
    }, [hydrateStoredPermissions, refreshPermissions]),
  );

  const handlePermissionPress = useCallback(
    async (permission: DevicePermissionKey) => {
      if (pendingPermission) return;
      if (state[permission] !== "undetermined") {
        void Linking.openSettings();
        return;
      }

      setPendingPermission(permission);
      try {
        const nextStatus = await requestDevicePermission(permission);
        const nextState = { ...state, [permission]: nextStatus };
        setState(nextState);
        await persistPermissionSnapshot(toPermissionSnapshot(nextState));
      } finally {
        setPendingPermission(null);
      }
    },
    [pendingPermission, state],
  );

  const handlePermissionToggle = useCallback(
    (permission: DevicePermissionKey) => {
      void handlePermissionPress(permission);
    },
    [handlePermissionPress],
  );

  const items = useMemo(
    () =>
      DEVICE_PERMISSION_DETAILS.map((item) => ({
        ...item,
        actionLabel: actionLabel(state[item.id]),
        isPending: pendingPermission === item.id,
        statusTitle: statusTitle(state[item.id]),
        value: state[item.id],
      })),
    [pendingPermission, state],
  );

  return {
    handleBack: params.goBack,
    handlePermissionPress,
    handlePermissionToggle,
    isLoading,
    items,
    refreshPermissions,
  };
}
