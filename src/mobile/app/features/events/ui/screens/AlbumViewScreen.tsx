import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { ActivityIndicator, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ImagePlus } from "lucide-react-native";
import { useAuth } from "../../../../app-shell/auth";
import {
  useOpenEventDetail,
  useOpenProfileWithOptions,
} from "../../../../app-shell/navigation/hooks/useIntentNavigation";
import { t } from "../../../../shared/i18n";
import { tokens } from "../../../../shared/theme";
import { showConfirmAlert } from "../../../../shared/utils/alerts";
import type { RootStackParamList } from "../../../../app-shell/navigation/types";
import { AppIconButton, BackHeader, FeedToast } from "../../../../shared/components";
import { MediaLibraryPickerSheet } from "../../../../shared/media/MediaLibraryPickerSheet";
import { MediaSourceSheet } from "../../../../shared/media/MediaSourceSheet";
import { AlbumDetailViewerOverlay } from "../../../content-cards/public/overlays";
import { useAlbumViewScreenState } from "../../application/useAlbumViewScreenState";
import { hasAlbumUploadDraftChanges } from "../../domain";
import { AlbumViewPhotoGrid } from "./AlbumViewPhotoGrid";
import { EventAlbumUploadModal } from "./EventAlbumUploadModal";
import { EventAlbumRefreshState } from "./EventAlbumRefreshState";

type Props = NativeStackScreenProps<RootStackParamList, "AlbumView">;

