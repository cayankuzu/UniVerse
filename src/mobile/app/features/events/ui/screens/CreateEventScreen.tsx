import React, { useEffect, useMemo } from "react";
import { Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../../../app-shell/auth";
import { useSetBottomTabsVisible } from "../../../../app-shell/navigation/ChromeVisibilityContext";
import { safeResetToRoute } from "../../../../app-shell/navigation/safeReset";
import { BackHeader, GradientButton, KeyboardSafeForm } from "../../../../shared/components";
import { useTranslation } from "../../../../shared/i18n";
import { categories } from "../../../../shared/catalog/taxonomy";
import { MediaLibraryPickerSheet } from "../../../../shared/media/MediaLibraryPickerSheet";
import { MediaSourceSheet } from "../../../../shared/media/MediaSourceSheet";
import { tokens } from "../../../../shared/theme";
import { showConfirmAlert } from "../../../../shared/utils/alerts";
import type { RootStackParamList } from "../../../../app-shell/navigation/types";
import { useCreateEventScreenState } from "../../application/useCreateEventScreenState";
import { CREATE_EVENT_STEP_LABELS, TOTAL_CREATE_EVENT_STEPS } from "../../domain";
import { CreateEventStepBasic } from "./CreateEventStepBasic";
import { CreateEventStepDetails } from "./CreateEventStepDetails";
import { CreateEventStepSchedule } from "./CreateEventStepSchedule";

type Props = NativeStackScreenProps<RootStackParamList, "CreateEvent">;

function resolveViewerKey(identity?: { id?: string | null; username?: string | null }) {
  const viewerKey = String(identity?.id || identity?.username || "guest")
    .trim()
    .toLowerCase();
  return viewerKey || "guest";
}

export function CreateEventScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const bottomPadding = useMemo(() => Math.max(insets.bottom + 20, 28), [insets.bottom]);
  const { t } = useTranslation();
  const { userData } = useAuth();
  const setBottomTabsVisible = useSetBottomTabsVisible();
  const {
    coverMediaSelection,
    coverImageUri,
    canLeaveScreenWithoutPrompt,
    cropCoverImage,
    cropPending,
    clearCoverImage,
    closeMediaLibraryPicker,
    closeMediaSourcePicker,
    fieldErrors,
    fieldFocusRequest,
    form,
    handleBack,
    handleMediaLibrarySelection,
    handlePrimaryAction,
    handleMediaSourceAction,
    pickCoverImage,
    mediaLibraryVisible,
    mediaSourceVisible,
    primaryActionDisabled,
    primaryActionLoading,
    selectedCategories,
    setField,
    setSelectedCategories,
    submitAttempted,
    step,
    submitError,
    uploadProgress,
  } = useCreateEventScreenState({
    goBack: () => navigation.goBack(),
    resetToHome: () => safeResetToRoute(navigation, "Home"),
    setBottomTabsVisible,
    userData,
    viewerKey: resolveViewerKey(userData),
  });

  useEffect(() => {
    return navigation.addListener("beforeRemove", (event) => {
      if (canLeaveScreenWithoutPrompt()) return;
      event.preventDefault();
      handleBack();
    });
  }, [canLeaveScreenWithoutPrompt, handleBack, navigation]);

  const handleClearCoverImage = () => {
    if (!coverImageUri) return;
    showConfirmAlert({
      cancelLabel: "Vazgeç",
      confirmLabel: "Sil",
      destructive: true,
      message: "Seçili kapak medyası kaldırılacak.",
      onConfirm: clearCoverImage,
      title: "Kapak kaldırılsın mı?",
    });
  };
  const hasInlineValidationError =
    Object.values(fieldErrors).some(Boolean) ||
    (submitAttempted && selectedCategories.length === 0);
  const visibleSubmitError =
    submitError && !uploadProgress && !hasInlineValidationError ? submitError : "";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.colors.background }} edges={["bottom"]}>
      <BackHeader
        title={t("events.create.title")}
        horizontalPadding={0}
        onBack={handleBack}
        right={
          <Text style={{ fontSize: 12, color: tokens.colors.muted, fontWeight: "600" }}>
            {step}/{TOTAL_CREATE_EVENT_STEPS}
          </Text>
        }
      />

      <View
        style={{
          height: 3,
          backgroundColor: tokens.colors.border,
          marginHorizontal: 0,
          borderRadius: 2,
          marginBottom: 4,
        }}
      >
        <View
          style={{
            height: 3,
            borderRadius: 2,
            backgroundColor: tokens.colors.primary,
            width: `${(step / TOTAL_CREATE_EVENT_STEPS) * 100}%`,
          }}
        />
      </View>

      <KeyboardSafeForm
        backgroundColor={tokens.colors.background}
        bottomInsetOwner="screen"
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 0,
          paddingTop: 10,
          paddingBottom: bottomPadding,
          gap: 16,
        }}
        scrollProps={{ keyboardShouldPersistTaps: "handled" }}
        focusRequest={fieldFocusRequest}
      >
        {step === 1 ? (
          <CreateEventStepBasic
            form={form}
            coverMediaSelection={coverMediaSelection}
            coverImageUri={coverImageUri}
            cropPending={cropPending}
            userUniversity={userData.university || ""}
            categories={categories}
            fieldErrors={fieldErrors}
            onCropCoverImage={cropCoverImage}
            selectedCategories={selectedCategories}
            onClearCoverImage={handleClearCoverImage}
            onSetField={setField}
            onSetSelectedCategories={setSelectedCategories}
            onPickCoverImage={pickCoverImage}
            submitAttempted={submitAttempted}
          />
        ) : null}

        {step === 2 ? (
          <>
            <CreateEventStepSchedule fieldErrors={fieldErrors} form={form} onSetField={setField} />
            <CreateEventStepDetails fieldErrors={fieldErrors} form={form} onSetField={setField} />
          </>
        ) : null}

        <View
          style={{
            marginTop: 4,
            gap: 8,
            borderTopWidth: 1,
            borderTopColor: tokens.colors.border,
            paddingTop: 10,
          }}
        >
          <Text style={{ color: tokens.colors.muted, fontSize: 10 }}>
            {CREATE_EVENT_STEP_LABELS[step - 1]}
          </Text>
          {visibleSubmitError ? (
            <Text style={{ color: tokens.colors.danger, fontSize: 13, fontWeight: "600" }}>
              {visibleSubmitError}
            </Text>
          ) : null}
          <GradientButton
            label={
              step < TOTAL_CREATE_EVENT_STEPS ? t("common.continue") : t("events.create.publish")
            }
            onPress={handlePrimaryAction}
            loading={primaryActionLoading}
            disabled={primaryActionDisabled}
            size="lg"
          />
        </View>
      </KeyboardSafeForm>

      <MediaSourceSheet
        allowVideo
        description={t("events.create.mediaSource.description")}
        onClose={closeMediaSourcePicker}
        onSelect={handleMediaSourceAction}
        subtitle={t("events.create.mediaSource.subtitle")}
        title={t("events.create.mediaSource.title")}
        visible={mediaSourceVisible}
      />

      <MediaLibraryPickerSheet
        allowVideo
        description={t("events.create.library.description")}
        maxSelectionCount={1}
        onClose={closeMediaLibraryPicker}
        onConfirm={(items) => handleMediaLibrarySelection(items)}
        selectionMode="single"
        subtitle={t("events.create.library.subtitle")}
        title={t("events.create.library.title")}
        visible={mediaLibraryVisible}
      />
    </SafeAreaView>
  );
}
