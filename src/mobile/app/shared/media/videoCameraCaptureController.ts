import { createPromptController } from "./createPromptController";

export type VideoCameraCaptureOptions = {
  maxDurationSeconds?: number;
};

export type VideoCameraCaptureResult = {
  durationMs: number;
  uri: string;
};

const controller = createPromptController<VideoCameraCaptureOptions, VideoCameraCaptureResult>({});

export const useVideoCameraCaptureState = controller.useControllerState;
export const openVideoCameraCapture = controller.open;
export const resolveVideoCameraCapture = controller.resolve;
