import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppText as Text } from "./AppText";
import { Platform, StatusBar, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MAX_VIDEO_DURATION_SECONDS } from "../media/mediaVideoUtils";
import {
  resolveVideoCameraCapture,
  useVideoCameraCaptureState,
} from "../media/videoCameraCaptureController";
import { tokens, withAlpha } from "../theme";
import { InstantPressable } from "./InstantPressable";
import { AppModalHost } from "./AppModalHost";
function clearTimer(timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) {
  if (!timerRef.current) return;
  clearTimeout(timerRef.current);
  timerRef.current = null;
}

function clearIntervalTimer(
  timerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
) {
  if (!timerRef.current) return;
  clearInterval(timerRef.current);
  timerRef.current = null;
}

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function VideoCameraCaptureHost() {
  const insets = useSafeAreaInsets();
  const { options, requestId, visible } = useVideoCameraCaptureState();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<"front" | "back">("back");
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isPermissionRequestInFlight, setIsPermissionRequestInFlight] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const cameraRef = useRef<CameraView | null>(null);
  const autoStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureCancelledRef = useRef(false);
  const recordingStartedAtRef = useRef<number | null>(null);
  const settledRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxDurationSeconds = Math.max(1, options.maxDurationSeconds ?? MAX_VIDEO_DURATION_SECONDS);
  const maxDurationMs = maxDurationSeconds * 1000;
  const permissionsGranted = Boolean(cameraPermission?.granted && microphonePermission?.granted);
  const remainingMs = Math.max(maxDurationMs - elapsedMs, 0);
  const progress = Math.min(elapsedMs / maxDurationMs, 1);

  const clearCaptureTimers = useCallback(() => {
    clearTimer(autoStopTimeoutRef);
    clearIntervalTimer(tickIntervalRef);
  }, []);

  const resetLocalState = useCallback(() => {
    clearCaptureTimers();
    captureCancelledRef.current = false;
    recordingStartedAtRef.current = null;
    settledRef.current = false;
    stopRequestedRef.current = false;
    setElapsedMs(0);
    setFacing("back");
    setIsCameraReady(false);
    setIsRecording(false);
  }, [clearCaptureTimers]);

  useEffect(() => {
    if (!visible) {
      resetLocalState();
      return;
    }

    resetLocalState();
  }, [requestId, resetLocalState, visible]);

  useEffect(() => {
    return () => {
      clearCaptureTimers();
    };
  }, [clearCaptureTimers]);

  const finishCapture = useCallback(
    (result: { durationMs: number; uri: string } | null) => {
      if (settledRef.current) {
        return;
      }

      settledRef.current = true;
      clearCaptureTimers();
      setIsRecording(false);
      resolveVideoCameraCapture(result);
    },
    [clearCaptureTimers],
  );

  const ensurePermissions = useCallback(async () => {
    if (!visible || isPermissionRequestInFlight || permissionsGranted) {
      return;
    }

    setIsPermissionRequestInFlight(true);

    try {
      const nextCameraPermission = cameraPermission?.granted
        ? cameraPermission
        : await requestCameraPermission();
      if (!nextCameraPermission.granted) {
        return;
      }

      const nextMicrophonePermission = microphonePermission?.granted
        ? microphonePermission
        : await requestMicrophonePermission();
      if (!nextMicrophonePermission.granted) {
        return;
      }
    } finally {
      setIsPermissionRequestInFlight(false);
    }
  }, [
    cameraPermission,
    isPermissionRequestInFlight,
    microphonePermission,
    permissionsGranted,
    requestCameraPermission,
    requestMicrophonePermission,
    visible,
  ]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    void ensurePermissions();
  }, [ensurePermissions, requestId, visible]);

  const requestStopRecording = useCallback(() => {
    if (!cameraRef.current || stopRequestedRef.current) {
      return;
    }

    stopRequestedRef.current = true;
    cameraRef.current.stopRecording();
  }, []);

  const handleClose = useCallback(() => {
    if (isRecording) {
      captureCancelledRef.current = true;
      requestStopRecording();
      return;
    }

    finishCapture(null);
  }, [finishCapture, isRecording, requestStopRecording]);

  const handleStartRecording = useCallback(async () => {
    if (!cameraRef.current || !visible || !permissionsGranted || !isCameraReady || isRecording) {
      return;
    }

    captureCancelledRef.current = false;
    settledRef.current = false;
    stopRequestedRef.current = false;
    recordingStartedAtRef.current = Date.now();
    setElapsedMs(0);
    setIsRecording(true);

    tickIntervalRef.current = setInterval(() => {
      if (!recordingStartedAtRef.current) {
        return;
      }

      const nextElapsedMs = Math.min(Date.now() - recordingStartedAtRef.current, maxDurationMs);
      setElapsedMs(nextElapsedMs);
    }, 250);

    autoStopTimeoutRef.current = setTimeout(() => {
      requestStopRecording();
    }, maxDurationMs);

    try {
      const recording = await cameraRef.current.recordAsync({
        maxDuration: maxDurationSeconds,
        ...(Platform.OS === "ios" ? { codec: "avc1" as const } : null),
      });
      const measuredDurationMs = recordingStartedAtRef.current
        ? Math.min(Date.now() - recordingStartedAtRef.current, maxDurationMs)
        : maxDurationMs;

      if (!recording?.uri || captureCancelledRef.current) {
        finishCapture(null);
        return;
      }

      finishCapture({
        durationMs: measuredDurationMs,
        uri: recording.uri,
      });
    } catch {
      finishCapture(null);
    }
  }, [
    finishCapture,
    isCameraReady,
    isRecording,
    maxDurationMs,
    maxDurationSeconds,
    permissionsGranted,
    requestStopRecording,
    visible,
  ]);

  const handleToggleFacing = useCallback(() => {
    if (isRecording) {
      return;
    }

    setFacing((current) => (current === "back" ? "front" : "back"));
  }, [isRecording]);

  if (!visible) {
    return null;
  }

  return (
    <AppModalHost
      accessibilityAnnouncement="Video kamera"
      visible
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "fullScreen" : undefined}
      statusBarTranslucent
      supportedOrientations={["portrait"]}
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        {permissionsGranted ? (
          <CameraView
            ref={cameraRef}
            active={visible}
            style={StyleSheet.absoluteFill}
            facing={facing}
            mode="video"
            mute={false}
            onCameraReady={() => setIsCameraReady(true)}
          />
        ) : (
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>Kamera ve mikrofon izni gerekli</Text>
            <InstantPressable
              accessibilityLabel="Kamera ve mikrofon izni ver"
              accessibilityRole="button"
              onPress={() => {
                void ensurePermissions();
              }}
              style={styles.permissionButton}
            >
              <Text style={styles.permissionButtonText}>
                {isPermissionRequestInFlight ? "Hazırlanıyor..." : "İzin Ver"}
              </Text>
            </InstantPressable>
            <InstantPressable
              accessibilityLabel="Kapat"
              accessibilityRole="button"
              onPress={handleClose}
              style={styles.permissionSecondaryButton}
            >
              <Text style={styles.permissionSecondaryText}>Kapat</Text>
            </InstantPressable>
          </View>
        )}

        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <InstantPressable
            accessibilityLabel="Kapat"
            accessibilityRole="button"
            onPress={handleClose}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={tokens.iconSize["2xl"]} color={tokens.colors.onMedia} />
          </InstantPressable>

          <View style={styles.timerContainer}>
            {isRecording ? <View style={styles.recordingDot} /> : null}
            <Text
              style={[
                styles.timerText,
                isRecording && remainingMs <= 10_000 ? styles.timerWarning : null,
              ]}
            >
              {isRecording
                ? formatTimer(Math.ceil(remainingMs / 1000))
                : formatTimer(maxDurationSeconds)}
            </Text>
          </View>

          {!isRecording ? (
            <InstantPressable
              accessibilityLabel="Kamerayi cevir"
              accessibilityRole="button"
              onPress={handleToggleFacing}
              style={styles.flipButton}
            >
              <Ionicons
                name="camera-reverse-outline"
                size={tokens.iconSize["2xl"]}
                color={tokens.colors.onMedia}
              />
            </InstantPressable>
          ) : (
            <View style={styles.flipPlaceholder} />
          )}
        </View>

        {permissionsGranted && !isCameraReady ? (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Kamera hazırlanıyor...</Text>
          </View>
        ) : null}

        {isRecording ? (
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
          </View>
        ) : null}

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sideButtonPlaceholder} />
          <InstantPressable
            accessibilityLabel={isRecording ? "Kaydı durdur" : "Kayda başla"}
            accessibilityRole="button"
            testID={isRecording ? "video-camera-stop-button" : "video-camera-start-button"}
            onPress={() => {
              if (isRecording) {
                requestStopRecording();
                return;
              }

              void handleStartRecording();
            }}
            style={styles.recordButtonOuter}
          >
            <View
              style={[styles.recordButtonInner, isRecording ? styles.recordButtonStop : null]}
            />
          </InstantPressable>
          <View style={styles.sideButtonPlaceholder} />
        </View>
      </View>
    </AppModalHost>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: tokens.spacing.xxl,
    paddingTop: tokens.spacing.md,
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: withAlpha(tokens.colors.mediaBlack, 0.4),
    borderRadius: tokens.radius["2xl"],
    height: tokens.minHeight.touchTarget,
    justifyContent: "center",
    width: tokens.minHeight.touchTarget,
  },
  container: {
    backgroundColor: tokens.colors.mediaBlack,
    flex: 1,
    justifyContent: "space-between",
  },
  flipButton: {
    alignItems: "center",
    backgroundColor: withAlpha(tokens.colors.mediaBlack, 0.4),
    borderRadius: tokens.radius["2xl"],
    height: tokens.minHeight.touchTarget,
    justifyContent: "center",
    width: tokens.minHeight.touchTarget,
  },
  flipPlaceholder: {
    width: tokens.minHeight.touchTarget,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: tokens.colors.onMedia,
    fontSize: tokens.typography.control,
    fontWeight: "700",
  },
  permissionButton: {
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.radius.md,
    justifyContent: "center",
    marginTop: tokens.spacing.lg,
    minHeight: tokens.minHeight.buttonLg,
    paddingHorizontal: tokens.spacing.xl,
  },
  permissionButtonText: {
    color: tokens.colors.onMedia,
    fontSize: tokens.typography.subtitle,
    fontWeight: "600",
  },
  permissionContainer: {
    alignItems: "center",
    backgroundColor: tokens.colors.mediaBlack,
    flex: 1,
    justifyContent: "center",
  },
  permissionSecondaryButton: {
    justifyContent: "center",
    marginTop: tokens.spacing.sm,
    minHeight: tokens.minHeight.buttonLg,
    paddingHorizontal: tokens.spacing.lg,
  },
  permissionSecondaryText: {
    color: withAlpha(tokens.colors.onMedia, 0.8),
    fontSize: tokens.typography.body,
    fontWeight: "600",
  },
  permissionText: {
    color: tokens.colors.onMedia,
    fontSize: tokens.typography.cardTitle,
    fontWeight: "600",
  },
  progressBar: {
    backgroundColor: tokens.colors.red,
    height: "100%",
  },
  progressBarContainer: {
    backgroundColor: withAlpha(tokens.colors.onMedia, 0.2),
    height: 3,
    width: "100%",
  },
  recordButtonInner: {
    backgroundColor: tokens.colors.red,
    borderRadius: tokens.radius["3xl"],
    height: 46,
    width: 46,
  },
  recordButtonOuter: {
    alignItems: "center",
    borderColor: tokens.colors.onMedia,
    borderRadius: 30,
    borderWidth: 4,
    height: 60,
    justifyContent: "center",
    width: 60,
  },
  recordButtonStop: {
    borderRadius: tokens.radius.sm,
    height: 26,
    width: 26,
  },
  recordingDot: {
    backgroundColor: tokens.colors.red,
    borderRadius: 5,
    height: 10,
    marginRight: tokens.spacing.xsMinus,
    width: 10,
  },
  sideButtonPlaceholder: { width: 46 },
  timerContainer: {
    alignItems: "center",
    backgroundColor: withAlpha(tokens.colors.mediaBlack, 0.5),
    borderRadius: tokens.radius.lg,
    flexDirection: "row",
    paddingHorizontal: tokens.spacing.smPlus,
    paddingVertical: tokens.spacing.xsMinus,
  },
  timerText: {
    color: tokens.colors.onMedia,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: tokens.typography.cardTitle,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
  },
  timerWarning: { color: tokens.colors.red },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: tokens.spacing.md,
  },
});