export function AlbumViewScreen({ route, navigation }: Props) {
  const eventId = String(route.params?.eventId || "").trim();
  const photoId = String(route.params?.photoId || "").trim();
  const { accountType, userData } = useAuth();
  const state = useAlbumViewScreenState(
    eventId,
    {
      accountType,
      openEventDetail: useOpenEventDetail(navigation, userData),
      openProfile: useOpenProfileWithOptions(navigation, userData, { method: "push" }),
      userData,
    },
    photoId,
  );
  const openSpecificPhoto = Boolean(photoId);
  const closeViewer = () => {
    if (openSpecificPhoto) {
      navigation.goBack();
      return;
    }
    state.setViewerIndex(null);
  };
  const hasUploadDraftChanges = hasAlbumUploadDraftChanges({
    caption: state.newPhotoCaption,
    selectedPhotoUris: state.selectedPhotoUris,
    showOnClubProfile: state.showOnClubProfile,
    showOnOwnProfile: state.showOnOwnProfile,
    title: state.newPhotoTitle,
  });
  const handleCloseUploadModal = () => {
    if (!hasUploadDraftChanges) {
      state.resetUploadState();
      state.setShowAddPhoto(false);
      return;
    }
    showConfirmAlert({
      cancelLabel: "Vazgec",
      confirmLabel: "Cik",
      destructive: true,
      message: "Seçili medya ve yazdığın alanlar silinecek.",
      onConfirm: () => {
        state.resetUploadState();
        state.setShowAddPhoto(false);
      },
      title: "Taslak kapatilsin mi?",
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.colors.background }}>
      <BackHeader
        title={t("events.album.title")}
        onBack={() => navigation.goBack()}
        right={
          <AppIconButton
            accessibilityLabel={t("events.album.a11y.addPhoto")}
            disabled={state.uploadCheckPending}
            icon={({ color, size }) =>
              state.uploadCheckPending ? (
                <ActivityIndicator size="small" color={tokens.colors.primary} />
              ) : (
                <ImagePlus size={size} color={color} />
              )
            }
            iconColor={tokens.colors.primary}
            onPress={() => {
              void state.handleOpenUpload();
            }}
            outlineColor={tokens.colors.primaryBorder}
            size={32}
            surfaceColor={tokens.colors.primarySofter}
          />
        }
      />

      <View
        style={{
          paddingHorizontal: tokens.spacing.xs,
          paddingTop: tokens.spacing.xsMinus,
          paddingBottom: tokens.spacing.xs,
        }}
      >
        <Text
          style={{ color: tokens.colors.muted, fontSize: tokens.typography.caption }}
          numberOfLines={1}
        >
          {state.subtitle || t("events.album.subtitle.fallback")}
        </Text>
      </View>

      {state.accessMessage ? (
        <EventAlbumRefreshState
          title={t("events.album.locked.title")}
          subtitle={state.accessMessage}
          refreshing={state.refreshing}
          onRefresh={state.onRefresh}
        />
      ) : openSpecificPhoto && state.targetPhotoPending ? (
        <EventAlbumRefreshState
          title={t("events.album.loading.title")}
          subtitle={t("events.album.loading.subtitle")}
          refreshing={state.refreshing}
          onRefresh={state.onRefresh}
        />
      ) : openSpecificPhoto && state.targetPhotoResolved && state.viewerIndex === null ? (
        <EventAlbumRefreshState
          title={t("events.album.notFound.title")}
          subtitle={t("events.album.notFound.subtitle")}
          refreshing={state.refreshing}
          onRefresh={state.onRefresh}
        />
      ) : !state.initialLoading && state.photos.length === 0 ? (
        <EventAlbumRefreshState
          title={t("events.album.empty.title")}
          subtitle={t("events.album.empty.subtitle")}
          refreshing={state.refreshing}
          onRefresh={state.onRefresh}
        />
      ) : (
        <AlbumViewPhotoGrid
          error={state.errorMessage}
          grid={state.grid}
          hasMore={state.albumsProjection.hasMore}
          loading={state.initialLoading}
          loadingMore={state.albumsProjection.loadingMore}
          onLoadMore={() => void state.albumsProjection.loadMore()}
          onOpenPhoto={(index) => state.setViewerIndex(index)}
          onPrefetchEvent={state.prefetchEventById}
          onRefresh={state.onRefresh}
          photos={state.photos}
          refreshing={state.refreshing}
        />
      )}

      <AlbumDetailViewerOverlay
        visible={state.viewerIndex !== null}
        data={state.viewerPhotos}
        initialIndex={state.viewerIndex || 0}
        onClose={closeViewer}
        refreshing={state.refreshing}
        onRefresh={state.onRefresh}
        relationByClub={state.relationByClub}
        onOpenEvent={state.openEventDetail}
        onOpenClub={state.openProfile}
        onOpenProfile={state.openProfile}
        onShowWarning={state.setWarningMessage}
        viewer={state.userData}
      />

      <FeedToast message={state.warningMessage} />

      <EventAlbumUploadModal
        accountType={state.accountType}
        visible={state.showAddPhoto}
        remainingAlbumSlots={state.remainingAlbumSlots}
        selectedMediaItems={state.selectedMediaItems}
        selectedPhotoUris={state.selectedPhotoUris}
        selectedPhotoIndex={state.normalizedSelectedPhotoIndex}
        newPhotoTitle={state.newPhotoTitle}
        newPhotoCaption={state.newPhotoCaption}
        showOnClubProfile={state.showOnClubProfile}
        showOnOwnProfile={state.showOnOwnProfile}
        cropPending={state.cropPending}
        hasSelectedProfileVisibility={state.hasSelectedProfileVisibility}
        uploadPending={state.uploading}
        onClose={handleCloseUploadModal}
        onPickPhotos={() => {
          void state.pickPhotos();
        }}
        onSelectPhoto={state.selectPhoto}
        onReorderSelectedPhoto={state.reorderSelectedPhoto}
        onCropSelectedPhoto={(index, uri) => {
          void state.cropSelectedPhoto(index, uri);
        }}
        onRemoveSelectedPhoto={state.removeSelectedPhoto}
        onChangeTitle={state.setNewPhotoTitle}
        onChangeCaption={state.setNewPhotoCaption}
        onChangeShowOnClubProfile={state.updateShowOnClubProfile}
        onChangeShowOnOwnProfile={state.updateShowOnOwnProfile}
        onSubmit={state.submitUpload}
      />

      <MediaSourceSheet
        allowVideo
        description={t("events.album.mediaSource.description")}
        onClose={state.closeMediaSourcePicker}
        onSelect={state.handleMediaSourceAction}
        subtitle={t("events.album.mediaSource.subtitle")}
        title={t("events.album.mediaSource.title")}
        visible={state.mediaSourceVisible}
      />

      <MediaLibraryPickerSheet
        allowVideo
        description={t("events.album.mediaLibrary.description")}
        maxSelectionCount={state.availableSelectionSlots}
        onClose={state.closeMediaLibraryPicker}
        onConfirm={(items) => state.handleMediaLibrarySelection(items)}
        selectionMode="multiple"
        subtitle={t("events.album.mediaLibrary.subtitle")}
        title={t("events.album.mediaLibrary.title")}
        visible={state.mediaLibraryVisible}
      />
    </View>
  );
}
