import { Download, Trash2 } from "lucide-react-native";
import { useMemo } from "react";
import { Alert } from "react-native";
import { tokens } from "../../../../shared/theme";
import { downloadMediaToGallery } from "../../../../shared/media/downloadMediaToGallery";
import type { MediaViewerItem } from "../../../../shared/media/MediaViewerModal";

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
              label: "Indir",
              icon: <Download size={tokens.iconSize.md} color={tokens.colors.foreground} />,
              onPress: () => {
                void downloadMediaToGallery({
                  fileName:
                    activeViewerItem.label || activeViewerItem.uri.split("/").pop() || undefined,
                  kind: activeViewerItem.kind === "video" ? "video" : "image",
                  uri: activeViewerItem.uri,
                }).catch((error) => {
                  Alert.alert(
                    "Indirme ba??ar??s??z",
                    String(
                      (error as { message?: string } | null)?.message || "Medya indirilemedi.",
                    ),
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
                Alert.alert("Medyayı sil", "Bu seçili medyayı kaldırmak istiyor musun?", [
                  { text: "Vazge??", style: "cancel" },
                  {
                    text: "Sil",
                    style: "destructive",
                    onPress: () => {
                      onCloseViewer();
                      onRemoveSelectedPhoto(activeViewerIndex);
                    },
                  },
                ]);
              },
            },
          ]
        : [],
    [activeViewerIndex, activeViewerItem, onCloseViewer, onRemoveSelectedPhoto],
  );
}
