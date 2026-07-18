import React from "react";
import { GradientButton, TextField } from "../../../../shared/components";
import { t } from "../../../../shared/i18n";
import { TEXT_LIMITS } from "../../../../shared/validation/textLimits";
import { EventAlbumProfileVisibilitySection } from "./EventAlbumProfileVisibilitySection";

type Props = {
  accountType: "club" | "student";
  newPhotoCaption: string;
  newPhotoTitle: string;
  onChangeCaption: (value: string) => void;
  onChangeShowOnClubProfile: (value: boolean) => void;
  onChangeShowOnOwnProfile: (value: boolean) => void;
  onChangeTitle: (value: string) => void;
  onSubmit: () => void;
  selectedPhotoCount: number;
  hasSelectedProfileVisibility: boolean;
  showOnClubProfile: boolean;
  showOnOwnProfile: boolean;
  uploadPending: boolean;
};

export function EventAlbumUploadFormSection({
  accountType,
  newPhotoCaption,
  newPhotoTitle,
  onChangeCaption,
  onChangeShowOnClubProfile,
  onChangeShowOnOwnProfile,
  onChangeTitle,
  onSubmit,
  selectedPhotoCount,
  hasSelectedProfileVisibility,
  showOnClubProfile,
  showOnOwnProfile,
  uploadPending,
}: Props) {
  return (
    <>
      <TextField
        fieldName="albumTitle"
        label={t("events.album.upload.title")}
        maxLength={TEXT_LIMITS.album.title}
        onChangeText={onChangeTitle}
        supportingText={`${newPhotoTitle.length}/${TEXT_LIMITS.album.title}`}
        value={newPhotoTitle}
      />

      <TextField
        fieldName="albumCaption"
        label={t("events.album.upload.caption")}
        maxLength={TEXT_LIMITS.album.caption}
        multiline
        onChangeText={onChangeCaption}
        supportingText={`${newPhotoCaption.length}/${TEXT_LIMITS.album.caption}`}
        value={newPhotoCaption}
      />

      <EventAlbumProfileVisibilitySection
        accountType={accountType}
        disabled={uploadPending}
        showOnClubProfile={showOnClubProfile}
        showOnOwnProfile={showOnOwnProfile}
        onChangeShowOnClubProfile={onChangeShowOnClubProfile}
        onChangeShowOnOwnProfile={onChangeShowOnOwnProfile}
      />

      <GradientButton
        label={
          uploadPending ? t("events.album.upload.submitting") : t("events.album.upload.submit")
        }
        onPress={onSubmit}
        loading={uploadPending}
        disabled={!selectedPhotoCount || !hasSelectedProfileVisibility || uploadPending}
      />
    </>
  );
}
