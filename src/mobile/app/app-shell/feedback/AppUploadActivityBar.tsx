import { useQueryClient } from "@tanstack/react-query";
import type { NavigationContainerRefWithCurrent } from "@react-navigation/native";
import type { OverflowActionItem } from "../../shared/components";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getViewerKey } from "../../data/contracts/viewerKey";
import { subscribeQueueResumeSignal } from "../../data/queues/runtimeSignals";
import type { UploadQueueEntry } from "../../data/queues/uploadQueue";
import { getUploadQueue, removeUploadEntry } from "../../data/queues/uploadQueue";
import { readUploadProgress, type UploadProgressTarget } from "../../data/queues/uploadProgress";
import { tokens } from "../../shared/theme";
import { useAppTransientActivity } from "../../shared/feedback/AppTransientActivityContext";
import { useAuth } from "../auth";
import {
  removePendingAlbumUpload,
  removeQueuedEventCreate,
  retryPendingAlbumUpload,
  retryQueuedEventCreate,
} from "../../features/events/public/queues";
import { AppActivityBanner, type AppActivityBannerTone } from "./AppActivityBanner";
import type { RootNavigatorParamList } from "../navigation/types";

type NavigationHandle = NavigationContainerRefWithCurrent<RootNavigatorParamList>;

type Props = {
  navigationRef: NavigationHandle;
};

type QueueBannerSession = {
  actions: OverflowActionItem[];
  hint?: string;
  percent: number;
  stage: string;
  title: string;
  tone: AppActivityBannerTone;
};

