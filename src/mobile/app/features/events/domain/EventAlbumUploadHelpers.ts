import { THUMB_GAP, THUMB_SIZE } from "./eventAlbumDragLayout";

export function clampAlbumThumbIndex(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function getAlbumThumbSlotX(index: number) {
  return index * (THUMB_SIZE + THUMB_GAP);
}

export function getAlbumThumbGridWidth(itemCount: number) {
  if (itemCount <= 0) {
    return THUMB_SIZE;
  }
  return itemCount * THUMB_SIZE + Math.max(itemCount - 1, 0) * THUMB_GAP;
}
