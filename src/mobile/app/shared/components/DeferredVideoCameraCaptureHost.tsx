import React, { useEffect, useState } from "react";
import { useVideoCameraCaptureState } from "../media/videoCameraCaptureController";
import { scheduleAfterInteractions } from "../utils/scheduleAfterInteractions";

type CameraHost = typeof import("./VideoCameraCaptureHost").default;

let loadedCameraHost: CameraHost | null = null;

function loadCameraHost() {
  loadedCameraHost ||= require("./VideoCameraCaptureHost").default as CameraHost;
  return loadedCameraHost;
}

export function DeferredVideoCameraCaptureHost() {
  const { visible } = useVideoCameraCaptureState();
  const [CameraCaptureHost, setCameraCaptureHost] = useState<CameraHost | null>(loadedCameraHost);

  useEffect(() => {
    if (CameraCaptureHost) return;

    const task = scheduleAfterInteractions(
      () => {
        setCameraCaptureHost(() => loadCameraHost());
      },
      visible ? 0 : 600,
    );
    return task.cancel;
  }, [CameraCaptureHost, visible]);

  return CameraCaptureHost ? <CameraCaptureHost /> : null;
}
