import { debugLog, debugWarn } from "../../../platform/logging/logger";

export function logAlbumMediaDebug(message: string, payload?: unknown) {
  debugLog("MEDIA/ALBUM", message, payload);
}

export function warnAlbumMediaDebug(message: string, payload?: unknown) {
  debugWarn("MEDIA/ALBUM", message, payload);
}