function normalizeQueueText(value: unknown, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function formatQueueErrorMessage(message: unknown) {
  const normalized = normalizeQueueText(message, "İşlem tamamlanamadı.");
  return normalized.length > 140 ? `${normalized.slice(0, 137).trimEnd()}...` : normalized;
}

function getQueueEntryPriority(entry: UploadQueueEntry) {
  if (entry.status === "uploading") return 3;
  if (entry.status === "pending") return 2;
  if (entry.status === "failed") return 1;
  return 0;
}

function pickVisibleQueueEntry(entries: UploadQueueEntry[]) {
  return (
    [...entries]
      .sort((left, right) => {
        const priorityDiff = getQueueEntryPriority(right) - getQueueEntryPriority(left);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      })
      .find((entry) => getQueueEntryPriority(entry) > 0) || null
  );
}

function resolveQueueFallbackTitle(entry: UploadQueueEntry) {
  if (entry.kind === "album-photo") return "Albüm kartı paylaşılıyor";
  if (entry.kind === "event-create") return "Etkinlik paylaşılıyor";
  if (entry.kind === "profile-update") return "Profil guncelleniyor";
  return "Yükleme sürüyor";
}

function resolveQueueFallbackTarget(entry: UploadQueueEntry): UploadProgressTarget | undefined {
  if (entry.kind === "album-photo") {
    const eventId = normalizeQueueText(entry.payload.eventId);
    return eventId
      ? {
          eventId,
          kind: "album-view",
        }
      : undefined;
  }
  if (entry.kind === "event-create") {
    return {
      kind: "event-feed",
    };
  }
  if (entry.kind === "profile-update") {
    return {
      kind: "profile",
    };
  }
  return undefined;
}

function navigateToUploadTarget(
  navigationRef: NavigationHandle,
  target: UploadProgressTarget | undefined,
) {
  if (!target || !navigationRef.isReady()) return;

  if (target.kind === "album-view") {
    navigationRef.navigate("AlbumView", { eventId: target.eventId });
    return;
  }
  if (target.kind === "profile") {
    navigationRef.navigate("MainTabsNavigator", {
      params: { screen: "Profile" },
      screen: "ProfileTab",
    });
    return;
  }
  navigationRef.navigate("MainTabsNavigator", {
    params: { screen: "Home" },
    screen: "HomeTab",
  });
}

export function AppUploadActivityBar({ navigationRef }: Props) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { activity } = useAppTransientActivity();
  const { userData } = useAuth();
  const [entries, setEntries] = useState<UploadQueueEntry[]>([]);
  const viewerKey = getViewerKey(userData);

  const refreshQueueEntries = useCallback(async () => {
    if (!userData.id) {
      setEntries([]);
      return;
    }
    const nextEntries = await getUploadQueue(undefined, userData.id);
    setEntries(nextEntries);
  }, [userData.id]);

  useEffect(() => {
    void refreshQueueEntries();
  }, [refreshQueueEntries]);

  useEffect(() => {
    const unsubscribe = subscribeQueueResumeSignal("upload", () => {
      void refreshQueueEntries();
    });
    return unsubscribe;
  }, [refreshQueueEntries]);

  const visibleQueueEntry = useMemo(() => pickVisibleQueueEntry(entries), [entries]);

  const handleOpenTarget = useCallback(
    (entry: UploadQueueEntry) => {
      const progress = readUploadProgress(entry.payload);
      navigateToUploadTarget(navigationRef, progress?.target || resolveQueueFallbackTarget(entry));
    },
    [navigationRef],
  );

  const handleCancelEntry = useCallback(
    (entry: UploadQueueEntry) => {
      Alert.alert("Yükleme iptal edilsin mi?", "Bu bekleyen gönderi kuyruktan kaldırılacak.", [
        { style: "cancel", text: "Vazgec" },
        {
          style: "destructive",
          text: "İptal Et",
          onPress: () => {
            void (async () => {
              if (entry.kind === "album-photo") {
                await removePendingAlbumUpload(entry.id);
                return;
              }
              if (entry.kind === "event-create") {
                await removeQueuedEventCreate({
                  entryId: entry.id,
                  queryClient,
                  viewerKey,
                });
                return;
              }
              await removeUploadEntry(entry.id);
            })();
          },
        },
      ]);
    },
    [queryClient, viewerKey],
  );

  const handleRetryEntry = useCallback(
    (entry: UploadQueueEntry) => {
      void (async () => {
        if (entry.kind === "album-photo") {
          await retryPendingAlbumUpload(entry.id);
          return;
        }
        if (entry.kind === "event-create") {
          await retryQueuedEventCreate({
            entryId: entry.id,
            ownerId: userData.id,
            queryClient,
            viewerKey,
          });
          return;
        }
      })();
    },
    [queryClient, userData.id, viewerKey],
  );

  const queueSession = useMemo<QueueBannerSession | null>(() => {
    if (!visibleQueueEntry) return null;

    const progress = readUploadProgress(visibleQueueEntry.payload);
    const target = progress?.target || resolveQueueFallbackTarget(visibleQueueEntry);
    const actions: OverflowActionItem[] = [];
    if (target) {
      actions.push({
        key: "open",
        label: "Gönderiye git",
        onPress: () => handleOpenTarget(visibleQueueEntry),
      });
    }
    if (visibleQueueEntry.status === "failed") {
      actions.push({
        key: "retry",
        label: "Tekrar dene",
        onPress: () => handleRetryEntry(visibleQueueEntry),
      });
    }
    actions.push({
      destructive: true,
      key: "cancel",
      label: "İptal et",
      onPress: () => handleCancelEntry(visibleQueueEntry),
    });

    const title = progress?.title || resolveQueueFallbackTitle(visibleQueueEntry);
    if (visibleQueueEntry.status === "failed") {
      return {
        actions,
        hint: "Tekrar deneyebilir veya gönderi ekranına gidebilirsin.",
        percent: progress?.percent ?? 100,
        stage: formatQueueErrorMessage(visibleQueueEntry.errorMessage),
        title,
        tone: "error",
      };
    }

    return {
      actions,
      hint:
        progress?.hint ||
        "Uygulamayi kullanmaya devam edebilirsin; kapanirsa sonraki acilista surer.",
      percent: progress?.percent ?? (visibleQueueEntry.status === "uploading" ? 18 : 5),
      stage:
        progress?.stage ||
        (visibleQueueEntry.status === "uploading" ? "Yükleme devam ediyor" : "Sıraya alındı"),
      title,
      tone: "info",
    };
  }, [handleCancelEntry, handleOpenTarget, handleRetryEntry, visibleQueueEntry]);

  const manualSession = useMemo<QueueBannerSession | null>(() => {
    if (!activity) return null;
    return {
      actions: [],
      hint: activity.hint,
      percent: Math.max(0, Math.min(100, Math.round(activity.percent ?? 100))),
      stage: activity.stage,
      title: activity.title,
      tone: activity.tone,
    };
  }, [activity]);

  const activeSession = manualSession || queueSession;
  if (!activeSession) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        paddingTop: insets.top + 4,
        paddingHorizontal: tokens.spacing.sm,
        paddingBottom: tokens.spacing.xs,
        backgroundColor: tokens.colors.background,
      }}
    >
      <AppActivityBanner
        actions={activeSession.actions}
        hint={activeSession.hint}
        percent={activeSession.percent}
        stage={activeSession.stage}
        title={activeSession.title}
        tone={activeSession.tone}
      />
    </View>
  );
}
