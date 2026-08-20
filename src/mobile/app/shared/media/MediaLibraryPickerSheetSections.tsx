import React from "react";
import { AppText as Text } from "../components/AppText";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Check, ImagePlus, X } from "lucide-react-native";
import { t } from "../i18n";
import { tokens } from "../theme";

type TabKey = "all" | "photos" | "videos";

export function MediaLibraryPickerLoadingState() {
  return (
    <View
      style={{
        paddingVertical: tokens.spacing["3xl"],
        alignItems: "center",
        justifyContent: "center",
        gap: tokens.spacing.sm - 2,
      }}
    >
      <ActivityIndicator color={tokens.colors.primary} />
      <Text style={{ color: tokens.colors.muted, fontSize: tokens.typography.caption }}>
        {t("media.library.loading")}
      </Text>
    </View>
  );
}

export function MediaLibraryPickerPermissionState(props: { onClose: () => void }) {
  return (
    <View
      style={{
        paddingVertical: tokens.spacing["3xl"],
        alignItems: "center",
        gap: tokens.spacing.xs,
      }}
    >
      <Text
        style={{
          color: tokens.colors.foreground,
          fontSize: tokens.typography.control,
          fontWeight: tokens.fontWeight.extrabold,
        }}
      >
        {t("media.library.permissionTitle")}
      </Text>
      <Text
        style={{
          color: tokens.colors.muted,
          fontSize: tokens.typography.caption,
          textAlign: "center",
        }}
      >
        {t("media.library.permissionSubtitle")}
      </Text>
      <Pressable
        onPress={props.onClose}
        accessibilityRole="button"
        accessibilityLabel={t("common.close")}
        style={{
          marginTop: tokens.spacing.xsMinus,
          minHeight: tokens.minHeight.inputSm,
          borderRadius: tokens.radius.md,
          backgroundColor: tokens.colors.primary,
          paddingHorizontal: tokens.spacing.smPlus,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: tokens.colors.surface,
            fontSize: tokens.typography.label,
            fontWeight: tokens.fontWeight.extrabold,
          }}
        >
          {t("common.close")}
        </Text>
      </Pressable>
    </View>
  );
}

export function MediaLibraryPickerEmptyState(props: { tab: TabKey }) {
  return (
    <View
      style={{
        paddingVertical: tokens.spacing["3xl"],
        alignItems: "center",
        gap: tokens.spacing.xs,
      }}
    >
      <Text
        style={{
          color: tokens.colors.foreground,
          fontSize: tokens.typography.control,
          fontWeight: tokens.fontWeight.extrabold,
        }}
      >
        {t("media.library.emptyTitle")}
      </Text>
      <Text
        style={{
          color: tokens.colors.muted,
          fontSize: tokens.typography.caption,
          textAlign: "center",
        }}
      >
        {props.tab === "videos"
          ? t("media.library.emptyVideos")
          : props.tab === "photos"
            ? t("media.library.emptyPhotos")
            : t("media.library.emptyAll")}
      </Text>
    </View>
  );
}

