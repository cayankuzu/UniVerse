import { Download, Trash2 } from "lucide-react-native";
import { useMemo } from "react";
import { tokens } from "../../../../shared/theme";
import { downloadMediaToGallery } from "../../../../shared/media/downloadMediaToGallery";
import type { MediaViewerItem } from "../../../../shared/media/MediaViewerModal";
import { showConfirmAlert, showErrorAlert } from "../../../../shared/utils/alerts";

type Params = {
  activeViewerIndex: number;
  activeViewerItem: MediaViewerItem | null;
  onCloseViewer: () => void;
  onRemoveSelectedPhoto: (index: number) => void;
};

export function useAlbumPreviewViewerActions({
  activeViewerIndex,
  activeViewerItem,
  onCloseViewer,
  onRemoveSelectedPhoto,
}: Params) {
  return useMemo(
    () =>
      activeViewerItem?.uri
        ? [
            {
              key: "download",
              label: "İndir",
              icon: <Download size={tokens.iconSize.md} color={tokens.colors.foreground} />,
              onPress: () => {
                void downloadMediaToGallery({
                  fileName:
                    activeViewerItem.label || activeViewerItem.uri.split("/").pop() || undefined,
                  kind: activeViewerItem.kind === "video" ? "video" : "image",
                  uri: activeViewerItem.uri,
                }).catch((error) => {
                  showErrorAlert(
                    String(
                      (error as { message?: string } | null)?.message || "Medya indirilemedi.",
                    ),
                    "İndirme başarısız",
                  );
                });
              },
            },
            {
              key: "delete",
              label: "Sil",
              destructive: true,
              icon: <Trash2 size={tokens.iconSize.md} color={tokens.colors.dangerDark} />,
              onPress: () => {
                showConfirmAlert({
                  confirmLabel: "Sil",
                  destructive: true,
                  message: "Bu seçili medyayı kaldırmak istiyor musun?",
                  onConfirm: () => {
                    onCloseViewer();
                    onRemoveSelectedPhoto(activeViewerIndex);
                  },
                  title: "Medyayı sil",
                });
              },
            },
          ]
        : [],
    [activeViewerIndex, activeViewerItem, onCloseViewer, onRemoveSelectedPhoto],
  );
}
