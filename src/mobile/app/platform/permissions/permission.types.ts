export type PermissionStatus = "granted" | "denied" | "undetermined";

export interface PermissionSnapshot {
  camera: PermissionStatus;
  completedAt: string;
  microphone: PermissionStatus;
  notifications: PermissionStatus;
  photos: PermissionStatus;
}
