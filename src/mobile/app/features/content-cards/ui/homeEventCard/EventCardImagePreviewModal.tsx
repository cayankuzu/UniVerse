import React from "react";
import { type OverflowActionItem } from "../../../../shared/components";
import { MediaViewerModal } from "../../../../shared/media/MediaViewerModal";

type Props = {
  imageUri?: string;
  onClose: () => void;
  actions?: OverflowActionItem[];
  visible: boolean;
};

export function EventCardImagePreviewModal({ actions, imageUri, onClose, visible }: Props) {
  return (
    <MediaViewerModal
      actions={actions}
      items={imageUri ? [{ uri: imageUri }] : []}
      onClose={onClose}
      visible={visible}
    />
  );
}
