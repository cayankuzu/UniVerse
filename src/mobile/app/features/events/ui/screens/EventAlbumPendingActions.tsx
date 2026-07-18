import React from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import type { PendingAlbumPhoto } from "../../data";
import { tokens } from "../../../../shared/theme";
import { t } from "../../../../shared/i18n";

type Props = {
  pending: PendingAlbumPhoto;
  onRemove: () => void;
  onRetry: () => void;
};

function isRetryableAlbumUploadError(message: string | undefined) {
  const normalized = String(message || "")
    .trim()
    .toLowerCase();
  if (!normalized) return true;
  if (normalized.includes("en fazla") && normalized.includes("medya")) return false;
  if (normalized.includes("en fazla 3 album karti")) return false;
  if (normalized.includes("fotograf yukleme yetkiniz yok")) return false;
  if (normalized.includes("fotograf boyutu cok buyuk")) return false;
  if (normalized.includes("video boyutu cok buyuk")) return false;
  if (normalized.includes("video suresi cok uzun")) return false;
  if (normalized.includes("sona erdigi")) return false;
  if (normalized.includes("erisilemiyor")) return false;
  if (normalized.includes("permission denied")) return false;
  if (normalized.includes("eacces")) return false;
  return true;
}

function formatAlbumUploadError(message: string | undefined) {
  const normalized = String(message || "").trim();
  if (!normalized) return "Yukleme basarisiz oldu.";
  if (/^unauthorized$/i.test(normalized)) {
    return "Oturum dogrulanamadi. Uygulamayi yeniden acip tekrar dene.";
  }
  return normalized.length > 120 ? `${normalized.slice(0, 117).trimEnd()}...` : normalized;
}

function confirmCancelPendingUpload(onRemove: () => void) {
  Alert.alert("Yukleme iptal edilsin mi?", "Bu album kartinin bekleyen yuklemesi iptal edilecek.", [
    {
      style: "cancel",
      text: t("common.cancel"),
    },
    {
      onPress: onRemove,
      style: "destructive",
      text: "Iptal Et",
    },
  ]);
}

function confirmRemoveFailedUpload(onRemove: () => void) {
  Alert.alert("Kart silinsin mi?", "Bu basarisiz album karti kuyruktan kaldirilacak.", [
    {
      style: "cancel",
      text: t("common.cancel"),
    },
    {
      onPress: onRemove,
      style: "destructive",
      text: t("common.delete"),
    },
  ]);
}

export function EventAlbumPendingActions({ pending, onRemove, onRetry }: Props) {
  const isRetryable = isRetryableAlbumUploadError(pending.uploadError);
  const errorMessage = formatAlbumUploadError(pending.uploadError);

  return (
    <View
      style={{
        position: "absolute",
        right: tokens.hitSlop.md,
        bottom: tokens.hitSlop.md,
        alignItems: "flex-end",
        gap: tokens.spacing.xxs + 2,
      }}
    >
      {pending.uploadStatus === "failed" ? (
        <View
          style={{
            maxWidth: 180,
            borderRadius: tokens.radius.md,
            backgroundColor: `${tokens.colors.overlayHeavy}f0`,
            paddingHorizontal: tokens.spacing.xs,
            paddingVertical: tokens.spacing.xxs + 2,
          }}
        >
          <Text
            style={{
              color: tokens.colors.surface,
              fontSize: tokens.typography.micro,
              fontWeight: tokens.fontWeight.medium,
              lineHeight: 14,
            }}
          >
            {errorMessage}
          </Text>
        </View>
      ) : null}

      {pending.uploadStatus === "failed" ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: tokens.spacing.xxs + 2,
          }}
        >
          {isRetryable ? (
            <Pressable
              onPress={onRetry}
              style={{
                borderRadius: tokens.radius.md,
                backgroundColor: `${tokens.colors.dangerDeep}e6`,
                paddingHorizontal: tokens.hitSlop.md,
                paddingVertical: tokens.spacing.xxs + 2,
              }}
            >
              <Text
                style={{
                  color: tokens.colors.surface,
                  fontSize: tokens.typography.tiny,
                  fontWeight: tokens.fontWeight.bold,
                }}
              >
                {t("common.retryAction")}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => confirmRemoveFailedUpload(onRemove)}
            style={{
              borderRadius: tokens.radius.md,
              backgroundColor: tokens.colors.backdrop,
              paddingHorizontal: tokens.hitSlop.md,
              paddingVertical: tokens.spacing.xxs + 2,
            }}
          >
            <Text
              style={{
                color: tokens.colors.surface,
                fontSize: tokens.typography.tiny,
                fontWeight: tokens.fontWeight.bold,
              }}
            >
              {t("common.delete")}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: tokens.spacing.xxs + 2,
          }}
        >
          <View
            style={{
              borderRadius: tokens.radius.md,
              backgroundColor: tokens.colors.backdrop,
              paddingHorizontal: tokens.hitSlop.md,
              paddingVertical: tokens.spacing.xxs + 2,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: tokens.spacing.xxs + 2,
              }}
            >
              <ActivityIndicator size="small" color={tokens.colors.surface} />
              <Text
                style={{
                  color: tokens.colors.surface,
                  fontSize: tokens.typography.tiny,
                  fontWeight: tokens.fontWeight.bold,
                }}
              >
                Paylasiliyor
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => confirmCancelPendingUpload(onRemove)}
            style={{
              borderRadius: tokens.radius.md,
              backgroundColor: `${tokens.colors.dangerDeep}e6`,
              paddingHorizontal: tokens.hitSlop.md,
              paddingVertical: tokens.spacing.xxs + 2,
            }}
          >
            <Text
              style={{
                color: tokens.colors.surface,
                fontSize: tokens.typography.tiny,
                fontWeight: tokens.fontWeight.bold,
              }}
            >
              Iptal Et
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
