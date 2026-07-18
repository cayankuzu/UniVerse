export type PermissionStatus = "granted" | "denied" | "undetermined";

export interface PermissionSnapshot {
  camera: PermissionStatus;
  completedAt: string;
  location: PermissionStatus;
  microphone: PermissionStatus;
  notifications: PermissionStatus;
  photos: PermissionStatus;
}
