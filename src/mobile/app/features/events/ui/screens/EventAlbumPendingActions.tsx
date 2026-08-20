import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { ActivityIndicator, Pressable, View } from "react-native";
import type { PendingAlbumPhoto } from "../../data";
import { tokens } from "../../../../shared/theme";
import { t } from "../../../../shared/i18n";
import { showConfirmAlert } from "../../../../shared/utils/alerts";

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
  if (!normalized) return "Yükleme başarısız oldu.";
  if (/^unauthorized$/i.test(normalized)) {
    return "Oturum doğrulanamadı. Uygulamayı yeniden açıp tekrar dene.";
  }
  return normalized.length > 120 ? `${normalized.slice(0, 117).trimEnd()}...` : normalized;
}

function confirmCancelPendingUpload(onRemove: () => void) {
  showConfirmAlert({
    cancelLabel: t("common.cancel"),
    confirmLabel: "İptal Et",
    destructive: true,
    message: "Bu albüm kartının bekleyen yüklemesi iptal edilecek.",
    onConfirm: onRemove,
    title: "Yükleme iptal edilsin mi?",
  });
}

function confirmRemoveFailedUpload(onRemove: () => void) {
  showConfirmAlert({
    cancelLabel: t("common.cancel"),
    confirmLabel: t("common.delete"),
    destructive: true,
    message: "Bu başarısız albüm kartı kuyruktan kaldırılacak.",
    onConfirm: onRemove,
    title: "Kart silinsin mi?",
  });
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
              lineHeight: tokens.lineHeight.micro,
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
              accessibilityRole="button"
              accessibilityLabel={t("common.retryAction")}
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
            accessibilityRole="button"
            accessibilityLabel="Başarısız yüklemeyi kaldır"
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
                Paylaşılıyor
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => confirmCancelPendingUpload(onRemove)}
            accessibilityRole="button"
            accessibilityLabel="Yüklemeyi iptal et"
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
              İptal Et
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