export function MediaLibraryPickerSelectionSummary(props: { selectedCount: number }) {
  return (
    <View
      style={{
        borderRadius: tokens.radius.card,
        borderWidth: 1,
        borderColor: tokens.colors.borderLight,
        backgroundColor: tokens.colors.background,
        paddingHorizontal: tokens.spacing.sm,
        paddingVertical: tokens.spacing.sm - 2,
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.xs,
      }}
    >
      <View
        style={{
          width: tokens.radius["3xl"],
          height: tokens.radius["3xl"],
          borderRadius: tokens.spacing.sm - 2,
          backgroundColor: tokens.colors.primarySofter,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Check size={tokens.iconSize.sm} color={tokens.colors.primary} />
      </View>
      <Text
        style={{
          flex: 1,
          color: tokens.colors.muted,
          fontSize: tokens.typography.tiny,
          lineHeight: tokens.spacing.md,
        }}
      >
        {props.selectedCount > 0
          ? t("media.library.selected", { count: props.selectedCount })
          : t("media.library.selectHint")}
      </Text>
    </View>
  );
}

export function MediaLibraryPickerConfirmButton(props: { disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      disabled={props.disabled}
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={t("media.library.confirm")}
      accessibilityState={{ disabled: props.disabled }}
      style={{
        minHeight: tokens.minHeight.buttonLg,
        borderRadius: tokens.radius.control,
        backgroundColor: props.disabled ? tokens.colors.mutedFg : tokens.colors.primary,
        alignItems: "center",
        justifyContent: "center",
        opacity: props.disabled ? 0.65 : 1,
      }}
    >
      <Text
        style={{
          color: tokens.colors.surface,
          fontSize: tokens.typography.body,
          fontWeight: tokens.fontWeight.extrabold,
        }}
      >
        {t("media.library.confirm")}
      </Text>
    </Pressable>
  );
}

export function MediaLibraryPickerSheetHeader(props: {
  allowVideo: boolean;
  description?: string;
  onClose: () => void;
  onTabChange: (tab: TabKey) => void;
  subtitle?: string;
  tab: TabKey;
  title: string;
}) {
  return (
    <View
      style={{
        paddingHorizontal: tokens.spacing.md,
        paddingTop: tokens.spacing.smPlus,
        paddingBottom: tokens.spacing.sm,
        backgroundColor: tokens.colors.surfaceTint,
        borderBottomWidth: 1,
        borderBottomColor: tokens.colors.border,
        gap: tokens.spacing.xs,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: tokens.spacing.sm }}>
        <View
          style={{
            width: tokens.minHeight.inputSm,
            height: tokens.minHeight.inputSm,
            borderRadius: tokens.radius.lg,
            backgroundColor: tokens.colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ImagePlus size={tokens.iconSize.xl} color={tokens.colors.primary} />
        </View>
        <View style={{ flex: 1, gap: tokens.spacing.xxs }}>
          <Text
            style={{
              color: tokens.colors.foreground,
              fontSize: tokens.typography.sectionTitle - 2,
              fontWeight: tokens.fontWeight.extrabold,
            }}
          >
            {props.title}
          </Text>
          {props.subtitle ? (
            <Text
              style={{
                color: tokens.colors.muted,
                fontSize: tokens.typography.caption,
                fontWeight: tokens.fontWeight.semibold,
              }}
            >
              {props.subtitle}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityLabel={t("common.close")}
          accessibilityRole="button"
          onPress={props.onClose}
          style={{
            width: tokens.minHeight.header,
            height: tokens.minHeight.header,
            borderRadius: tokens.radius.md,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: tokens.colors.accent,
          }}
        >
          <X size={tokens.iconSize.md} color={tokens.colors.primary} />
        </Pressable>
      </View>

      {props.description ? (
        <Text
          style={{
            color: tokens.colors.muted,
            fontSize: tokens.typography.caption,
            lineHeight: tokens.lineHeight.caption,
          }}
        >
          {props.description}
        </Text>
      ) : null}

      <View
        style={{ flexDirection: "row", gap: tokens.spacing.xs, paddingTop: tokens.spacing.micro }}
      >
        {(["all", "photos", "videos"] as const).map((item) => {
          const active = props.tab === item;
          const label =
            item === "all"
              ? t("media.library.tab.all")
              : item === "photos"
                ? t("media.library.tab.photos")
                : t("media.library.tab.videos");
          const disabled = item === "videos" && !props.allowVideo;

          return (
            <Pressable
              key={item}
              accessibilityLabel={label}
              accessibilityRole="tab"
              accessibilityState={{ disabled, selected: active }}
              disabled={disabled}
              onPress={() => props.onTabChange(item)}
              style={{
                flex: 1,
                minHeight: tokens.minHeight.chipLg,
                borderRadius: tokens.radius.pill,
                borderWidth: 1,
                borderColor: active ? tokens.colors.primary : tokens.colors.borderLight,
                backgroundColor: active ? tokens.colors.primarySoft : tokens.colors.surface,
                alignItems: "center",
                justifyContent: "center",
                opacity: disabled ? 0.45 : 1,
              }}
            >
              <Text
                style={{
                  color: active ? tokens.colors.primary : tokens.colors.muted,
                  fontSize: tokens.typography.caption,
                  fontWeight: tokens.fontWeight.extrabold,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
