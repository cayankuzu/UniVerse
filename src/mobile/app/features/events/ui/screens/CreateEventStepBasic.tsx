import { useMemo, useState, type ComponentType } from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Camera, Crop, Play, Trash2 } from "lucide-react-native";
import { Image, Pressable, View } from "react-native";
import { tokens, withAlpha } from "../../../../shared/theme";
import { TourAnchor } from "../../../../app-shell/onboarding";
import { CategorySelector, TextField } from "../../../../shared/components";
import { useTranslation } from "../../../../shared/i18n";
import { SelectField } from "../../../../shared/components/SelectField";
import { MediaViewerModal, type MediaViewerItem } from "../../../../shared/media/MediaViewerModal";
import { VideoThumbnailPreview } from "../../../../shared/media/VideoThumbnailPreview";
import { formatMediaDuration } from "../../../../shared/media/mediaVideoUtils";
import {
  isVideoMediaUri,
  resolveMediaSelectionPreviewCandidates,
} from "../../../../shared/media/mediaPicker";
import type { MediaSelection } from "../../../../shared/media/mediaPicker";
import { EVENT_TYPES, type CreateEventFormState } from "../../domain";
import { EventFormSection } from "./EventFormSection";

interface Props {
  coverMediaSelection: MediaSelection | null;
  form: CreateEventFormState;
  fieldErrors: Partial<Record<keyof CreateEventFormState, string | undefined>>;
  coverImageUri: string;
  cropPending: boolean;
  userUniversity: string;
  categories: string[];
  selectedCategories: string[];
  onCropCoverImage: () => void;
  onClearCoverImage: () => void;
  onSetField: (key: keyof CreateEventFormState, value: string) => void;
  onSetSelectedCategories: (next: string[]) => void;
  onPickCoverImage: () => void;
  submitAttempted: boolean;
}

function ActionButton(props: {
  icon: ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
  label: string;
  onPress: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
}) {
  const color = props.tone === "danger" ? tokens.colors.dangerDark : tokens.colors.primary;
  const backgroundColor =
    props.tone === "danger" ? tokens.colors.dangerSoft : tokens.colors.primarySofter;
  const borderColor =
    props.tone === "danger" ? tokens.colors.dangerBorder : tokens.colors.primaryBorder;
  const Icon = props.icon;

  return (
    <Pressable
      disabled={props.disabled}
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: props.disabled }}
      style={{
        flex: 1,
        minHeight: tokens.minHeight.inputSm,
        borderRadius: tokens.radius.md,
        borderWidth: 1,
        borderColor,
        backgroundColor,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: tokens.spacing.xs,
        opacity: props.disabled ? 0.5 : 1,
      }}
    >
      <Icon size={tokens.iconSize.md} color={color} strokeWidth={1.8} />
      <Text
        style={{ color, fontSize: tokens.typography.label, fontWeight: tokens.fontWeight.bold }}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

