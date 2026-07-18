import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder } from "react-native";
import { THUMB_GAP, THUMB_SIZE } from "../domain/eventAlbumDragLayout";

type Params = {
  selectedPhotoUris: string[];
  uploadPending: boolean;
  onReorderSelectedPhoto: (draggedUri: string, toIndex: number) => void;
  onSelectPhoto: (index: number) => void;
};

export function useAlbumUploadDrag({
  selectedPhotoUris,
  uploadPending,
  onReorderSelectedPhoto,
  onSelectPhoto,
}: Params) {
  const dragTranslateX = useRef(new Animated.Value(0)).current;
  const dragTranslateY = useRef(new Animated.Value(0)).current;
  const activeDragIndexRef = useRef<number | null>(null);
  const currentDragIndexRef = useRef<number | null>(null);
  const dragStepOffsetRef = useRef(0);
  const lastSwapAtRef = useRef(0);
  const didSwapDuringDragRef = useRef(false);
  const ignorePressUntilRef = useRef(0);
  const [draggingPhotoUri, setDraggingPhotoUri] = useState("");

  const resetDragState = useCallback(() => {
    activeDragIndexRef.current = null;
    currentDragIndexRef.current = null;
    dragStepOffsetRef.current = 0;
    lastSwapAtRef.current = 0;
    didSwapDuringDragRef.current = false;
    setDraggingPhotoUri("");
    dragTranslateX.stopAnimation();
    dragTranslateY.stopAnimation();
    dragTranslateX.setValue(0);
    dragTranslateY.setValue(0);
  }, [dragTranslateX, dragTranslateY]);

  const finishDragState = useCallback(() => {
    activeDragIndexRef.current = null;
    currentDragIndexRef.current = null;
    dragStepOffsetRef.current = 0;
    lastSwapAtRef.current = 0;
    didSwapDuringDragRef.current = false;
    setDraggingPhotoUri("");
  }, []);

  useEffect(() => resetDragState, [resetDragState]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !uploadPending && activeDragIndexRef.current !== null,
        onStartShouldSetPanResponderCapture: () =>
          !uploadPending && activeDragIndexRef.current !== null,
        onMoveShouldSetPanResponder: () => !uploadPending && activeDragIndexRef.current !== null,
        onMoveShouldSetPanResponderCapture: () =>
          !uploadPending && activeDragIndexRef.current !== null,
        onPanResponderMove: (_event, gestureState) => {
          const currentIndex = currentDragIndexRef.current;
          if (
            currentIndex === null ||
            uploadPending ||
            selectedPhotoUris.length <= 1 ||
            !draggingPhotoUri
          ) {
            return;
          }

          const swapThreshold = THUMB_SIZE * 0.5;
          const stepWidth = THUMB_SIZE + THUMB_GAP;
          const nextDx = gestureState.dx - dragStepOffsetRef.current;
          const visualLimit = didSwapDuringDragRef.current ? THUMB_SIZE * 0.35 : stepWidth;
          dragTranslateX.setValue(Math.max(Math.min(nextDx, visualLimit), -visualLimit));
          dragTranslateY.setValue(0);

          const now = Date.now();
          if (didSwapDuringDragRef.current) return;
          if (
            nextDx >= swapThreshold &&
            currentIndex < selectedPhotoUris.length - 1 &&
            now - lastSwapAtRef.current >= 70
          ) {
            const targetIndex = currentIndex + 1;
            currentDragIndexRef.current = targetIndex;
            dragStepOffsetRef.current += stepWidth;
            lastSwapAtRef.current = now;
            didSwapDuringDragRef.current = true;
            dragTranslateX.setValue(0);
            onReorderSelectedPhoto(draggingPhotoUri, targetIndex);
            return;
          }
          if (nextDx <= -swapThreshold && currentIndex > 0 && now - lastSwapAtRef.current >= 70) {
            const targetIndex = currentIndex - 1;
            currentDragIndexRef.current = targetIndex;
            dragStepOffsetRef.current -= stepWidth;
            lastSwapAtRef.current = now;
            didSwapDuringDragRef.current = true;
            dragTranslateX.setValue(0);
            onReorderSelectedPhoto(draggingPhotoUri, targetIndex);
          }
        },
        onPanResponderRelease: () => {
          const finalIndex = currentDragIndexRef.current;
          if (finalIndex !== null) {
            onSelectPhoto(finalIndex);
          }
          ignorePressUntilRef.current = Date.now() + 250;
          finishDragState();
          dragTranslateX.setValue(0);
          dragTranslateY.setValue(0);
        },
        onPanResponderTerminate: () => {
          ignorePressUntilRef.current = Date.now() + 250;
          finishDragState();
          dragTranslateX.setValue(0);
          dragTranslateY.setValue(0);
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [
      dragTranslateX,
      dragTranslateY,
      draggingPhotoUri,
      finishDragState,
      onReorderSelectedPhoto,
      onSelectPhoto,
      selectedPhotoUris.length,
      uploadPending,
    ],
  );

  const beginDrag = (index: number, uri: string) => {
    if (uploadPending) return;
    activeDragIndexRef.current = index;
    currentDragIndexRef.current = index;
    dragStepOffsetRef.current = 0;
    didSwapDuringDragRef.current = false;
    dragTranslateX.setValue(0);
    dragTranslateY.setValue(0);
    setDraggingPhotoUri(uri);
    onSelectPhoto(index);
  };

  const handleThumbPress = (index: number) => {
    if (Date.now() < ignorePressUntilRef.current || draggingPhotoUri) return;
    onSelectPhoto(index);
  };

  return {
    beginDrag,
    dragTranslateX,
    dragTranslateY,
    draggingPhotoUri,
    handleThumbPress,
    panHandlers: panResponder.panHandlers,
    resetDragState,
  };
}