export function CreateEventStepBasic({
  coverMediaSelection,
  fieldErrors,
  form,
  coverImageUri,
  cropPending,
  userUniversity,
  categories,
  selectedCategories,
  onCropCoverImage,
  onClearCoverImage,
  onSetField,
  onSetSelectedCategories,
  onPickCoverImage,
  submitAttempted,
}: Props) {
  const [previewVisible, setPreviewVisible] = useState(false);
  const { t } = useTranslation();
  const hasCover = Boolean(coverImageUri);
  const isVideoCover = coverMediaSelection?.kind === "video" || isVideoMediaUri(coverImageUri);
  const coverDurationLabel = isVideoCover
    ? formatMediaDuration(coverMediaSelection?.durationMs)
    : "";
  const canCropCover = hasCover && !isVideoCover && !cropPending;
  const categoryError =
    submitAttempted && selectedCategories.length === 0
      ? "En az bir kategori seçmelisin."
      : undefined;
  const previewItems = useMemo<MediaViewerItem[]>(
    () => (hasCover ? [{ uri: coverImageUri, kind: isVideoCover ? "video" : "image" }] : []),
    [coverImageUri, hasCover, isVideoCover],
  );

  return (
    <>
      <EventFormSection
        title={t("events.create.basic.title")}
        subtitle={t("events.create.basic.subtitle")}
      >
        <TourAnchor tourId="create-event-cover">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              hasCover ? "Etkinlik kapak görselini önizle" : "Etkinlik kapak görseli seç"
            }
            onPress={() => {
              if (hasCover) {
                setPreviewVisible(true);
                return;
              }
              onPickCoverImage();
            }}
            style={{
              height: 180,
              borderRadius: tokens.radius.lg,
              backgroundColor: tokens.colors.border,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: tokens.colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {hasCover ? (
              isVideoCover ? (
                <View style={{ width: "100%", height: "100%" }}>
                  <VideoThumbnailPreview
                    candidateUris={resolveMediaSelectionPreviewCandidates(coverMediaSelection)}
                    uri={coverImageUri}
                    priority="eager"
                    style={{ width: "100%", height: "100%" }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      bottom: 0,
                      left: 0,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: withAlpha(tokens.colors.foreground, 0.18),
                    }}
                  >
                    <Play
                      size={tokens.iconSize["3xl"]}
                      color={tokens.colors.surface}
                      strokeWidth={1.8}
                    />
                  </View>
                  {coverDurationLabel ? (
                    <View
                      style={{
                        position: "absolute",
                        left: tokens.spacing.sm,
                        bottom: tokens.spacing.sm,
                        borderRadius: tokens.radius.pill,
                        backgroundColor: tokens.colors.backdropLight,
                        paddingHorizontal: tokens.spacing.compact,
                        paddingVertical: tokens.spacing.xsMinus,
                      }}
                    >
                      <Text
                        style={{
                          color: tokens.colors.surface,
                          fontSize: tokens.typography.tiny,
                          fontWeight: tokens.fontWeight.bold,
                        }}
                      >
                        {coverDurationLabel}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : (
                <>
                  <Image
                    source={{ uri: coverImageUri }}
                    style={{ width: "100%", height: "100%", position: "absolute" }}
                    resizeMode="cover"
                  />
                  <View
                    style={{
                      position: "absolute",
                      right: tokens.spacing.sm,
                      bottom: tokens.spacing.sm,
                      borderRadius: tokens.radius.pill,
                      backgroundColor: tokens.colors.backdropLight,
                      paddingHorizontal: tokens.spacing.compact,
                      paddingVertical: tokens.spacing.xsMinus,
                    }}
                  >
                    <Text
                      style={{
                        color: tokens.colors.surface,
                        fontSize: tokens.typography.tiny,
                        fontWeight: tokens.fontWeight.bold,
                      }}
                    >
                      {t("events.create.basic.zoom")}
                    </Text>
                  </View>
                </>
              )
            ) : (
              <View style={{ alignItems: "center", gap: tokens.spacing.xs }}>
                <Camera size={tokens.iconSize["2xl"]} color={tokens.colors.muted} />
                <Text
                  style={{
                    color: tokens.colors.muted,
                    fontSize: tokens.typography.label,
                    fontWeight: tokens.fontWeight.medium,
                  }}
                >
                  {t("events.create.basic.pickCover")}
                </Text>
                <Text style={{ color: tokens.colors.muted, fontSize: tokens.typography.tiny }}>
                  {t("events.create.basic.aspectHint")}
                </Text>
              </View>
            )}
          </Pressable>
        </TourAnchor>

        <View style={{ flexDirection: "row", gap: tokens.spacing.compact }}>
          <ActionButton
            icon={Camera}
            label={
              hasCover ? t("events.create.basic.changeMedia") : t("events.create.basic.addMedia")
            }
            onPress={onPickCoverImage}
            disabled={cropPending}
          />
          {hasCover && !isVideoCover ? (
            <ActionButton
              icon={Crop}
              label={
                cropPending ? t("events.create.basic.cropping") : t("events.create.basic.crop")
              }
              onPress={onCropCoverImage}
              disabled={!canCropCover}
            />
          ) : null}
          {hasCover ? (
            <ActionButton
              icon={Trash2}
              label={t("events.create.basic.remove")}
              onPress={onClearCoverImage}
              tone="danger"
              disabled={cropPending}
            />
          ) : null}
        </View>

        <TextField
          errorText={fieldErrors.title}
          fieldName="title"
          label={t("events.create.basic.titleField")}
          placeholder={t("events.create.basic.titlePlaceholder")}
          value={form.title}
          onChangeText={(value) => onSetField("title", value)}
        />

        <View style={{ gap: tokens.spacing.xxs }}>
          <TextField
            fieldName="description"
            errorText={fieldErrors.description}
            label={t("events.create.basic.descriptionField")}
            placeholder={t("events.create.basic.descriptionPlaceholder")}
            value={form.description}
            onChangeText={(value) => onSetField("description", value)}
            multiline
            numberOfLines={4}
            maxLength={4000}
            style={{ minHeight: 96, textAlignVertical: "top" }}
          />
          <Text
            style={{
              color: tokens.colors.muted,
              fontSize: tokens.typography.caption,
              textAlign: "right",
            }}
          >
            {form.description.length}/4000
          </Text>
        </View>

        <SelectField
          errorText={fieldErrors.type}
          fieldName="type"
          label={t("events.create.basic.typeField")}
          value={form.type}
          placeholder={t("events.create.basic.typePlaceholder")}
          options={[...EVENT_TYPES]}
          onSelect={(value) => onSetField("type", value)}
        />

        <TextField
          fieldName="university"
          label={t("events.create.basic.universityField")}
          value={userUniversity}
          editable={false}
          style={{ color: tokens.colors.muted }}
        />

        <CategorySelector
          errorText={categoryError}
          fieldName="categories"
          label={t("events.create.basic.categoriesField")}
          selected={selectedCategories}
          options={categories}
          onChange={onSetSelectedCategories}
          accent={tokens.colors.primary}
          maxSelections={8}
        />
      </EventFormSection>

      <MediaViewerModal
        items={previewItems}
        onClose={() => setPreviewVisible(false)}
        visible={previewVisible}
      />
    </>
  );
}
